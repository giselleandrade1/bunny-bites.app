const AUTH_KEYS = {
    isLoggedIn: "isLoggedIn",
    currentUser: "currentUser",
    authToken: "authToken",
    redirectAfterLogin: "redirectAfterLogin",
    authMessage: "authMessage"
};

const API_CONFIG = {
    baseUrl: window.BUNNYBITES_API_BASE || "",
    loginPath: "/api/auth/login",
    registerPath: "/api/auth/register",
    timeoutMs: window.BUNNYBITES_API_TIMEOUT_MS || 7000,
    allowOfflineFallback: Boolean(window.BUNNYBITES_ALLOW_OFFLINE_FALLBACK),
    toastMaxVisible: Math.max(1, Number(window.BUNNYBITES_TOAST_MAX_VISIBLE) || 3),
    toastDurationMs: Math.max(1200, Number(window.BUNNYBITES_TOAST_DURATION_MS) || 2600),
    toastSwipeThresholdPx: Math.max(40, Number(window.BUNNYBITES_TOAST_SWIPE_THRESHOLD_PX) || 86),
    toastPosition: ["right", "left", "center"].includes(String(window.BUNNYBITES_TOAST_POSITION || "").toLowerCase())
        ? String(window.BUNNYBITES_TOAST_POSITION).toLowerCase()
        : "right",
    toastVertical: ["bottom", "top"].includes(String(window.BUNNYBITES_TOAST_VERTICAL || "").toLowerCase())
        ? String(window.BUNNYBITES_TOAST_VERTICAL).toLowerCase()
        : "bottom"
};

let checkoutItemsCache = [];
let catalogProductsCache = [];

const CATALOG_DATA_PATH = "assets/data/products.json";

const PROTECTED_ROUTES = ["cart.html", "wishlist.html", "checkout.html"];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const memoryStorageFallback = new Map();

const safeStorageGet = (storage, key) => {
    try {
        return storage.getItem(key);
    } catch {
        return null;
    }
};

const safeStorageSet = (storage, key, value) => {
    try {
        storage.setItem(key, value);
        return true;
    } catch {
        return false;
    }
};

const safeStorageRemove = (storage, key) => {
    try {
        storage.removeItem(key);
    } catch {
        // Ignore storage exceptions and rely on fallback.
    }
};

const storageGet = (key) => {
    const localValue = safeStorageGet(localStorage, key);
    if (localValue !== null) return localValue;

    const sessionValue = safeStorageGet(sessionStorage, key);
    if (sessionValue !== null) return sessionValue;

    return memoryStorageFallback.get(key) ?? null;
};

const storageSet = (key, value, persistent = true) => {
    if (persistent) {
        if (safeStorageSet(localStorage, key, value)) {
            safeStorageRemove(sessionStorage, key);
            memoryStorageFallback.delete(key);
            return;
        }

        if (safeStorageSet(sessionStorage, key, value)) {
            memoryStorageFallback.delete(key);
            return;
        }

        memoryStorageFallback.set(key, value);
        return;
    }

    if (safeStorageSet(sessionStorage, key, value)) {
        safeStorageRemove(localStorage, key);
        memoryStorageFallback.delete(key);
        return;
    }

    if (safeStorageSet(localStorage, key, value)) {
        memoryStorageFallback.delete(key);
        return;
    }

    memoryStorageFallback.set(key, value);
};

const storageRemove = (key) => {
    safeStorageRemove(localStorage, key);
    safeStorageRemove(sessionStorage, key);
    memoryStorageFallback.delete(key);
};

const isAuthenticated = () => storageGet(AUTH_KEYS.isLoggedIn) === "true";

const setAuthenticatedUser = (email, persistent = true, token = "") => {
    storageSet(AUTH_KEYS.isLoggedIn, "true", persistent);
    storageSet(AUTH_KEYS.currentUser, email, persistent);
    if (token) {
        storageSet(AUTH_KEYS.authToken, token, persistent);
    }
};

const clearAuthenticatedUser = () => {
    storageRemove(AUTH_KEYS.isLoggedIn);
    storageRemove(AUTH_KEYS.currentUser);
    storageRemove(AUTH_KEYS.authToken);
};

const requireAuthFor = (targetPath, message) => {
    storageSet(AUTH_KEYS.redirectAfterLogin, targetPath, true);
    storageSet(
        AUTH_KEYS.authMessage,
        message || "Faca login para continuar sua experiencia na Bunny Bites.",
        true
    );
    window.location.href = "login.html";
};

const showToast = (message, type = "success") => {
    if (!message) return;

    const fadeDistance = Math.max(140, API_CONFIG.toastSwipeThresholdPx * 2);

    const body = document.body;
    if (!body) return;

    let stack = document.querySelector("[data-toast-stack]");
    if (!stack) {
        stack = document.createElement("div");
        stack.className = "toast-stack";
        stack.setAttribute("data-toast-stack", "true");
        stack.dataset.position = API_CONFIG.toastPosition;
        stack.dataset.vertical = API_CONFIG.toastVertical;
        body.appendChild(stack);
    }

    while (stack.childElementCount >= API_CONFIG.toastMaxVisible) {
        stack.firstElementChild?.remove();
    }

    const toast = document.createElement("div");
    toast.className = `app-toast ${type === "error" ? "error" : "success"}`;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");

    const icon = document.createElement("span");
    icon.className = "toast-icon";
    icon.textContent = type === "error" ? "!" : "OK";

    const text = document.createElement("span");
    text.className = "toast-text";
    text.textContent = message;

    const close = document.createElement("button");
    close.className = "toast-close";
    close.type = "button";
    close.setAttribute("aria-label", "Fechar aviso");
    close.textContent = "x";

    toast.append(icon, text, close);
    stack.appendChild(toast);

    let removeTimer;
    let startX = 0;
    let deltaX = 0;
    let dragging = false;

    const hideToast = () => {
        clearTimeout(removeTimer);
        toast.classList.remove("is-visible");
        setTimeout(() => toast.remove(), 220);
    };

    const resetPosition = () => {
        toast.style.transform = "";
        toast.style.opacity = "";
    };

    close.addEventListener("click", hideToast);

    toast.addEventListener("pointerdown", (event) => {
        dragging = true;
        startX = event.clientX;
        deltaX = 0;
        toast.setPointerCapture(event.pointerId);
        toast.classList.add("is-dragging");
    });

    toast.addEventListener("pointermove", (event) => {
        if (!dragging) return;
        deltaX = event.clientX - startX;
        const absX = Math.abs(deltaX);
        toast.style.transform = `translateX(${deltaX}px)`;
        toast.style.opacity = String(Math.max(0.35, 1 - (absX / fadeDistance)));
    });

    toast.addEventListener("pointerup", () => {
        if (!dragging) return;
        dragging = false;
        toast.classList.remove("is-dragging");

        if (Math.abs(deltaX) > API_CONFIG.toastSwipeThresholdPx) {
            hideToast();
            return;
        }

        resetPosition();
    });

    toast.addEventListener("pointercancel", () => {
        dragging = false;
        toast.classList.remove("is-dragging");
        resetPosition();
    });

    requestAnimationFrame(() => toast.classList.add("is-visible"));

    removeTimer = setTimeout(hideToast, API_CONFIG.toastDurationMs);
};

const showActionFeedback = (message, type = "success") => {
    const status = ensureProtectedStatus();
    if (status) {
        status.textContent = message;
        status.classList.remove(type === "error" ? "success" : "error");
        status.classList.add(type);
        return;
    }
    showToast(message, type);
};

const getCurrentPage = () => {
    const path = window.location.pathname.split("/").pop();
    return path || "index.html";
};

const normalizeText = (value = "") => {
    return String(value)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
};

const extractPriceFromText = (text = "") => {
    const match = String(text).match(/(\d+[\.,]\d{2})/);
    if (!match) return 0;
    return Number(match[1].replace(",", ".")) || 0;
};

