# Bunny Bites Auth Backend

API de autenticacao com Node.js + Express com suporte a SQLite (local) e PostgreSQL (producao).

## Recursos

- Cadastro e login com persistencia em banco SQLite.
- Senhas com hash seguro (`bcryptjs`).
- Token JWT no retorno de autenticacao.
- Logout seguro com invalidacao de token (blacklist por `jti`).
- Verificacao anti-robo gratuita via desafio matematico de uso unico.
- Endpoint de saude para monitoramento.

## Endpoints

- `GET /api/health`
- `POST /api/auth/captcha`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout` (requer token JWT)
- `GET /api/cart` (requer token JWT)
- `GET /api/wishlist` (requer token JWT)
- `POST /api/checkout` (requer token JWT)

## Setup local

1. Entre na pasta do backend:
   `cd backend`
2. Instale dependencias:
   `npm install`
3. Copie variaveis de ambiente:
   `cp .env.example .env`
4. Inicie em desenvolvimento:
   `npm run dev`

A API sobe por padrao em `http://localhost:4000`.

## Banco de dados

- Local (padrao): SQLite em `backend/data/bunnybites.db`
- Producao recomendada: PostgreSQL com `DB_PROVIDER=postgres` e `DATABASE_URL`
- As tabelas sao criadas automaticamente no primeiro start.

## Observacoes de seguranca

- Troque `JWT_SECRET` em producao.
- Restrinja `CORS_ORIGIN` para o dominio oficial.
- Mantenha `window.BUNNYBITES_ALLOW_OFFLINE_FALLBACK = false` no frontend.
