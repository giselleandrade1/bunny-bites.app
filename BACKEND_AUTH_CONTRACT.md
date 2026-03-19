# Bunny Bites Auth API Contract

This frontend expects JSON responses on both endpoints:

- `POST /api/auth/captcha`
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/logout` (protegido por token)
- `GET /api/cart` (protegido por token)
- `GET /api/wishlist` (protegido por token)
- `POST /api/checkout` (protegido por token)

## Request payloads

Login request:

```json
{
  "email": "user@example.com",
  "password": "StrongPass1!",
  "captchaChallengeId": "uuid-challenge-id",
  "captchaAnswer": "7"
}
```

Register request:

```json
{
  "name": "User Name",
  "email": "user@example.com",
  "password": "StrongPass1!",
  "captchaChallengeId": "uuid-challenge-id",
  "captchaAnswer": "7"
}
```

Captcha request:

```json
{}
```

Captcha success response (HTTP 200):

```json
{
  "success": true,
  "message": "Desafio gerado com sucesso.",
  "challengeId": "uuid-challenge-id",
  "prompt": "Quanto e 3 + 4?"
}
```

## Success response (HTTP 200/201)

```json
{
  "success": true,
  "message": "Login successful",
  "email": "user@example.com",
  "token": "jwt-or-session-token"
}
```

`token` is optional but recommended.

## Error response (HTTP 400/401/409/422/500)

```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

## Required response rules

- Always return valid JSON, including errors.
- Always include a boolean `success`.
- Include a human-readable `message` for UI feedback.
- Include `email` on successful login/register when available.
- Include `token` or `accessToken` when your auth model supports it.
- Captcha challenges must be single-use and should expire quickly.

## Headers and CORS

- Request content type: `Content-Type: application/json`
- Response content type: `application/json`
- Protected routes require `Authorization: Bearer <jwt-token>`
- If frontend and backend are in different origins, enable CORS for the site origin.

## Frontend behavior expectations

- If `success: false`, frontend shows `message` as error.
- If API base URL is configured and backend is down, login fails by default.
- Offline auth fallback is disabled in production (`window.BUNNYBITES_ALLOW_OFFLINE_FALLBACK = false`).

## Local backend in this repository

- API server: `backend/server.js`
- Database: `backend/data/bunnybites.db` (SQLite)
- Run locally:
  - `cd backend`
  - `npm install`
  - `npm run dev`
