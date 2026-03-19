# Bunny Bites Auth API Contract

This frontend expects JSON responses on both endpoints:

- POST /api/auth/login
- POST /api/auth/register

Request payloads

```json
{
  "email": "user@example.com",
  "password": "StrongPass1!"
}
```

```json
{
  "name": "User Name",
  "email": "user@example.com",
  "password": "StrongPass1!"
}
```

Success response (HTTP 200/201)

```json
{
  "success": true,
  "message": "Login successful",
  "email": "user@example.com"
}
```

Error response (HTTP 400/401/409/422/500)

```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

Notes

- `message` is shown directly in UI feedback.
- `email` is used as current authenticated user.
- Keep `Content-Type: application/json`.
- Return valid JSON for all responses, including errors.
