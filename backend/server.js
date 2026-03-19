import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

dotenv.config();

const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret-in-production";
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const DB_FILE = process.env.DB_FILE || (process.env.VERCEL ? "/tmp/bunnybites.db" : "./data/bunnybites.db");

const app = express();
app.use(express.json());
app.use(cors({ origin: CORS_ORIGIN }));

const captchaStore = new Map();
const CAPTCHA_TTL_MS = 5 * 60 * 1000;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const extractBearerToken = (authorizationHeader = "") => {
    const [scheme, token] = String(authorizationHeader).split(" ");
    if (scheme !== "Bearer" || !token) {
        return "";
    }
    return token.trim();
};

const ensureDir = (filePath) => {
    const dirPath = path.dirname(filePath);
    fs.mkdirSync(dirPath, { recursive: true });
};

const normalizeEmail = (email = "") => email.trim().toLowerCase();

const generateCaptcha = () => {
    const first = Math.floor(Math.random() * 9) + 1;
    const second = Math.floor(Math.random() * 9) + 1;
    const challengeId = crypto.randomUUID();
    const answer = String(first + second);
    const expiresAt = Date.now() + CAPTCHA_TTL_MS;

    captchaStore.set(challengeId, { answer, expiresAt });

    return {
        challengeId,
        prompt: `Quanto e ${first} + ${second}?`
    };
};

const cleanupCaptcha = () => {
    const now = Date.now();
    for (const [challengeId, entry] of captchaStore.entries()) {
        if (entry.expiresAt <= now) {
            captchaStore.delete(challengeId);
        }
    }
};

const verifyCaptcha = (challengeId, answer) => {
    cleanupCaptcha();

    if (!challengeId || !answer) {
        return { ok: false, message: "Resolva a verificacao anti-robo." };
    }

    const challenge = captchaStore.get(challengeId);
    if (!challenge) {
        return { ok: false, message: "Desafio anti-robo expirado. Gere um novo." };
    }

    captchaStore.delete(challengeId);

    if (String(answer).trim() !== challenge.answer) {
        return { ok: false, message: "Verificacao anti-robo invalida." };
    }

    return { ok: true };
};

const createToken = (user) => jwt.sign(
    {
        sub: String(user.id),
        email: user.email,
        name: user.name
    },
    JWT_SECRET,
    {
        expiresIn: "7d",
        jwtid: crypto.randomUUID()
    }
);

let db;
let dbInitPromise;

const ensureDbReady = async () => {
    if (db) return;

    if (!dbInitPromise) {
        dbInitPromise = initDb().catch((error) => {
            dbInitPromise = undefined;
            throw error;
        });
    }

    await dbInitPromise;
};

app.use(async (_req, _res, next) => {
    try {
        await ensureDbReady();
        next();
    } catch {
        next(new Error("Falha ao inicializar banco de dados."));
    }
});

const cleanupRevokedTokens = async () => {
    const nowInSeconds = Math.floor(Date.now() / 1000);
    await db.run("DELETE FROM revoked_tokens WHERE expires_at <= ?", [nowInSeconds]);
};

const isTokenRevoked = async (jti) => {
    if (!jti) return true;
    await cleanupRevokedTokens();
    const revoked = await db.get("SELECT jti FROM revoked_tokens WHERE jti = ?", [jti]);
    return Boolean(revoked);
};

const revokeToken = async ({ jti, exp }) => {
    if (!jti || !Number.isFinite(exp)) return;

    await db.run(
        "INSERT OR REPLACE INTO revoked_tokens (jti, expires_at) VALUES (?, ?)",
        [jti, exp]
    );
};

const requireAuth = async (req, res, next) => {
    try {
        const token = extractBearerToken(req.headers.authorization);

        if (!token) {
            return res.status(401).json({ success: false, message: "Token de acesso ausente." });
        }

        const payload = jwt.verify(token, JWT_SECRET);
        if (!payload?.sub || !payload?.jti || !payload?.exp) {
            return res.status(401).json({ success: false, message: "Token de acesso invalido." });
        }

        const revoked = await isTokenRevoked(payload.jti);
        if (revoked) {
            return res.status(401).json({ success: false, message: "Token revogado. Faca login novamente." });
        }

        req.auth = { token, payload };
        return next();
    } catch {
        return res.status(401).json({ success: false, message: "Token de acesso invalido ou expirado." });
    }
};

