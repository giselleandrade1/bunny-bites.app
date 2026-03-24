# Bunny Bites

Fullstack e-commerce experience for Bunny Bites, with static storefront pages and authentication/cart/wishlist/checkout APIs.

## Project Goal

Demonstrate clean, production-minded front-end practices using plain HTML, CSS, and JavaScript:

- semantic page structure
- reusable design tokens and layout system
- accessible interactions and feedback states
- resilient client-side behavior with defensive guards
- responsive experience across common viewport sizes

## Architecture

- Frontend: multi-page static site (HTML, CSS, JS)
- API: Node.js + Express + JWT
- Data layer: SQLite (local) and PostgreSQL (production-ready)
- Deployment: Vercel (static pages + serverless API route)

## Technical Highlights

- Marketing-first storefront layout with modular sections
- Auth flow with JWT and protected routes
- Interactive elements with progressive enhancement principles
- Form validation and user-feedback handling patterns
- Responsive grid and typography scaling
- Catalog, cart, wishlist, and checkout interactions

## Stack

- HTML5
- CSS3
- Vanilla JavaScript (ES6+)

## Run Locally

1. Install backend dependencies:
   - cd backend
   - npm install
2. Start API:
   - npm run dev
3. Open frontend:
   - open index.html directly or serve root statically

Default local API URL: http://localhost:4000

## Quality Checks

- Smoke test only:
  - npm run test:smoke
- Full predeploy checklist (includes API readiness + smoke test):
  - npm run test:predeploy

## Vercel Deployment

This project is configured to deploy on Vercel as:

- static pages from repository root
- serverless API at /api/\* through api/index.js

### Required Vercel Environment Variables

- JWT_SECRET: strong random secret for token signing
- CORS_ORIGIN: your Vercel domain (for example, https://your-app.vercel.app)
- DB_PROVIDER: postgres
- DATABASE_URL: managed PostgreSQL connection string (Neon/Supabase/Render/Railway)

### Local Development Variables

- DB_PROVIDER=sqlite
- DB_FILE=./data/bunnybites.db

### Data Persistence Note

For production, use PostgreSQL via DATABASE_URL to keep users/cart/orders persistent across deploys and cold starts.

## Author Notes

The current setup is optimized for simple deployment and functional demonstration. If you want persistent production data, the next step is replacing SQLite storage with a managed database service.
