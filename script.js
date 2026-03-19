const AUTH_KEYS = {
    isLoggedIn: "isLoggedIn",
    currentUser: "currentUser",
    redirectAfterLogin: "redirectAfterLogin",
    authMessage: "authMessage"
};

const API_CONFIG = {
    baseUrl: window.BUNNYBITES_API_BASE || "",
    loginPath: "/api/auth/login",
    registerPath: "/api/auth/register"
};

const PROTECTED_ROUTES = ["cart.html", "wishlist.html", "checkout.html"];

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

const storageGet = (key) => localStorage.getItem(key) ?? sessionStorage.getItem(key);

const storageSet = (key, value, persistent = true) => {
    if (persistent) {
        localStorage.setItem(key, value);
        sessionStorage.removeItem(key);
        return;
    }
    sessionStorage.setItem(key, value);
    localStorage.removeItem(key);
};

const storageRemove = (key) => {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
};

const isAuthenticated = () => storageGet(AUTH_KEYS.isLoggedIn) === "true";

const setAuthenticatedUser = (email, persistent = true) => {
    storageSet(AUTH_KEYS.isLoggedIn, "true", persistent);
    storageSet(AUTH_KEYS.currentUser, email, persistent);
};

const clearAuthenticatedUser = () => {
    storageRemove(AUTH_KEYS.isLoggedIn);
    storageRemove(AUTH_KEYS.currentUser);
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

const getCurrentPage = () => {
    const path = window.location.pathname.split("/").pop();
    return path || "index.html";
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

    protectedTriggers.forEach((trigger) => {
        trigger.addEventListener("click", (event) => {
            const target = trigger.dataset.protectedTarget;
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

    toggle.addEventListener("click", () => {
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
};

const setupLogoutActions = () => {
    const logoutTriggers = document.querySelectorAll("[data-auth-logout]");
    logoutTriggers.forEach((trigger) => {
        trigger.addEventListener("click", (event) => {
            event.preventDefault();
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

    confirmButton.addEventListener("click", (event) => {
        event.preventDefault();

        if (!isAuthenticated()) {
            requireAuthFor("checkout.html", "Entre para confirmar seu pedido.");
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

const requestAuthApi = async (path, payload) => {
    const url = buildApiUrl(path);
    if (!url) {
        return { ok: false, skipped: true };
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000);

        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

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
            userEmail: data.email || payload.email
        };
    } catch {
        return {
            ok: false,
            skipped: false,
            message: "Servidor indisponivel no momento."
        };
    }
};

const completeLogin = (email, persistent) => {
    setAuthenticatedUser(email, persistent);

    const next = storageGet(AUTH_KEYS.redirectAfterLogin) || "products.html";
    storageRemove(AUTH_KEYS.redirectAfterLogin);
    window.location.href = next;
};

const setupAuthForms = () => {
    const authCard = document.getElementById("authCard");
    const showSignUp = document.getElementById("showSignUp");
    const showSignIn = document.getElementById("showSignIn");

    const signInForm = document.getElementById("signInForm");
    const signUpForm = document.getElementById("signUpForm");
    if (!signInForm || !signUpForm) return;

    const signInEmail = document.getElementById("signInEmail");
    const signInPassword = document.getElementById("signInPassword");
    const signInMessage = document.getElementById("signInMessage");
    const rememberSession = document.getElementById("rememberSession");
    const forgotLink = document.querySelector(".forgot-link");

    const signUpName = document.getElementById("signUpName");
    const signUpEmail = document.getElementById("signUpEmail");
    const signUpPassword = document.getElementById("signUpPassword");
    const signUpConfirmPassword = document.getElementById("signUpConfirmPassword");
    const acceptTerms = document.getElementById("acceptTerms");
    const signUpMessage = document.getElementById("signUpMessage");

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

    const submitWithApiOrFallback = async (mode, payload) => {
        const path = mode === "signin" ? API_CONFIG.loginPath : API_CONFIG.registerPath;
        const remote = await requestAuthApi(path, payload);

        if (remote.ok) {
            return { ok: true, userEmail: remote.userEmail || payload.email, fromApi: true, message: remote.message };
        }

        if (remote.skipped) {
            return { ok: true, userEmail: payload.email, fromApi: false };
        }

        if ((remote.message || "").includes("Servidor indisponivel")) {
            return {
                ok: true,
                userEmail: payload.email,
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
        [signInEmail, signInPassword].forEach(clearInputError);

        const isValid = validateSignInEmail() && validateSignInPassword();
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
            password: passwordValue
        });

        if (!result.ok) {
            setMessage(signInMessage, result.message, "error");
            if (submitButton) submitButton.disabled = false;
            return;
        }

        setMessage(signInMessage, result.message || "Login realizado com sucesso.", "success");
        setTimeout(() => completeLogin(result.userEmail, shouldPersist), 350);
    });

    signUpForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearMessages();
        [signUpName, signUpEmail, signUpPassword, signUpConfirmPassword].forEach(clearInputError);
        clearCustomFieldError("acceptTerms");

        const isValid = validateSignUpName()
            && validateSignUpEmail()
            && validateSignUpPassword()
            && validateSignUpConfirmPassword()
            && validateTerms();

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
            password: signUpPassword.value.trim()
        };

        const result = await submitWithApiOrFallback("signup", payload);
        if (!result.ok) {
            setMessage(signUpMessage, result.message, "error");
            if (submitButton) submitButton.disabled = false;
            return;
        }

        setMessage(signUpMessage, result.message || "Conta criada com sucesso. Entrando na sua conta...", "success");
        setTimeout(() => completeLogin(result.userEmail, true), 400);
    });

    signInEmail?.addEventListener("input", validateSignInEmail);
    signInPassword?.addEventListener("input", validateSignInPassword);
    signUpName?.addEventListener("input", validateSignUpName);
    signUpEmail?.addEventListener("input", validateSignUpEmail);
    signUpPassword?.addEventListener("input", () => {
        validateSignUpPassword();
        updatePasswordStrength(signUpPassword.value.trim());

        if (signUpConfirmPassword.value.trim()) {
            validateSignUpConfirmPassword();
        }
    });
    signUpConfirmPassword?.addEventListener("input", validateSignUpConfirmPassword);
    acceptTerms?.addEventListener("change", validateTerms);

    [signInEmail, signInPassword, signUpName, signUpEmail, signUpPassword, signUpConfirmPassword].forEach((input) => {
        input?.addEventListener("blur", () => {
            if (input === signInEmail) validateSignInEmail();
            if (input === signInPassword) validateSignInPassword();
            if (input === signUpName) validateSignUpName();
            if (input === signUpEmail) validateSignUpEmail();
            if (input === signUpPassword) validateSignUpPassword();
            if (input === signUpConfirmPassword) validateSignUpConfirmPassword();
        });
    });

    updatePasswordStrength(signUpPassword?.value.trim() || "");
    setupPasswordToggles();
};

document.addEventListener("DOMContentLoaded", () => {
    guardProtectedPage();
    setupProtectedActions();
    setupMobileMenu();
    setupNewsletter();
    setupCheckoutActions();
    showAuthNotice();
    setupAuthForms();
    setupLogoutActions();
    setupCurrentUserLabel();
});