const initDb = async () => {
    ensureDir(DB_FILE);
    db = await open({
        filename: DB_FILE,
        driver: sqlite3.Database
    });

    await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS revoked_tokens (
      jti TEXT PRIMARY KEY,
      expires_at INTEGER NOT NULL,
      revoked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS user_cart_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      product_price REAL NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, product_name)
    );

    CREATE TABLE IF NOT EXISTS user_wishlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      product_price REAL NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      UNIQUE(user_id, product_name)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      order_id TEXT NOT NULL UNIQUE,
      total_price REAL NOT NULL,
      items_count INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `);
};

app.get("/api/health", (_req, res) => {
    res.json({ success: true, message: "Bunny Bites auth API online." });
});

app.post("/api/auth/captcha", (_req, res) => {
    const challenge = generateCaptcha();
    res.status(200).json({
        success: true,
        message: "Desafio gerado com sucesso.",
        challengeId: challenge.challengeId,
        prompt: challenge.prompt
    });
});

app.post("/api/auth/register", async (req, res) => {
    try {
        const name = (req.body?.name || "").trim();
        const email = normalizeEmail(req.body?.email || "");
        const password = String(req.body?.password || "");
        const captchaChallengeId = String(req.body?.captchaChallengeId || "");
        const captchaAnswer = String(req.body?.captchaAnswer || "");

        if (name.split(" ").filter(Boolean).length < 2) {
            return res.status(422).json({ success: false, message: "Digite nome e sobrenome." });
        }

        if (!emailPattern.test(email)) {
            return res.status(422).json({ success: false, message: "Digite um e-mail valido." });
        }

        if (!strongPasswordPattern.test(password)) {
            return res.status(422).json({
                success: false,
                message: "A senha precisa ter 8+ caracteres, maiuscula, minuscula, numero e simbolo."
            });
        }

        const captchaValidation = verifyCaptcha(captchaChallengeId, captchaAnswer);
        if (!captchaValidation.ok) {
            return res.status(422).json({ success: false, message: captchaValidation.message });
        }

        const existingUser = await db.get("SELECT id FROM users WHERE email = ?", [email]);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: "Este e-mail ja esta cadastrado. Tente entrar na sua conta."
            });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const result = await db.run(
            "INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)",
            [name, email, passwordHash]
        );

        const user = { id: result.lastID, name, email };
        const token = createToken(user);

        return res.status(201).json({
            success: true,
            message: "Conta criada com sucesso.",
            email: user.email,
            token
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Erro interno no servidor." });
    }
});

app.post("/api/auth/login", async (req, res) => {
    try {
        const email = normalizeEmail(req.body?.email || "");
        const password = String(req.body?.password || "");
        const captchaChallengeId = String(req.body?.captchaChallengeId || "");
        const captchaAnswer = String(req.body?.captchaAnswer || "");

        if (!emailPattern.test(email) || !password) {
            return res.status(422).json({ success: false, message: "E-mail ou senha invalidos." });
        }

        const captchaValidation = verifyCaptcha(captchaChallengeId, captchaAnswer);
        if (!captchaValidation.ok) {
            return res.status(422).json({ success: false, message: captchaValidation.message });
        }

        const user = await db.get(
            "SELECT id, name, email, password_hash FROM users WHERE email = ?",
            [email]
        );

        if (!user) {
            return res.status(401).json({ success: false, message: "E-mail ou senha invalidos." });
        }

        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ success: false, message: "E-mail ou senha invalidos." });
        }

        const token = createToken(user);

        return res.status(200).json({
            success: true,
            message: "Login realizado com sucesso.",
            email: user.email,
            token
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Erro interno no servidor." });
    }
});

app.post("/api/auth/logout", requireAuth, async (req, res) => {
    try {
        await revokeToken({
            jti: req.auth.payload.jti,
            exp: req.auth.payload.exp
        });

        return res.status(200).json({
            success: true,
            message: "Logout realizado com sucesso. Token invalidado."
        });
    } catch {
        return res.status(500).json({ success: false, message: "Erro interno no servidor." });
    }
});

app.get("/api/cart", requireAuth, async (req, res) => {
    try {
        const userId = req.auth.payload.sub;
        const items = await db.all(
            `SELECT id, product_name as name, product_price as price, quantity 
             FROM user_cart_items 
             WHERE user_id = ? 
             ORDER BY created_at DESC`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            message: "Carrinho carregado com sucesso.",
            items: items || []
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Erro ao carregar carrinho." });
    }
});

app.post("/api/cart/add", requireAuth, async (req, res) => {
    try {
        const userId = req.auth.payload.sub;
        const productName = (req.body?.productName || "").trim();
        const productPrice = parseFloat(req.body?.productPrice) || 0;
        const quantity = Math.max(1, parseInt(req.body?.quantity) || 1);

        if (!productName || productPrice <= 0) {
            return res.status(422).json({
                success: false,
                message: "Dados de produto invalidos."
            });
        }

        const existingItem = await db.get(
            `SELECT id, quantity FROM user_cart_items 
             WHERE user_id = ? AND product_name = ?`,
            [userId, productName]
        );

        if (existingItem) {
            await db.run(
                `UPDATE user_cart_items 
                 SET quantity = quantity + ? 
                 WHERE id = ?`,
                [quantity, existingItem.id]
            );
        } else {
            await db.run(
                `INSERT INTO user_cart_items (user_id, product_name, product_price, quantity) 
                 VALUES (?, ?, ?, ?)`,
                [userId, productName, productPrice, quantity]
            );
        }

        return res.status(200).json({
            success: true,
            message: "Item adicionado ao carrinho com sucesso."
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Erro ao adicionar item ao carrinho." });
    }
});

app.delete("/api/cart/remove/:itemId", requireAuth, async (req, res) => {
    try {
        const userId = req.auth.payload.sub;
        const itemId = parseInt(req.params.itemId);

        const result = await db.run(
            `DELETE FROM user_cart_items 
             WHERE id = ? AND user_id = ?`,
            [itemId, userId]
        );

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "Item nao encontrado no carrinho."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Item removido do carrinho com sucesso."
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Erro ao remover item do carrinho." });
    }
});

app.get("/api/wishlist", requireAuth, async (req, res) => {
    try {
        const userId = req.auth.payload.sub;
        const items = await db.all(
            `SELECT id, product_name as name, product_price as price 
             FROM user_wishlist_items 
             WHERE user_id = ? 
             ORDER BY created_at DESC`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            message: "Wishlist carregada com sucesso.",
            items: items || []
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Erro ao carregar wishlist." });
    }
});

app.post("/api/wishlist/add", requireAuth, async (req, res) => {
    try {
        const userId = req.auth.payload.sub;
        const productName = (req.body?.productName || "").trim();
        const productPrice = parseFloat(req.body?.productPrice) || 0;

        if (!productName || productPrice <= 0) {
            return res.status(422).json({
                success: false,
                message: "Dados de produto invalidos."
            });
        }

        const existingItem = await db.get(
            `SELECT id FROM user_wishlist_items 
             WHERE user_id = ? AND product_name = ?`,
            [userId, productName]
        );

        if (existingItem) {
            return res.status(409).json({
                success: false,
                message: "Este produto ja esta na sua wishlist."
            });
        }

        await db.run(
            `INSERT INTO user_wishlist_items (user_id, product_name, product_price) 
             VALUES (?, ?, ?)`,
            [userId, productName, productPrice]
        );

        return res.status(200).json({
            success: true,
            message: "Produto adicionado a wishlist com sucesso."
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Erro ao adicionar item a wishlist." });
    }
});

app.delete("/api/wishlist/remove/:itemId", requireAuth, async (req, res) => {
    try {
        const userId = req.auth.payload.sub;
        const itemId = parseInt(req.params.itemId);

        const result = await db.run(
            `DELETE FROM user_wishlist_items 
             WHERE id = ? AND user_id = ?`,
            [itemId, userId]
        );

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: "Item nao encontrado na wishlist."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Item removido da wishlist com sucesso."
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Erro ao remover item da wishlist." });
    }
});

app.post("/api/checkout", requireAuth, async (req, res) => {
    try {
        const userId = req.auth.payload.sub;
        const items = Array.isArray(req.body?.items) ? req.body.items : [];

        if (items.length === 0) {
            return res.status(422).json({
                success: false,
                message: "Nao e possivel finalizar pedido sem itens no checkout."
            });
        }

        let totalPrice = 0;
        for (const item of items) {
            totalPrice += (item.price || 0) * (item.quantity || 1);
        }

        const orderId = `BB-${Date.now()}`;
        await db.run(
            `INSERT INTO orders (user_id, order_id, total_price, items_count, status) 
             VALUES (?, ?, ?, ?, 'completed')`,
            [userId, orderId, totalPrice, items.length]
        );

        // Clear cart after successful checkout
        await db.run(
            `DELETE FROM user_cart_items WHERE user_id = ?`,
            [userId]
        );

        return res.status(200).json({
            success: true,
            message: "Pedido finalizado com sucesso.",
            orderId,
            totalPrice: parseFloat(totalPrice.toFixed(2)),
            itemsCount: items.length
        });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Erro ao finalizar pedido." });
    }
});

const start = async () => {
    await ensureDbReady();

    app.listen(PORT, () => {
        console.log(`Bunny Bites auth API rodando em http://localhost:${PORT}`);
    });
};

const thisFilePath = fileURLToPath(import.meta.url);
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === thisFilePath;

if (isDirectRun) {
    start().catch((error) => {
        console.error("Falha ao iniciar API:", error);
        process.exit(1);
    });
}

app.use((error, _req, res, _next) => {
    if (res.headersSent) return;
    res.status(500).json({ success: false, message: error.message || "Erro interno no servidor." });
});

export default app;