const ensureSiteChrome = () => {
    const body = document.body;
    const main = document.querySelector("main");
    if (!body || !main || body.classList.contains("auth-body")) return;

    if (!document.querySelector(".store-header")) {
        const header = document.createElement("header");
        header.className = "store-header";
        const accountAction = isAuthenticated()
            ? '<a class="btn btn-soft" href="#" data-auth-logout>Sair</a>'
            : '<a class="btn btn-soft" href="login.html">Entrar</a>';

        header.innerHTML = `
            <div class="container header-row">
                <a href="index.html" class="brand-link" aria-label="Bunny Bites - Inicio">
                    <span class="brand-icon">🐇</span>
                    <span>
                        <strong>Bunny Bites</strong>
                        <small>A magia mais doce da Pascoa</small>
                    </span>
                </a>

                <button id="mobileMenuToggle" class="menu-toggle" type="button" aria-expanded="false"
                    aria-controls="primaryNav" aria-label="Abrir menu principal">Menu</button>

                <nav id="primaryNav" class="store-nav" aria-label="Navegacao principal">
                    <a href="index.html">Inicio</a>
                    <a href="products.html">Produtos</a>
                    <a href="product-details.html">Detalhes</a>
                    <a href="about.html">Sobre</a>
                    <a href="contact.html">Contato</a>
                    <a href="wishlist.html" data-protected-target="wishlist.html"
                        data-protected-message="Entre na sua conta para salvar favoritos.">Wishlist</a>
                    <a href="cart.html" data-protected-target="cart.html"
                        data-protected-message="Faca login para acessar seu carrinho.">Carrinho</a>
                </nav>

                <div class="header-actions">
                    ${accountAction}
                </div>
            </div>
        `;
        body.insertBefore(header, main);
    }

    if (!document.querySelector(".store-footer")) {
        const footer = document.createElement("footer");
        footer.className = "store-footer";
        footer.innerHTML = `
            <div class="container footer-row">
                <p>© 2026 Bunny Bites. Todos os direitos reservados.</p>
                <div class="footer-links">
                    <a href="about.html">Sobre</a>
                    <a href="contact.html">Contato</a>
                    <a href="login.html">Minha conta</a>
                </div>
            </div>
        `;
        body.appendChild(footer);
    }
};

const guardProtectedPage = () => {
    const page = getCurrentPage();
    const explicitlyProtected = document.body.dataset.protectedPage === "true";

    if ((PROTECTED_ROUTES.includes(page) || explicitlyProtected) && !isAuthenticated()) {
        requireAuthFor(page, "Entre na sua conta para continuar sua compra com seguranca.");
    }
};

const setupProtectedActions = () => {
    const protectedTriggers = document.querySelectorAll("[data-protected-target]");

    const parsePrice = (text = "") => {
        const normalized = String(text)
            .replace(/\s+/g, "")
            .replace(/[^\d,.-]/g, "")
            .replace(/\.(?=\d{3}(\D|$))/g, "")
            .replace(",", ".");
        const value = Number(normalized);
        return Number.isFinite(value) ? value : 0;
    };

    const inferProductContext = (trigger) => {
        const card = trigger.closest(".product-card");
        if (!card) return { name: "", price: 0 };

        const title = card.querySelector("h3")?.textContent?.trim() || "";
        const priceText = card.querySelector(".price-tag")?.textContent
            || card.querySelector("p")?.textContent
            || "";

        return {
            name: title,
            price: parsePrice(priceText)
        };
    };

    protectedTriggers.forEach((trigger) => {
        trigger.addEventListener("click", async (event) => {
            const target = trigger.dataset.protectedTarget;
            const inProductCard = Boolean(trigger.closest(".product-card"));
            const label = (trigger.textContent || "").toLowerCase();
            const isAddToCartTrigger = trigger.dataset.addToCart === "true"
                || (inProductCard && target === "cart.html" && (label.includes("comprar") || label.includes("adicionar")));
            const isAddToWishlistTrigger = trigger.dataset.addToWishlist === "true"
                || (inProductCard && target === "wishlist.html" && label.includes("favorit"));
            const inferredProduct = inferProductContext(trigger);
            const productName = trigger.dataset.productName || inferredProduct.name;
            const productPrice = Number(trigger.dataset.productPrice || inferredProduct.price || 0);

            if (isAddToCartTrigger) {
                event.preventDefault();
                const result = await addToCart(productName, productPrice);
                if (result.ok) {
                    showActionFeedback("Produto adicionado ao carrinho.", "success");
                } else {
                    showActionFeedback(result.message || "Nao foi possivel adicionar ao carrinho.", "error");
                }
                return;
            }

            if (isAddToWishlistTrigger) {
                event.preventDefault();
                const result = await addToWishlist(productName, productPrice);
                if (result.ok) {
                    showActionFeedback("Produto adicionado a wishlist.", "success");
                } else {
                    showActionFeedback(result.message || "Nao foi possivel adicionar a wishlist.", "error");
                }
                return;
            }

            if (!target) return;

            if (!isAuthenticated()) {
                event.preventDefault();
                const message = trigger.dataset.protectedMessage
                    || "Faca login para continuar sua compra na Bunny Bites.";
                requireAuthFor(target, message);
                return;
            }

            if (trigger.tagName !== "A") {
                window.location.href = target;
            }
        });
    });
};

const setupMobileMenu = () => {
    const toggle = document.getElementById("mobileMenuToggle");
    const nav = document.getElementById("primaryNav");
    if (!toggle || !nav) return;

    const closeMenu = () => {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
    };

    const syncMenuMode = () => {
        const shouldCollapse = window.matchMedia("(max-width: 900px)").matches;
        if (shouldCollapse) {
            nav.classList.add("is-collapsible");
            closeMenu();
            return;
        }

        nav.classList.remove("is-collapsible", "is-open");
        toggle.setAttribute("aria-expanded", "false");
    };

    syncMenuMode();
    window.addEventListener("resize", syncMenuMode);

    toggle.addEventListener("click", () => {
        if (!nav.classList.contains("is-collapsible")) return;
        const isOpen = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(isOpen));
    });

    nav.querySelectorAll("a").forEach((link) => {
        link.addEventListener("click", closeMenu);
    });

    document.addEventListener("click", (event) => {
        if (!nav.classList.contains("is-open")) return;
        if (nav.contains(event.target) || toggle.contains(event.target)) return;
        closeMenu();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        if (!nav.classList.contains("is-open")) return;
        closeMenu();
        toggle.focus();
    });
};

const setupLogoutActions = () => {
    const logoutTriggers = document.querySelectorAll("[data-auth-logout]");

    const requestLogoutApi = async () => {
        const token = storageGet(AUTH_KEYS.authToken);
        const url = buildApiUrl("/api/auth/logout");

        if (!token || !url) {
            return;
        }

        let timeoutId;

        try {
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);

            await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({}),
                signal: controller.signal
            });
        } catch {
            // Mesmo com falha de rede, a sessao local deve ser encerrada.
        } finally {
            clearTimeout(timeoutId);
        }
    };

    logoutTriggers.forEach((trigger) => {
        trigger.addEventListener("click", async (event) => {
            event.preventDefault();
            trigger.setAttribute("aria-busy", "true");
            await requestLogoutApi();
            clearAuthenticatedUser();
            window.location.href = "index.html";
        });
    });
};

const setupCurrentUserLabel = () => {
    const userLabel = document.querySelector("[data-current-user]");
    if (!userLabel) return;
    const email = storageGet(AUTH_KEYS.currentUser);

    if (email) {
        userLabel.textContent = email;
        return;
    }

    userLabel.textContent = "Visitante";
};

const setupNewsletter = () => {
    const form = document.getElementById("newsletterForm");
    const emailInput = document.getElementById("newsletterEmail");
    const message = document.getElementById("newsletterMessage");
    if (!form || !emailInput || !message) return;

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        const value = emailInput.value.trim();

        if (!emailPattern.test(value)) {
            message.textContent = "Digite um e-mail valido para receber novidades.";
            message.className = "status-text error";
            emailInput.focus();
            return;
        }

        message.textContent = "Cadastro realizado com sucesso. Voce recebera nossas novidades por e-mail.";
        message.className = "status-text success";
        form.reset();
    });
};

