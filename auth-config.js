// API base dinamica:
// - Local: usa backend local em http://localhost:4000
// - Producao (Vercel): usa mesma origem com rotas /api
const isLocalHost = ["localhost", "127.0.0.1", ""].includes(window.location.hostname);
window.BUNNYBITES_API_BASE = isLocalHost
    ? "http://localhost:4000"
    : window.location.origin;

// Timeout de requisicao para login/cadastro em milissegundos.
window.BUNNYBITES_API_TIMEOUT_MS = 7000;

// Em producao, mantenha false para nao autenticar localmente se a API falhar.
window.BUNNYBITES_ALLOW_OFFLINE_FALLBACK = false;

// Quantidade maxima de toasts simultaneos na tela.
window.BUNNYBITES_TOAST_MAX_VISIBLE = 3;

// Duracao do toast em milissegundos.
window.BUNNYBITES_TOAST_DURATION_MS = 2600;

// Distancia minima de swipe (px) para fechar toast.
window.BUNNYBITES_TOAST_SWIPE_THRESHOLD_PX = 86;

// Posicao da pilha de toast: "right", "left" ou "center".
window.BUNNYBITES_TOAST_POSITION = "right";

// Posicao vertical da pilha de toast: "bottom" ou "top".
window.BUNNYBITES_TOAST_VERTICAL = "bottom";