const setupCheckoutActions = () => {
    const confirmButton = document.querySelector("[data-confirm-order]");
    if (!confirmButton) return;

    const checkoutForm = document.getElementById("checkoutForm");

    const validateCheckoutForm = () => {
        if (!checkoutForm) return true;

        const name = document.getElementById("checkoutName")?.value.trim() || "";
        const address = document.getElementById("checkoutAddress")?.value.trim() || "";
        const city = document.getElementById("checkoutCity")?.value.trim() || "";
        const payment = document.getElementById("checkoutPayment")?.value || "";

        if (name.split(" ").filter(Boolean).length < 2) {
            document.getElementById("checkoutName")?.focus();
            return false;
        }

        if (address.length < 8) {
            document.getElementById("checkoutAddress")?.focus();
            return false;
        }

        if (city.length < 2) {
            document.getElementById("checkoutCity")?.focus();
            return false;
        }

        if (!payment) {
            document.getElementById("checkoutPayment")?.focus();
            return false;
        }

        return checkoutForm.checkValidity();
    };

    confirmButton.addEventListener("click", async (event) => {
        event.preventDefault();

        if (!isAuthenticated()) {
            requireAuthFor("checkout.html", "Entre para confirmar seu pedido.");
            return;
        }

        const status = ensureProtectedStatus();

        if (!validateCheckoutForm()) {
            if (status) {
                status.textContent = "Preencha corretamente os dados de entrega e pagamento.";
                status.classList.remove("success");
                status.classList.add("error");
            }
            return;
        }

        if (buildApiUrl("/api/checkout")) {
            const submitItems = Array.isArray(checkoutItemsCache) && checkoutItemsCache.length
                ? checkoutItemsCache
                : [{ id: "prod-1", name: "Item Bunny Bites", quantity: 1, price: 1 }];

            confirmButton.disabled = true;
            const originalText = confirmButton.textContent;
            confirmButton.textContent = "Processando pedido...";

            const result = await requestProtectedApi("/api/checkout", {
                method: "POST",
                body: JSON.stringify({ items: submitItems })
            });

            if (result.unauthorized) {
                handleUnauthorizedSession(result.message || "Sessao expirada. Entre novamente.");
                return;
            }

            if (!result.ok) {
                if (status) {
                    status.textContent = result.message || "Nao foi possivel finalizar o pedido.";
                    status.classList.remove("success");
                    status.classList.add("error");
                }

                confirmButton.textContent = originalText;
                confirmButton.disabled = false;
                return;
            }

            if (status) {
                status.textContent = result.data?.message || "Pedido confirmado com sucesso.";
                status.classList.remove("error");
                status.classList.add("success");
            }

            confirmButton.textContent = "Pedido confirmado";
            setTimeout(() => {
                confirmButton.textContent = originalText;
                confirmButton.disabled = false;
            }, 2200);

            return;
        }

        confirmButton.disabled = true;
        const originalText = confirmButton.textContent;
        confirmButton.textContent = "Pedido confirmado";

        setTimeout(() => {
            confirmButton.textContent = originalText;
            confirmButton.disabled = false;
        }, 2200);
    });
};

const showAuthNotice = () => {
    const notice = document.getElementById("authNotice");
    if (!notice) return;

    const storedMessage = storageGet(AUTH_KEYS.authMessage);
    if (storedMessage) {
        notice.textContent = storedMessage;
        storageRemove(AUTH_KEYS.authMessage);
    }
};

const buildApiUrl = (path) => {
    if (!API_CONFIG.baseUrl) return "";
    return `${API_CONFIG.baseUrl.replace(/\/$/, "")}${path}`;
};

const readJsonSafely = async (response) => {
    try {
        return await response.json();
    } catch {
        return {};
    }
};

const handleUnauthorizedSession = (message) => {
    clearAuthenticatedUser();
    storageSet(
        AUTH_KEYS.authMessage,
        message || "Sua sessao expirou. Entre novamente para continuar.",
        true
    );
    window.location.href = "login.html";
};

const requestProtectedApi = async (path, options = {}) => {
    const url = buildApiUrl(path);
    if (!url) {
        return { ok: false, skipped: true, message: "API indisponivel no momento." };
    }

    const token = storageGet(AUTH_KEYS.authToken);
    if (!token) {
        return { ok: false, unauthorized: true, message: "Sessao invalida. Faca login novamente." };
    }

    let timeoutId;

    try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);

        const response = await fetch(url, {
            method: options.method || "GET",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
                ...(options.headers || {})
            },
            body: options.body,
            signal: controller.signal
        });

        const data = await readJsonSafely(response);

        if (response.status === 401) {
            return {
                ok: false,
                unauthorized: true,
                message: data.message || "Sessao expirada. Entre novamente."
            };
        }

        if (!response.ok) {
            return {
                ok: false,
                unauthorized: false,
                message: data.message || "Nao foi possivel concluir a operacao.",
                data
            };
        }

        return { ok: true, unauthorized: false, data, message: data.message || "Sucesso." };
    } catch {
        return {
            ok: false,
            unauthorized: false,
            message: "Falha de conexao com o servidor. Tente novamente."
        };
    } finally {
        clearTimeout(timeoutId);
    }
};

const formatCurrencyBRL = (value) => {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL"
    }).format(Number(value) || 0);
};

const getCategoryBadgeMeta = (category = "") => {
    const normalized = normalizeText(category);
    if (normalized === "recheados") {
        return { key: "recheados", label: "Recheados" };
    }
    if (normalized === "kits") {
        return { key: "kits", label: "Kits" };
    }
    if (normalized === "especiais") {
        return { key: "especiais", label: "Especiais" };
    }
    return { key: "ovos", label: "Ovos" };
};

const escapeHtml = (value = "") => String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const inferCategoryFromProduct = (name = "", explicitCategory = "") => {
    const normalizedCategory = normalizeText(explicitCategory);
    if (["ovos", "recheados", "kits", "especiais"].includes(normalizedCategory)) {
        return normalizedCategory;
    }

    if (/(ovos?|classico)/.test(normalizedCategory)) return "ovos";
    if (/(recheado|trufa|brownie)/.test(normalizedCategory)) return "recheados";
    if (/(kit|presente|cesta)/.test(normalizedCategory)) return "kits";
    if (/(especial|premium|gourmet|deluxe)/.test(normalizedCategory)) return "especiais";

    const text = normalizeText(name);
    if (/(kit|combo|cesta|caixa|lata)/.test(text)) return "kits";
    if (/(trufa|reche|ganache|mousse|brigadeiro|cookies|creme)/.test(text)) return "recheados";
    if (/(deluxe|supreme|signature|premium|especial|gourmet)/.test(text)) return "especiais";
    return "ovos";
};

const normalizeCatalogProduct = (product, index = 0) => {
    const productId = Number(product?.id) || (index + 1);
    const bounded = Math.max(1, Math.min(12, productId));
    const name = String(product?.name || "Produto Bunny Bites").trim();
    const price = Number(product?.price) || 0;
    const image = String(product?.image || getProductImageById(String(bounded))).trim();

    return {
        id: bounded,
        slug: String(product?.slug || `produto-${bounded}`).trim(),
        name,
        price,
        category: inferCategoryFromProduct(name, product?.category || ""),
        categoryLabel: String(product?.category || "").trim(),
        rating: Number(product?.rating) || 0,
        reviews: Number(product?.reviews) || 0,
        badge: String(product?.badge || "").trim(),
        alt: String(product?.alt || name).trim(),
        weight: String(product?.weight || "").trim(),
        description: String(product?.description || "").trim(),
        image
    };
};

const loadCatalogProducts = async () => {
    if (Array.isArray(catalogProductsCache) && catalogProductsCache.length) {
        return catalogProductsCache;
    }

    let timeoutId;

    try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);
        const response = await fetch(CATALOG_DATA_PATH, {
            method: "GET",
            signal: controller.signal,
            cache: "no-store"
        });

        if (!response.ok) {
            return [];
        }

        const data = await response.json();
        if (!Array.isArray(data)) {
            return [];
        }

        catalogProductsCache = data.map((item, index) => normalizeCatalogProduct(item, index));
        return catalogProductsCache;
    } catch {
        return [];
    } finally {
        clearTimeout(timeoutId);
    }
};

const getProductById = async (id) => {
    const numericId = Number(id);
    if (!numericId) return null;

    const products = await loadCatalogProducts();
    if (!products.length) return null;
    return products.find((item) => Number(item.id) === numericId) || null;
};

const hydrateCatalogGridFromData = async () => {
    const grid = document.querySelector("[data-catalog-grid]");
    if (!grid) return;

    const products = await loadCatalogProducts();
    if (!products.length) return;

    grid.innerHTML = products.map((product) => {
        const categoryMeta = getCategoryBadgeMeta(product.category);
        const detailsQuery = new URLSearchParams({ id: String(product.id) }).toString();
        const commercialBadge = product.badge
            ? `<span class="product-highlight-badge">${escapeHtml(product.badge)}</span>`
            : "";
        const ratingText = product.rating > 0
            ? `<p class="product-rating" aria-label="Avaliacao media ${product.rating.toFixed(1)} de 5 baseada em ${product.reviews} avaliacoes">★ ${product.rating.toFixed(1)} (${product.reviews})</p>`
            : "";
        const addWishlistAction = product.category === "kits" || product.category === "especiais"
            ? `<a class="btn btn-soft" href="wishlist.html" data-protected-target="wishlist.html"
                            data-protected-message="Entre para salvar seus favoritos.">Favoritar</a>`
            : "";

        return `
                <article class="product-card" data-product-id="${product.id}" data-product-category="${escapeHtml(product.category)}">
                    <img class="product-media" src="${escapeHtml(product.image)}"
                        alt="${escapeHtml(product.alt || product.name)}" loading="lazy" />
                    <div class="product-badge-row">
                        <span class="product-category-badge is-${categoryMeta.key}">${escapeHtml(categoryMeta.label)}</span>
                        ${commercialBadge}
                    </div>
                    <h3>${escapeHtml(product.name)}</h3>
                    <p class="price-tag">${formatCurrencyBRL(product.price)}</p>
                    ${ratingText}
                    <div class="product-actions">
                        <a class="btn btn-soft" href="product-details.html?${detailsQuery}">Ver detalhes</a>
                        ${addWishlistAction}
                        <a class="btn btn-primary" href="cart.html" data-protected-target="cart.html"
                            data-protected-message="Faca login para adicionar produtos ao carrinho.">Adicionar ao
                            carrinho</a>
                    </div>
                </article>
        `;
    }).join("");
};

const getProductImageById = (id = "") => {
    const numericId = String(id).match(/(\d+)/)?.[1] || "1";
    const bounded = Math.max(1, Math.min(12, Number(numericId)));
    return `assets/images/products/product-${bounded}.jpg`;
};

const ensureProtectedStatus = () => {
    const container = document.querySelector(".protected-page");
    if (!container) return null;

    let status = container.querySelector("[data-protected-status]");
    if (!status) {
        status = document.createElement("p");
        status.className = "status-message";
        status.setAttribute("data-protected-status", "true");
        container.insertBefore(status, container.querySelector(".section-block") || null);
    }

    return status;
};

const addToCart = async (productName, productPrice) => {
    if (!isAuthenticated()) {
        requireAuthFor("cart.html", "Faca login para adicionar itens ao carrinho.");
        return { ok: false };
    }

    return requestProtectedApi("/api/cart/add", {
        method: "POST",
        body: JSON.stringify({
            productName: String(productName).trim(),
            productPrice: Number(productPrice) || 0,
            quantity: 1
        })
    });
};

const removeFromCart = async (itemId) => {
    if (!isAuthenticated()) return { ok: false };
    return requestProtectedApi(`/api/cart/remove/${itemId}`, { method: "DELETE" });
};

const addToWishlist = async (productName, productPrice) => {
    if (!isAuthenticated()) {
        requireAuthFor("wishlist.html", "Faca login para salvar itens na wishlist.");
        return { ok: false };
    }

    return requestProtectedApi("/api/wishlist/add", {
        method: "POST",
        body: JSON.stringify({
            productName: String(productName).trim(),
            productPrice: Number(productPrice) || 0
        })
    });
};

const removeFromWishlist = async (itemId) => {
    if (!isAuthenticated()) return { ok: false };
    return requestProtectedApi(`/api/wishlist/remove/${itemId}`, { method: "DELETE" });
};

const renderProtectedGrid = (grid, items, mode) => {
    if (!grid) return;

    if (!Array.isArray(items) || items.length === 0) {
        grid.innerHTML = "";
        const emptyCard = document.createElement("article");
        emptyCard.className = "product-card";
        emptyCard.innerHTML = `
            <h3>Nenhum item encontrado</h3>
            <p class="price-tag">Adicione produtos para continuar.</p>
        `;
        grid.appendChild(emptyCard);
        return;
    }

    grid.innerHTML = items.map((item) => {
        const name = item.name || "Produto Bunny Bites";
        const price = Number(item.price) || 0;
        const quantity = Number(item.quantity) || 1;
        const subtotal = price * quantity;
        const image = getProductImageById(item.id);
        const itemId = item.id || "0";

        if (mode === "cart") {
            return `
                <article class="product-card" data-cart-item-id="${itemId}">
                    <img class="product-media" src="${image}" alt="${name}" loading="lazy" />
                    <h3>${name}</h3>
                    <p class="price-tag">Qtd: ${quantity} • ${formatCurrencyBRL(price)}</p>
                    <div class="product-actions">
                        <button class="btn btn-soft" data-remove-from-cart="${itemId}">Remover</button>
                    </div>
                </article>
            `;
        }

        if (mode === "checkout") {
            return `
                <article class="product-card">
                    <img class="product-media" src="${image}" alt="${name}" loading="lazy" />
                    <h3>${name}</h3>
                    <p class="price-tag">Subtotal: ${formatCurrencyBRL(subtotal)}</p>
                </article>
            `;
        }

        return `
            <article class="product-card" data-wishlist-item-id="${itemId}">
                <img class="product-media" src="${image}" alt="${name}" loading="lazy" />
                <h3>${name}</h3>
                <p class="price-tag">${formatCurrencyBRL(price)}</p>
                <div class="product-actions">
                    <button class="btn btn-soft" data-remove-from-wishlist="${itemId}">Remover</button>
                </div>
            </article>
        `;
    }).join("");
};

const setupCartActions = () => {
    const removeButtons = document.querySelectorAll("[data-remove-from-cart]");
    removeButtons.forEach((button) => {
        button.addEventListener("click", async (event) => {
            event.preventDefault();
            const itemId = button.dataset.removeFromCart;
            if (!itemId) return;

            button.disabled = true;
            button.textContent = "Removendo...";

            const result = await removeFromCart(itemId);
            if (result.ok) {
                setTimeout(() => setupProtectedDataPages(), 250);
            } else {
                button.disabled = false;
                button.textContent = "Remover";
            }
        });
    });
};

const setupWishlistActions = () => {
    const removeButtons = document.querySelectorAll("[data-remove-from-wishlist]");
    removeButtons.forEach((button) => {
        button.addEventListener("click", async (event) => {
            event.preventDefault();
            const itemId = button.dataset.removeFromWishlist;
            if (!itemId) return;

            button.disabled = true;
            button.textContent = "Removendo...";

            const result = await removeFromWishlist(itemId);
            if (result.ok) {
                setTimeout(() => setupProtectedDataPages(), 250);
            } else {
                button.disabled = false;
                button.textContent = "Remover";
            }
        });
    });
};

const setupProtectedDataPages = async () => {
    const page = getCurrentPage();
    const supportedPages = new Set(["cart.html", "wishlist.html", "checkout.html"]);
    if (!supportedPages.has(page)) return;

    const status = ensureProtectedStatus();
    const grid = document.querySelector(".protected-page .product-grid");
    if (!grid) return;

    const protectedEndpointByPage = {
        "cart.html": "/api/cart",
        "wishlist.html": "/api/wishlist",
        "checkout.html": "/api/cart"
    };

    const endpoint = protectedEndpointByPage[page];
    if (!endpoint) return;

    if (!buildApiUrl(endpoint)) {
        if (status) {
            status.textContent = "API desabilitada. Exibindo conteudo local da pagina.";
            status.classList.remove("error");
            status.classList.add("success");
        }
        return;
    }

    if (status) {
        status.textContent = "Sincronizando dados com seu perfil...";
        status.classList.remove("success", "error");
    }

    const result = await requestProtectedApi(endpoint);

    if (result.unauthorized) {
        handleUnauthorizedSession(result.message || "Sessao expirada. Entre novamente.");
        return;
    }

    if (!result.ok) {
        if (status) {
            status.textContent = result.message || "Nao foi possivel carregar seus dados agora.";
            status.classList.remove("success");
            status.classList.add("error");
        }
        return;
    }

    const items = Array.isArray(result.data?.items) ? result.data.items : [];
    if (page === "checkout.html") {
        checkoutItemsCache = items;
        renderProtectedGrid(grid, items, "checkout");
    } else if (page === "cart.html") {
        checkoutItemsCache = items;
        renderProtectedGrid(grid, items, "cart");
        setupCartActions();
    } else {
        renderProtectedGrid(grid, items, "wishlist");
        setupWishlistActions();
    }

    if (status) {
        status.textContent = result.data?.message || "Dados atualizados com sucesso.";
        status.classList.remove("error");
        status.classList.add("success");
    }
};

const setupProductCatalogActions = () => {
    const grid = document.querySelector("[data-catalog-grid]");
    if (!grid) return;

    const productCards = grid.querySelectorAll(".product-card");
    productCards.forEach((card) => {
        const titleEl = card.querySelector("h3");
        const priceEl = card.querySelector(".price-tag");
        const productName = titleEl?.textContent?.trim() || "Produto Bunny Bites";
        const productPrice = Number((priceEl?.textContent || "").replace(/[^\d,]/g, "").replace(",", ".")) || 0;

        const addCartLink = card.querySelector('a[href="cart.html"]');
        if (addCartLink) {
            addCartLink.dataset.addToCart = "true";
            addCartLink.dataset.productName = productName;
            addCartLink.dataset.productPrice = String(productPrice);
        }

        const favLink = card.querySelector('a[href="wishlist.html"]');
        if (favLink) {
            favLink.dataset.addToWishlist = "true";
            favLink.dataset.productName = productName;
            favLink.dataset.productPrice = String(productPrice);
        }
    });
};

const setupProductDetailLinks = () => {
    const cards = document.querySelectorAll(".product-card");
    cards.forEach((card) => {
        const productId = card.dataset.productId
            || (card.querySelector(".product-media")?.getAttribute("src")?.match(/product-(\d+)/)?.[1] || "");
        const name = card.querySelector("h3")?.textContent?.trim();
        const priceText = card.querySelector(".price-tag, p")?.textContent || "";
        const image = card.querySelector(".product-media")?.getAttribute("src") || "";
        if (!name) return;

        const detailLink = card.querySelector('.product-actions a[href="product-details.html"]');
        if (!detailLink) return;

        const params = new URLSearchParams({
            id: String(productId || ""),
            name,
            price: String(extractPriceFromText(priceText) || ""),
            image
        });
        detailLink.href = `product-details.html?${params.toString()}`;
    });
};

const setupProductDetailsPage = async () => {
    if (getCurrentPage() !== "product-details.html") return;

    const params = new URLSearchParams(window.location.search);
    const id = Number(params.get("id") || 0);
    const name = params.get("name");
    const price = Number(params.get("price") || 0);
    const image = params.get("image");

    let selectedProduct = null;
    if (id) {
        selectedProduct = await getProductById(id);
    }

    if (!selectedProduct && !name && !price && !image) return;

    const mainCard = document.querySelector(".product-grid .product-card");
    if (!mainCard) return;

    const title = mainCard.querySelector("h3");
    const priceTag = mainCard.querySelector(".price-tag");
    const media = mainCard.querySelector(".product-media");
    let badge = mainCard.querySelector("[data-product-badge]");
    let highlightBadge = mainCard.querySelector("[data-product-highlight-badge]");
    let ratingNode = mainCard.querySelector("[data-product-rating]");
    const favBtn = document.querySelector('[data-add-to-wishlist="true"]');
    const cartBtn = document.querySelector('[data-add-to-cart="true"]');

    const resolvedName = selectedProduct?.name || name || "Produto Bunny Bites";
    const resolvedPrice = Number(selectedProduct?.price) || price;
    const resolvedImage = selectedProduct?.image || image || "";
    const resolvedWeight = selectedProduct?.weight || "350g";
    const resolvedDescription = selectedProduct?.description || "Chocolate ao leite premium.";
    const resolvedCategory = selectedProduct?.category || inferCatalogCategory(resolvedName);
    const categoryMeta = getCategoryBadgeMeta(resolvedCategory);
    const resolvedBadge = selectedProduct?.badge || "";
    const resolvedRating = Number(selectedProduct?.rating) || 0;
    const resolvedReviews = Number(selectedProduct?.reviews) || 0;
    const resolvedAlt = selectedProduct?.alt || `${resolvedName} em destaque`;

    if (!badge && title) {
        badge = document.createElement("span");
        badge.setAttribute("data-product-badge", "true");
        title.insertAdjacentElement("afterend", badge);
    }

    if (badge) {
        badge.className = `product-category-badge is-${categoryMeta.key}`;
        badge.textContent = categoryMeta.label;
    }

    if (title) title.textContent = resolvedName;
    if (priceTag && Number.isFinite(resolvedPrice) && resolvedPrice > 0) {
        priceTag.textContent = `${resolvedWeight} • ${resolvedDescription} • ${formatCurrencyBRL(resolvedPrice)}`;
    }
    if (media && resolvedImage) {
        media.setAttribute("src", resolvedImage);
        media.setAttribute("alt", resolvedAlt);
    }

    if (!highlightBadge && badge) {
        highlightBadge = document.createElement("span");
        highlightBadge.setAttribute("data-product-highlight-badge", "true");
        badge.insertAdjacentElement("afterend", highlightBadge);
    }

    if (highlightBadge) {
        if (resolvedBadge) {
            highlightBadge.className = "product-highlight-badge";
            highlightBadge.textContent = resolvedBadge;
            highlightBadge.hidden = false;
        } else {
            highlightBadge.hidden = true;
        }
    }

    if (!ratingNode && priceTag) {
        ratingNode = document.createElement("p");
        ratingNode.setAttribute("data-product-rating", "true");
        ratingNode.className = "product-rating";
        priceTag.insertAdjacentElement("afterend", ratingNode);
    }

    if (ratingNode) {
        if (resolvedRating > 0) {
            ratingNode.textContent = `★ ${resolvedRating.toFixed(1)} (${resolvedReviews})`;
            ratingNode.hidden = false;
        } else {
            ratingNode.hidden = true;
        }
    }

    if (favBtn) {
        favBtn.dataset.productName = resolvedName;
        if (resolvedPrice > 0) favBtn.dataset.productPrice = String(resolvedPrice);
    }

    if (cartBtn) {
        cartBtn.dataset.productName = resolvedName;
        if (resolvedPrice > 0) cartBtn.dataset.productPrice = String(resolvedPrice);
    }
};

const inferCatalogCategory = (name = "") => {
    const text = normalizeText(name);
    if (/(kit|combo|cesta|caixa|lata)/.test(text)) return "kits";
    if (/(trufa|reche|ganache|mousse|brigadeiro|cookies|creme)/.test(text)) return "recheados";
    if (/(deluxe|supreme|signature|premium|especial|gourmet)/.test(text)) return "especiais";
    return "ovos";
};

const setupCatalog = () => {
    const grid = document.querySelector("[data-catalog-grid]");
    if (!grid) return;

    const allCards = Array.from(grid.querySelectorAll(".product-card"));
    if (!allCards.length) return;

    const filterButtons = Array.from(document.querySelectorAll("[data-catalog-filter]"));
    const searchInput = document.querySelector("[data-catalog-search]");
    const sortSelect = document.querySelector("[data-catalog-sort]");
    const statusLabel = document.getElementById("catalogStatus");
    const pageIndicator = document.querySelector("[data-page-indicator]");
    const prevButton = document.querySelector("[data-page-prev]");
    const nextButton = document.querySelector("[data-page-next]");

    allCards.forEach((card) => {
        const title = card.querySelector("h3")?.textContent?.trim() || "";
        const priceText = card.querySelector(".price-tag")?.textContent || "";
        const category = inferCategoryFromProduct(title, card.dataset.productCategory || card.dataset.catalogCategory || "");
        const normalized = normalizeText(title);
        const price = extractPriceFromText(priceText);
        card.dataset.catalogCategory = category;
        card.dataset.catalogName = normalized;
        card.dataset.catalogPrice = String(price);
    });

    let currentFilter = "all";
    let currentSort = sortSelect?.value || "featured";
    let currentQuery = "";
    let currentPage = 1;
    const pageSize = 24;

    const sortedCards = (cards) => {
        const list = [...cards];
        if (currentSort === "name-asc") {
            list.sort((a, b) => (a.dataset.catalogName || "").localeCompare(b.dataset.catalogName || "", "pt-BR"));
        } else if (currentSort === "name-desc") {
            list.sort((a, b) => (b.dataset.catalogName || "").localeCompare(a.dataset.catalogName || "", "pt-BR"));
        } else if (currentSort === "price-asc") {
            list.sort((a, b) => Number(a.dataset.catalogPrice || 0) - Number(b.dataset.catalogPrice || 0));
        } else if (currentSort === "price-desc") {
            list.sort((a, b) => Number(b.dataset.catalogPrice || 0) - Number(a.dataset.catalogPrice || 0));
        }
        return list;
    };

    const filteredCards = () => {
        return allCards.filter((card) => {
            const category = card.dataset.catalogCategory || "ovos";
            const name = card.dataset.catalogName || "";
            const byFilter = currentFilter === "all" || category === currentFilter;
            const bySearch = !currentQuery || name.includes(currentQuery);
            return byFilter && bySearch;
        });
    };

    const updateFilterButtons = () => {
        filterButtons.forEach((button) => {
            const value = button.dataset.catalogFilter || "all";
            button.classList.toggle("is-active", value === currentFilter);
        });
    };

    const render = () => {
        const list = sortedCards(filteredCards());
        const total = list.length;
        const totalPages = Math.max(1, Math.ceil(total / pageSize));
        currentPage = Math.min(currentPage, totalPages);

        const start = (currentPage - 1) * pageSize;
        const visible = new Set(list.slice(start, start + pageSize));

        [...list, ...allCards.filter((card) => !list.includes(card))].forEach((card) => grid.appendChild(card));
        allCards.forEach((card) => {
            card.style.display = visible.has(card) ? "" : "none";
        });

        const visibleCount = visible.size;
        if (statusLabel) {
            if (!total) {
                statusLabel.textContent = currentQuery
                    ? "Nenhum produto encontrado para esta busca."
                    : "Nenhum produto encontrado para este filtro.";
            } else if (currentFilter === "all" && !currentQuery) {
                statusLabel.textContent = `Mostrando ${visibleCount} de ${allCards.length} produtos.`;
            } else {
                statusLabel.textContent = `Mostrando ${visibleCount} de ${total} produtos para os filtros aplicados.`;
            }
        }

        if (pageIndicator) pageIndicator.textContent = `Pagina ${currentPage} de ${totalPages}`;
        if (prevButton) prevButton.disabled = currentPage <= 1 || total === 0;
        if (nextButton) nextButton.disabled = currentPage >= totalPages || total === 0;
        updateFilterButtons();
    };

    filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const nextFilter = button.dataset.catalogFilter || "all";
            if (nextFilter === currentFilter) return;
            currentFilter = nextFilter;
            currentPage = 1;
            render();
        });
    });

    searchInput?.addEventListener("input", () => {
        currentQuery = normalizeText(searchInput.value || "");
        currentPage = 1;
        render();
    });

    sortSelect?.addEventListener("change", () => {
        currentSort = sortSelect.value || "featured";
        currentPage = 1;
        render();
    });

    prevButton?.addEventListener("click", () => {
        if (currentPage <= 1) return;
        currentPage -= 1;
        render();
    });

    nextButton?.addEventListener("click", () => {
        const totalPages = Math.max(1, Math.ceil(filteredCards().length / pageSize));
        if (currentPage >= totalPages) return;
        currentPage += 1;
        render();
    });

    render();
};

const setupContactForm = () => {
    const form = document.getElementById("contactForm");
    if (!form) return;

    const nameInput = document.getElementById("contactName");
    const emailInput = document.getElementById("contactEmail");
    const messageInput = document.getElementById("contactMessage");
    const status = document.getElementById("contactStatus");
    if (!nameInput || !emailInput || !messageInput || !status) return;

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        status.classList.remove("error", "success");

        const name = nameInput.value.trim();
        const email = emailInput.value.trim();
        const messageValue = messageInput.value.trim();

        if (name.split(" ").filter(Boolean).length < 2) {
            status.textContent = "Digite nome e sobrenome para contato.";
            status.classList.add("error");
            nameInput.focus();
            return;
        }

        if (!emailPattern.test(email)) {
            status.textContent = "Digite um e-mail valido.";
            status.classList.add("error");
            emailInput.focus();
            return;
        }

        if (messageValue.length < 12) {
            status.textContent = "Escreva uma mensagem com pelo menos 12 caracteres.";
            status.classList.add("error");
            messageInput.focus();
            return;
        }

        status.textContent = "Mensagem enviada com sucesso. Retornaremos em breve.";
        status.classList.add("success");
        form.reset();
    });
};

const setupSmoothAnchorLinks = () => {
    const links = document.querySelectorAll('a[href^="#"]');
    if (!links.length) return;

    links.forEach((link) => {
        link.addEventListener("click", (event) => {
            const targetId = link.getAttribute("href");
            if (!targetId || targetId === "#") return;

            const target = document.querySelector(targetId);
            if (!target) return;

            event.preventDefault();
            target.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    });
};

const setupImageFallbacks = () => {
    const images = document.querySelectorAll("img");
    if (!images.length) return;

    const buildInlinePlaceholder = (label = "Bunny Bites") => {
        const safeLabel = String(label || "Bunny Bites").slice(0, 40);
        const svg = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 900" role="img" aria-label="${safeLabel}">
                <defs>
                    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#f6eaf3"/>
                        <stop offset="100%" stop-color="#cfc2df"/>
                    </linearGradient>
                </defs>
                <rect width="1200" height="900" fill="url(#g)"/>
                <circle cx="1020" cy="150" r="170" fill="#ffffff" fill-opacity="0.26"/>
                <circle cx="180" cy="760" r="210" fill="#ffffff" fill-opacity="0.24"/>
                <text x="50%" y="47%" text-anchor="middle" font-family="Avenir, Segoe UI, sans-serif" font-size="68" fill="#5f487b" font-weight="700">Bunny Bites</text>
                <text x="50%" y="57%" text-anchor="middle" font-family="Avenir, Segoe UI, sans-serif" font-size="34" fill="#6d5a82">${safeLabel}</text>
            </svg>
        `;

        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    };

    images.forEach((img) => {
        const fallbackSrc = buildInlinePlaceholder(img.alt || "Imagem do produto");

        const applyFallback = () => {
            if (img.dataset.fallbackApplied === "true") return;
            img.dataset.fallbackApplied = "true";
            img.src = fallbackSrc;
        };

        img.addEventListener("error", applyFallback);

        if (img.complete && img.naturalWidth === 0) {
            applyFallback();
        }
    });
};

const requestAuthApi = async (path, payload) => {
    const url = buildApiUrl(path);
    if (!url) {
        return { ok: false, skipped: true };
    }

    let timeoutId;

    try {
        const controller = new AbortController();
        timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        let data = {};
        try {
            data = await response.json();
        } catch {
            data = {};
        }

        if (!response.ok) {
            return {
                ok: false,
                skipped: false,
                message: data.message || "Nao foi possivel autenticar no servidor."
            };
        }

        return {
            ok: true,
            skipped: false,
            message: data.message,
            userEmail: data.email || payload.email,
            token: data.token || ""
        };
    } catch {
        return {
            ok: false,
            skipped: false,
            message: "Servidor indisponivel no momento."
        };
    } finally {
        clearTimeout(timeoutId);
    }
};

const completeLogin = (email, persistent, token = "") => {
    setAuthenticatedUser(email, persistent, token);

    const next = storageGet(AUTH_KEYS.redirectAfterLogin) || "products.html";
    storageRemove(AUTH_KEYS.redirectAfterLogin);
    window.location.href = next;
};

const setupAuthForms = () => {
    const authCard = document.getElementById("authCard");
    const showSignUp = document.getElementById("showSignUp");
    const showSignIn = document.getElementById("showSignIn");
    const modeSwitchButtons = document.querySelectorAll("[data-switch-mode]");

    const signInForm = document.getElementById("signInForm");
    const signUpForm = document.getElementById("signUpForm");
    if (!signInForm || !signUpForm) return;

    const signInEmail = document.getElementById("signInEmail");
    const signInPassword = document.getElementById("signInPassword");
    const signInMessage = document.getElementById("signInMessage");
    const rememberSession = document.getElementById("rememberSession");
    const forgotLink = document.querySelector(".forgot-link");
    const signInCaptchaPrompt = document.getElementById("signInCaptchaPrompt");
    const signInCaptchaAnswer = document.getElementById("signInCaptchaAnswer");
    const signInCaptchaId = document.getElementById("signInCaptchaId");

    const signUpName = document.getElementById("signUpName");
    const signUpEmail = document.getElementById("signUpEmail");
    const signUpConfirmEmail = document.getElementById("signUpConfirmEmail");
    const signUpPassword = document.getElementById("signUpPassword");
    const signUpConfirmPassword = document.getElementById("signUpConfirmPassword");
    const acceptTerms = document.getElementById("acceptTerms");
    const signUpMessage = document.getElementById("signUpMessage");
    const signUpCaptchaPrompt = document.getElementById("signUpCaptchaPrompt");
    const signUpCaptchaAnswer = document.getElementById("signUpCaptchaAnswer");
    const signUpCaptchaId = document.getElementById("signUpCaptchaId");

    const passwordStrengthBar = document.getElementById("passwordStrengthBar");
    const passwordStrengthText = document.getElementById("passwordStrengthText");

    const setupPasswordToggles = () => {
        const toggles = document.querySelectorAll(".password-toggle[data-toggle-for]");

        toggles.forEach((toggle) => {
            toggle.addEventListener("click", () => {
                const inputId = toggle.dataset.toggleFor;
                const input = document.getElementById(inputId);
                if (!input) return;

                const isHidden = input.type === "password";
                input.type = isHidden ? "text" : "password";
                toggle.textContent = isHidden ? "Ocultar" : "Mostrar";
                toggle.setAttribute("aria-label", isHidden ? "Ocultar senha" : "Mostrar senha");
            });
        });
    };

    const toggleMode = (mode) => {
        authCard?.classList.toggle("is-sign-up", mode === "signup");
    };

    showSignUp?.addEventListener("click", () => toggleMode("signup"));
    showSignIn?.addEventListener("click", () => toggleMode("signin"));

    modeSwitchButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const mode = button.dataset.switchMode;
            if (mode !== "signup" && mode !== "signin") return;
            toggleMode(mode);
        });
    });

    forgotLink?.addEventListener("click", (event) => {
        event.preventDefault();
        signInMessage.textContent = "Recuperacao de senha sera enviada em breve para seu e-mail.";
        signInMessage.classList.remove("success", "error");
        signInMessage.classList.add("success");
    });

    const getFieldError = (inputId) => document.querySelector(`[data-error-for="${inputId}"]`);

    const clearInputError = (input) => {
        if (!input) return;
        input.classList.remove("input-error");
        input.removeAttribute("aria-invalid");

        const errorElement = getFieldError(input.id);
        if (errorElement) {
            errorElement.textContent = "";
        }
    };

    const setFieldError = (input, message) => {
        if (!input) return;
        input.classList.add("input-error");
        input.setAttribute("aria-invalid", "true");

        const errorElement = getFieldError(input.id);
        if (errorElement) {
            errorElement.textContent = message;
        }
    };

    const setCustomFieldError = (inputId, message) => {
        const errorElement = getFieldError(inputId);
        if (errorElement) {
            errorElement.textContent = message;
        }
    };

    const clearCustomFieldError = (inputId) => {
        const errorElement = getFieldError(inputId);
        if (errorElement) {
            errorElement.textContent = "";
        }
    };

    const clearMessages = () => {
        [signInMessage, signUpMessage].forEach((el) => {
            if (!el) return;
            el.textContent = "";
            el.classList.remove("success", "error");
        });
    };

    const setMessage = (element, message, type) => {
        if (!element) return;
        element.textContent = message;
        element.classList.remove("success", "error");
        element.classList.add(type);
    };

    const shake = (form) => {
        form.classList.remove("shake");
        requestAnimationFrame(() => form.classList.add("shake"));
    };

    const getPasswordScore = (value) => {
        let score = 0;
        if (value.length >= 8) score += 1;
        if (value.length >= 12) score += 1;
        if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
        if (/\d/.test(value)) score += 1;
        if (/[^A-Za-z0-9]/.test(value)) score += 1;
        return Math.min(score, 5);
    };

    const updatePasswordStrength = (value) => {
        if (!passwordStrengthBar || !passwordStrengthText) return;

        const score = getPasswordScore(value);
        let label = "fraca";
        let gradient = "linear-gradient(90deg, #ddb2c8 0%, #ddb2c8 20%, rgba(168, 141, 192, 0.22) 20%, rgba(168, 141, 192, 0.22) 100%)";

        if (score >= 4) {
            label = "forte";
            gradient = "linear-gradient(90deg, #69b89a 0%, #69b89a 100%)";
        } else if (score >= 3) {
            label = "media";
            gradient = "linear-gradient(90deg, #b3a04b 0%, #b3a04b 66%, rgba(168, 141, 192, 0.22) 66%, rgba(168, 141, 192, 0.22) 100%)";
        } else if (score >= 2) {
            label = "regular";
            gradient = "linear-gradient(90deg, #c18358 0%, #c18358 45%, rgba(168, 141, 192, 0.22) 45%, rgba(168, 141, 192, 0.22) 100%)";
        }

        passwordStrengthBar.style.background = gradient;
        passwordStrengthText.textContent = `Forca da senha: ${label}`;
    };

    const validateSignInEmail = () => {
        const value = signInEmail.value.trim();
        if (!emailPattern.test(value)) {
            setFieldError(signInEmail, "Digite um e-mail valido.");
            return false;
        }
        clearInputError(signInEmail);
        return true;
    };

    const validateSignInPassword = () => {
        const value = signInPassword.value.trim();
        if (!value) {
            setFieldError(signInPassword, "Digite sua senha.");
            return false;
        }
        if (value.length < 8) {
            setFieldError(signInPassword, "Sua senha deve ter no minimo 8 caracteres.");
            return false;
        }
        clearInputError(signInPassword);
        return true;
    };

    const validateSignUpName = () => {
        const value = signUpName.value.trim();
        const nameParts = value.split(" ").filter(Boolean);
        if (nameParts.length < 2) {
            setFieldError(signUpName, "Digite nome e sobrenome.");
            return false;
        }
        clearInputError(signUpName);
        return true;
    };

    const validateSignUpEmail = () => {
        const value = signUpEmail.value.trim();
        if (!emailPattern.test(value)) {
            setFieldError(signUpEmail, "Digite um e-mail valido.");
            return false;
        }
        clearInputError(signUpEmail);
        return true;
    };

    const validateSignUpConfirmEmail = () => {
        const emailValue = signUpEmail.value.trim();
        const confirmValue = signUpConfirmEmail?.value.trim() || "";

        if (!confirmValue) {
            setFieldError(signUpConfirmEmail, "Confirme seu e-mail.");
            return false;
        }

        if (!emailPattern.test(confirmValue)) {
            setFieldError(signUpConfirmEmail, "Digite um e-mail valido.");
            return false;
        }

        if (confirmValue !== emailValue) {
            setFieldError(signUpConfirmEmail, "Os e-mails nao coincidem.");
            return false;
        }

        clearInputError(signUpConfirmEmail);
        return true;
    };

    const validateSignUpPassword = () => {
        const value = signUpPassword.value.trim();
        if (!strongPasswordPattern.test(value)) {
            setFieldError(
                signUpPassword,
                "A senha precisa ter 8+ caracteres, maiuscula, minuscula, numero e simbolo."
            );
            return false;
        }
        clearInputError(signUpPassword);
        return true;
    };

    const validateSignUpConfirmPassword = () => {
        const passwordValue = signUpPassword.value.trim();
        const confirmValue = signUpConfirmPassword.value.trim();

        if (!confirmValue) {
            setFieldError(signUpConfirmPassword, "Confirme sua senha.");
            return false;
        }

        if (confirmValue !== passwordValue) {
            setFieldError(signUpConfirmPassword, "As senhas nao coincidem.");
            return false;
        }

        clearInputError(signUpConfirmPassword);
        return true;
    };

    const validateTerms = () => {
        if (!acceptTerms) return true;
        if (!acceptTerms.checked) {
            setCustomFieldError("acceptTerms", "Voce precisa aceitar os termos para continuar.");
            return false;
        }
        clearCustomFieldError("acceptTerms");
        return true;
    };

    const applyCaptcha = (mode, challenge) => {
        const promptEl = mode === "signin" ? signInCaptchaPrompt : signUpCaptchaPrompt;
        const idEl = mode === "signin" ? signInCaptchaId : signUpCaptchaId;
        const answerEl = mode === "signin" ? signInCaptchaAnswer : signUpCaptchaAnswer;
        if (!promptEl || !idEl || !answerEl) return;

        promptEl.textContent = challenge.prompt;
        idEl.value = challenge.challengeId;
        idEl.dataset.localAnswer = challenge.localAnswer || "";
        answerEl.value = "";
        clearInputError(answerEl);
    };

    const requestCaptchaChallenge = async () => {
        const url = buildApiUrl("/api/auth/captcha");
        if (!url) {
            const first = Math.floor(Math.random() * 9) + 1;
            const second = Math.floor(Math.random() * 9) + 1;
            return {
                ok: true,
                challengeId: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                prompt: `Quanto e ${first} + ${second}?`,
                localAnswer: String(first + second)
            };
        }

        let timeoutId;

        try {
            const controller = new AbortController();
            timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeoutMs);
            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                signal: controller.signal
            });

            const data = await readJsonSafely(response);
            if (!response.ok || !data?.challengeId || !data?.prompt) {
                return { ok: false, message: data?.message || "Nao foi possivel gerar o captcha." };
            }

            return {
                ok: true,
                challengeId: data.challengeId,
                prompt: data.prompt,
                localAnswer: ""
            };
        } catch {
            return { ok: false, message: "Falha ao carregar captcha." };
        } finally {
            clearTimeout(timeoutId);
        }
    };

    const loadCaptcha = async (mode) => {
        const challenge = await requestCaptchaChallenge();
        if (!challenge.ok) {
            const messageTarget = mode === "signin" ? signInMessage : signUpMessage;
            setMessage(messageTarget, challenge.message || "Falha ao carregar captcha.", "error");
            return;
        }
        applyCaptcha(mode, challenge);
    };

    const validateCaptcha = (mode) => {
        const answerEl = mode === "signin" ? signInCaptchaAnswer : signUpCaptchaAnswer;
        const idEl = mode === "signin" ? signInCaptchaId : signUpCaptchaId;
        if (!answerEl || !idEl) return true;

        const answer = answerEl.value.trim();
        if (!answer) {
            setFieldError(answerEl, "Resolva o desafio anti-robo.");
            return false;
        }

        const localAnswer = idEl.dataset.localAnswer || "";
        if (localAnswer && answer !== localAnswer) {
            setFieldError(answerEl, "Resposta incorreta. Tente novamente.");
            return false;
        }

        clearInputError(answerEl);
        return true;
    };

    const submitWithApiOrFallback = async (mode, payload) => {
        const path = mode === "signin" ? API_CONFIG.loginPath : API_CONFIG.registerPath;
        const remote = await requestAuthApi(path, payload);

        if (remote.ok) {
            return {
                ok: true,
                userEmail: remote.userEmail || payload.email,
                token: remote.token || "",
                fromApi: true,
                message: remote.message
            };
        }

        if (remote.skipped) {
            if (!API_CONFIG.allowOfflineFallback) {
                return { ok: false, message: "API indisponivel. Tente novamente em instantes." };
            }
            return { ok: true, userEmail: payload.email, token: "", fromApi: false };
        }

        if ((remote.message || "").includes("Servidor indisponivel") && API_CONFIG.allowOfflineFallback) {
            return {
                ok: true,
                userEmail: payload.email,
                token: "",
                fromApi: false,
                message: "Servidor temporariamente indisponivel. Continuando com login local."
            };
        }

        if (mode === "signin") {
            return {
                ok: false,
                message: remote.message || "Nao foi possivel entrar agora. Tente novamente em instantes."
            };
        }

        return {
            ok: false,
            message: remote.message || "Nao foi possivel cadastrar agora. Tente novamente em instantes."
        };
    };

    signInForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearMessages();
        [signInEmail, signInPassword, signInCaptchaAnswer].forEach(clearInputError);

        const isValid = validateSignInEmail() && validateSignInPassword() && validateCaptcha("signin");
        if (!isValid) {
            setMessage(signInMessage, "Revise os campos destacados para continuar.", "error");
            shake(signInForm);
            return;
        }

        const submitButton = signInForm.querySelector("button[type='submit']");
        if (submitButton) submitButton.disabled = true;

        const emailValue = signInEmail.value.trim();
        const passwordValue = signInPassword.value.trim();
        const shouldPersist = Boolean(rememberSession?.checked);

        const result = await submitWithApiOrFallback("signin", {
            email: emailValue,
            password: passwordValue,
            captchaChallengeId: signInCaptchaId?.value || "",
            captchaAnswer: signInCaptchaAnswer?.value.trim() || ""
        });

        if (!result.ok) {
            setMessage(signInMessage, result.message, "error");
            if (submitButton) submitButton.disabled = false;
            await loadCaptcha("signin");
            return;
        }

        setMessage(signInMessage, result.message || "Login realizado com sucesso.", "success");
        setTimeout(() => completeLogin(result.userEmail, shouldPersist, result.token || ""), 350);
    });

    signUpForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearMessages();
        [signUpName, signUpEmail, signUpConfirmEmail, signUpPassword, signUpConfirmPassword].forEach(clearInputError);
        clearCustomFieldError("acceptTerms");

        const isValid = validateSignUpName()
            && validateSignUpEmail()
            && validateSignUpConfirmEmail()
            && validateSignUpPassword()
            && validateSignUpConfirmPassword()
            && validateTerms()
            && validateCaptcha("signup");

        if (!isValid) {
            setMessage(signUpMessage, "Revise os campos destacados para continuar.", "error");
            shake(signUpForm);
            return;
        }

        const submitButton = signUpForm.querySelector("button[type='submit']");
        if (submitButton) submitButton.disabled = true;

        const payload = {
            name: signUpName.value.trim(),
            email: signUpEmail.value.trim(),
            password: signUpPassword.value.trim(),
            captchaChallengeId: signUpCaptchaId?.value || "",
            captchaAnswer: signUpCaptchaAnswer?.value.trim() || ""
        };

        const result = await submitWithApiOrFallback("signup", payload);
        if (!result.ok) {
            setMessage(signUpMessage, result.message, "error");
            if (submitButton) submitButton.disabled = false;
            await loadCaptcha("signup");
            return;
        }

        setMessage(signUpMessage, result.message || "Conta criada com sucesso. Entrando na sua conta...", "success");
        setTimeout(() => completeLogin(result.userEmail, true, result.token || ""), 400);
    });

    signInEmail?.addEventListener("input", validateSignInEmail);
    signInPassword?.addEventListener("input", validateSignInPassword);
    signInCaptchaAnswer?.addEventListener("input", () => validateCaptcha("signin"));
    signUpName?.addEventListener("input", validateSignUpName);
    signUpEmail?.addEventListener("input", () => {
        validateSignUpEmail();
        if (signUpConfirmEmail?.value.trim()) {
            validateSignUpConfirmEmail();
        }
    });
    signUpConfirmEmail?.addEventListener("input", validateSignUpConfirmEmail);
    signUpPassword?.addEventListener("input", () => {
        validateSignUpPassword();
        updatePasswordStrength(signUpPassword.value.trim());

        if (signUpConfirmPassword.value.trim()) {
            validateSignUpConfirmPassword();
        }
    });
    signUpConfirmPassword?.addEventListener("input", validateSignUpConfirmPassword);
    acceptTerms?.addEventListener("change", validateTerms);
    signUpCaptchaAnswer?.addEventListener("input", () => validateCaptcha("signup"));

    [signInEmail, signInPassword, signUpName, signUpEmail, signUpConfirmEmail, signUpPassword, signUpConfirmPassword].forEach((input) => {
        input?.addEventListener("blur", () => {
            if (input === signInEmail) validateSignInEmail();
            if (input === signInPassword) validateSignInPassword();
            if (input === signUpName) validateSignUpName();
            if (input === signUpEmail) validateSignUpEmail();
            if (input === signUpConfirmEmail) validateSignUpConfirmEmail();
            if (input === signUpPassword) validateSignUpPassword();
            if (input === signUpConfirmPassword) validateSignUpConfirmPassword();
        });
    });

    updatePasswordStrength(signUpPassword?.value.trim() || "");
    setupPasswordToggles();
    loadCaptcha("signin");
    loadCaptcha("signup");
};

document.addEventListener("DOMContentLoaded", async () => {
    setupImageFallbacks();
    ensureSiteChrome();
    guardProtectedPage();
    await hydrateCatalogGridFromData();
    setupCatalog();
    setupProductCatalogActions();
    setupProductDetailLinks();
    await setupProductDetailsPage();
    setupProtectedActions();
    setupMobileMenu();
    setupNewsletter();
    setupContactForm();
    setupSmoothAnchorLinks();
    setupProtectedDataPages();
    setupCheckoutActions();
    showAuthNotice();
    setupAuthForms();
    setupLogoutActions();
    setupCurrentUserLabel();
});
