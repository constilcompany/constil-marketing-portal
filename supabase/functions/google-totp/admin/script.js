// ============================================
// CONFIGURAÇÕES GLOBAIS
// ============================================
const API_URL = "http://localhost:8000/api";
let TOKEN = localStorage.getItem("token") || "";
let allUsers = [];
let filteredUsers = [];
let selectedUsers = [];
let currentPage = 1;
let itemsPerPage = 25;
let sortField = "created_at";
let sortDirection = "desc";
let selectedUserId = null;
let logEntries = [];
let charts = {};
let twoFATestLogs = [];
let currentUser = null;
let selected2FAMethod = "both";
let registerEmail = "";
let registerOTPSent = false;
let resetEmail = "";

// ============================================
// TOAST
// ============================================
function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================
// DARK MODE
// ============================================
function toggleDarkMode() {
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  document.documentElement.setAttribute(
    "data-theme",
    isDark ? "light" : "dark",
  );
  document.getElementById("darkModeIcon").textContent = isDark ? "🌙" : "☀️";
  document.getElementById("darkModeText").textContent = isDark
    ? "Modo Escuro"
    : "Modo Claro";
  localStorage.setItem("theme", isDark ? "light" : "dark");
}

document.addEventListener("DOMContentLoaded", () => {
  const savedTheme = localStorage.getItem("theme") || "light";
  document.documentElement.setAttribute("data-theme", savedTheme);
  document.getElementById("darkModeIcon").textContent =
    savedTheme === "dark" ? "☀️" : "🌙";
  document.getElementById("darkModeText").textContent =
    savedTheme === "dark" ? "Modo Claro" : "Modo Escuro";
  updateAuthStatus();
  check2FAStatus();
  loadUsers();

  // ============================================
  // VALIDAÇÃO DE SENHA EM TEMPO REAL (RESET)
  // ============================================
  const resetPasswordInput = document.getElementById("resetNewPassword");
  const resetConfirmInput = document.getElementById("resetConfirmPassword");
  const resetPasswordHint = document.getElementById("resetPasswordHint");
  const resetConfirmHint = document.getElementById("resetConfirmHint");

  if (resetPasswordInput) {
    resetPasswordInput.addEventListener("input", function () {
      const value = this.value;

      if (value.length > 0 && value.length < 6) {
        this.style.borderColor = "#fc8181";
        if (resetPasswordHint) {
          resetPasswordHint.style.color = "#fc8181";
          resetPasswordHint.textContent = "⚠️ Mínimo 6 caracteres";
        }
      } else if (value.length >= 6) {
        this.style.borderColor = "#48bb78";
        if (resetPasswordHint) {
          resetPasswordHint.style.color = "#48bb78";
          resetPasswordHint.textContent = "✅ Senha válida";
        }
      } else {
        this.style.borderColor = "";
        if (resetPasswordHint) {
          resetPasswordHint.style.color = "var(--text-light)";
          resetPasswordHint.textContent =
            "A senha deve ter no mínimo 6 caracteres";
        }
      }

      // Verifica se as senhas coincidem
      if (resetConfirmInput && resetConfirmInput.value) {
        checkPasswordsMatch(
          resetPasswordInput,
          resetConfirmInput,
          resetConfirmHint,
        );
      }
    });
  }

  if (resetConfirmInput) {
    resetConfirmInput.addEventListener("input", function () {
      checkPasswordsMatch(resetPasswordInput, this, resetConfirmHint);
    });
  }
});

function checkPasswordsMatch(passwordInput, confirmInput, hintElement) {
  if (!confirmInput || !hintElement) return;

  if (confirmInput.value.length > 0) {
    if (passwordInput.value === confirmInput.value) {
      confirmInput.style.borderColor = "#48bb78";
      hintElement.style.color = "#48bb78";
      hintElement.textContent = "✅ Senhas coincidem";
    } else {
      confirmInput.style.borderColor = "#fc8181";
      hintElement.style.color = "#fc8181";
      hintElement.textContent = "❌ Senhas não coincidem";
    }
  } else {
    confirmInput.style.borderColor = "";
    hintElement.style.color = "var(--text-light)";
    hintElement.textContent = "Digite a mesma senha para confirmar";
  }
}

// ============================================
// AUTH STATUS
// ============================================
function updateAuthStatus() {
  const statusEl = document.getElementById("authStatus");
  const logoutBtn = document.getElementById("logoutBtn");
  if (TOKEN) {
    statusEl.textContent = "✅ Conectado";
    statusEl.style.color = "#48bb78";
    logoutBtn.style.display = "block";
  } else {
    statusEl.textContent = "❌ Desconectado";
    statusEl.style.color = "#fc8181";
    logoutBtn.style.display = "none";
  }
}

// ============================================
// SIDEBAR
// ============================================
function toggleSidebar() {
  document.getElementById("sidebar").classList.toggle("collapsed");
}

function switchTab(tab) {
  document
    .querySelectorAll(".tab-content")
    .forEach((el) => el.classList.remove("active"));
  document
    .querySelectorAll(".sidebar-nav a")
    .forEach((el) => el.classList.remove("active"));

  document.getElementById(`tab-${tab}`).classList.add("active");
  const link = document.querySelector(
    `.sidebar-nav a[onclick="switchTab('${tab}')"]`,
  );
  if (link) link.classList.add("active");

  const titles = {
    dashboard: "📊 Dashboard",
    users: "👥 Usuários",
    auth: "🔐 Login",
    register: "📝 Registrar",
    "reset-password": "🔑 Reset Senha",
    "2fa": "📱 2FA",
    logs: "📝 Logs",
  };
  document.getElementById("pageTitle").textContent = titles[tab] || tab;

  if (tab === "logs") loadLogs();
  if (tab === "dashboard") updateCharts();
  if (tab === "auth") updateAuthStatus();
  if (tab === "2fa") {
    check2FAStatus();
    load2FASettings();
  }
}

// ============================================
// CHECK TOKEN EXPIRADO
// ============================================
async function checkToken() {
  if (!TOKEN) return false;

  try {
    const response = await fetch(`${API_URL}/user`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });

    if (response.status === 401) {
      TOKEN = "";
      localStorage.removeItem("token");
      currentUser = null;
      updateAuthStatus();
      showToast("🔐 Sessão expirada. Faça login novamente.", "warning");
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function requireAuth() {
  if (!TOKEN) {
    showToast("🔐 Faça login primeiro!", "warning");
    return false;
  }
  return await checkToken();
}

// ============================================
// LOGIN
// ============================================
async function login() {
  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;
  const emailOtp = document.getElementById("emailOtpCode").value;
  const totpCode = document.getElementById("totpCode").value;

  if (!email || !password) {
    showToast("❌ Email e senha são obrigatórios", "error");
    return;
  }

  const resultDiv = document.getElementById("authResultContent");
  resultDiv.innerHTML = '<div class="loading">Autenticando...</div>';

  try {
    const response = await fetch(`${API_URL}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        otp_code: emailOtp,
        totp_code: totpCode,
      }),
    });
    const data = await response.json();

    if (data.success) {
      TOKEN = data.access_token;
      localStorage.setItem("token", TOKEN);
      currentUser = data.user;
      updateAuthStatus();

      resultDiv.innerHTML = `
                <div style="background:#c6f6d5;padding:15px;border-radius:6px;color:#22543d;">
                    <h4>✅ Login realizado com sucesso!</h4>
                    <p><strong>Usuário:</strong> ${data.user.email}</p>
                    <p><strong>2FA:</strong> ${data.user.has2FA ? "✅ Ativo" : "❌ Inativo"}</p>
                    <p><strong>Token:</strong></p>
                    <pre style="background:#f0f0f0;padding:10px;border-radius:4px;overflow-x:auto;font-size:0.7rem;word-break:break-all;color:#333;">${TOKEN}</pre>
                </div>
            `;

      showToast(`✅ Bem-vindo, ${data.user.email}!`, "success");
      check2FAStatus();
      loadUsers();
    } else if (data.requires2FA) {
      document.getElementById("emailOtpField").style.display = "none";
      document.getElementById("totpField").style.display = "none";

      if (data.methods?.includes("email")) {
        document.getElementById("emailOtpField").style.display = "block";
        showToast("📧 Digite o código enviado por email", "info");
        await sendEmailOTP();
      }
      if (data.methods?.includes("totp")) {
        document.getElementById("totpField").style.display = "block";
        showToast("📱 Digite o código do Google Authenticator", "info");
      }

      resultDiv.innerHTML = `
                <div style="background:#fefcbf;padding:15px;border-radius:6px;color:#975a16;">
                    <h4>🔐 2FA Requerido</h4>
                    <p>Digite o código de autenticação de dois fatores.</p>
                    ${data.methods?.includes("email") ? "<p>📧 Código enviado por email</p>" : ""}
                    ${data.methods?.includes("totp") ? "<p>📱 Use o Google Authenticator</p>" : ""}
                </div>
            `;

      window._loginEmail = email;
    } else {
      throw new Error(data.error || "Erro no login");
    }
  } catch (error) {
    resultDiv.innerHTML = `
            <div style="background:#fed7d7;padding:15px;border-radius:6px;color:#9b2c2c;">
                <h4>❌ Erro no login</h4>
                <p>${error.message}</p>
            </div>
        `;
    showToast(`❌ ${error.message}`, "error");
  }
}

// ============================================
// LOGOUT
// ============================================
async function logout() {
  if (!TOKEN) return;
  try {
    await fetch(`${API_URL}/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
  } catch (e) {}
  TOKEN = "";
  localStorage.removeItem("token");
  currentUser = null;
  updateAuthStatus();
  document.getElementById("authResultContent").innerHTML =
    '<p style="color:var(--text-light);">Logout realizado.</p>';
  showToast("🚪 Desconectado com sucesso", "info");
}

// ============================================
// RESET DE SENHA COM OTP (CORRIGIDO)
// ============================================
async function requestReset() {
  const email = document.getElementById("resetEmail").value.trim();

  if (!email) {
    showToast("❌ Email é obrigatório", "error");
    return;
  }

  const resultDiv = document.getElementById("resetResult");
  resultDiv.innerHTML =
    '<div class="loading">Enviando código de reset...</div>';

  try {
    const response = await fetch(`${API_URL}/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await response.json();

    if (data.success) {
      resetEmail = email;
      document.getElementById("resetStep1").style.display = "none";
      document.getElementById("resetStep2").style.display = "block";

      resultDiv.innerHTML = `
                <div style="background:#c6f6d5;padding:15px;border-radius:6px;color:#22543d;">
                    <h4>✅ Código enviado!</h4>
                    <p>Um código de verificação foi enviado para <strong>${email}</strong></p>
                    <p style="font-size:0.8rem;margin-top:5px;">O código é válido por 10 minutos.</p>
                    ${data.debug_otp ? `<p style="font-size:0.7rem;color:#718096;">🔑 Debug: ${data.debug_otp}</p>` : ""}
                </div>
            `;
      showToast("📧 Código enviado para seu email!", "success");
    } else {
      throw new Error(data.message || "Erro ao solicitar reset");
    }
  } catch (error) {
    resultDiv.innerHTML = `
            <div style="background:#fed7d7;padding:15px;border-radius:6px;color:#9b2c2c;">
                <h4>❌ Erro</h4>
                <p>${error.message}</p>
            </div>
        `;
    showToast(`❌ ${error.message}`, "error");
  }
}

async function resendResetOTP() {
  if (!resetEmail) {
    showToast("❌ Email não encontrado", "error");
    return;
  }

  const resultDiv = document.getElementById("resetResult");
  resultDiv.innerHTML = '<div class="loading">Reenviando código...</div>';

  try {
    const response = await fetch(`${API_URL}/forgot-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resetEmail }),
    });
    const data = await response.json();

    if (data.success) {
      resultDiv.innerHTML = `
                <div style="background:#c6f6d5;padding:15px;border-radius:6px;color:#22543d;">
                    <h4>✅ Novo código enviado!</h4>
                    <p>Verifique seu email <strong>${resetEmail}</strong></p>
                    ${data.debug_otp ? `<p style="font-size:0.7rem;color:#718096;">🔑 Debug: ${data.debug_otp}</p>` : ""}
                </div>
            `;
      showToast("📧 Novo código enviado!", "success");
    } else {
      throw new Error(data.message || "Erro ao reenviar código");
    }
  } catch (error) {
    resultDiv.innerHTML = `
            <div style="background:#fed7d7;padding:15px;border-radius:6px;color:#9b2c2c;">
                <h4>❌ Erro</h4>
                <p>${error.message}</p>
            </div>
        `;
    showToast(`❌ ${error.message}`, "error");
  }
}

// ============================================
// RESET PASSWORD - VERSÃO CORRIGIDA
// ============================================
async function resetPassword() {
  const otp = document.getElementById("resetOtpCode").value;
  const newPassword = document.getElementById("resetNewPassword").value;
  const confirmPassword = document.getElementById("resetConfirmPassword").value;

  // VALIDAÇÕES MELHORADAS
  if (!otp || otp.length !== 6) {
    showToast("❌ Digite o código de 6 dígitos", "error");
    document.getElementById("resetOtpCode").focus();
    return;
  }

  if (!newPassword) {
    showToast("❌ Digite uma nova senha", "error");
    document.getElementById("resetNewPassword").focus();
    return;
  }

  if (newPassword.length < 6) {
    showToast("❌ A senha deve ter no mínimo 6 caracteres", "error");
    document.getElementById("resetNewPassword").focus();
    document.getElementById("resetNewPassword").value = "";
    return;
  }

  if (newPassword !== confirmPassword) {
    showToast("❌ As senhas não coincidem", "error");
    document.getElementById("resetConfirmPassword").value = "";
    document.getElementById("resetConfirmPassword").focus();
    return;
  }

  const resultDiv = document.getElementById("resetResult");
  resultDiv.innerHTML = '<div class="loading">Resetando senha...</div>';

  try {
    const response = await fetch(`${API_URL}/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: resetEmail,
        otp: otp,
        new_password: newPassword,
      }),
    });

    const data = await response.json();

    if (data.success) {
      resultDiv.innerHTML = `
                <div style="background:#c6f6d5;padding:15px;border-radius:6px;color:#22543d;">
                    <h4>✅ Senha resetada com sucesso!</h4>
                    <p>Agora você pode fazer login com sua nova senha.</p>
                    <button class="btn btn-primary" onclick="switchTab('auth')" style="margin-top:10px;width:100%;">
                        🔐 Ir para Login
                    </button>
                </div>
            `;
      showToast("✅ Senha resetada com sucesso!", "success");

      // Limpa campos
      document.getElementById("resetEmail").value = "";
      document.getElementById("resetOtpCode").value = "";
      document.getElementById("resetNewPassword").value = "";
      document.getElementById("resetConfirmPassword").value = "";
      document.getElementById("resetStep1").style.display = "block";
      document.getElementById("resetStep2").style.display = "none";

      // Limpa os hints de validação
      const passwordHint = document.getElementById("resetPasswordHint");
      const confirmHint = document.getElementById("resetConfirmHint");
      if (passwordHint) {
        passwordHint.style.color = "var(--text-light)";
        passwordHint.textContent = "A senha deve ter no mínimo 6 caracteres";
      }
      if (confirmHint) {
        confirmHint.style.color = "var(--text-light)";
        confirmHint.textContent = "Digite a mesma senha para confirmar";
      }

      // Limpa bordas
      document.getElementById("resetNewPassword").style.borderColor = "";
      document.getElementById("resetConfirmPassword").style.borderColor = "";
    } else {
      throw new Error(data.message || "Erro ao resetar senha");
    }
  } catch (error) {
    resultDiv.innerHTML = `
            <div style="background:#fed7d7;padding:15px;border-radius:6px;color:#9b2c2c;">
                <h4>❌ Erro</h4>
                <p>${error.message}</p>
            </div>
        `;
    showToast(`❌ ${error.message}`, "error");
  }
}

// ============================================
// EMAIL OTP - SEND
// ============================================
async function sendEmailOTP() {
  const email =
    document.getElementById("loginEmail").value || window._loginEmail;
  if (!email) {
    showToast("❌ Email não informado", "error");
    return;
  }

  const btn = document.querySelector("#emailOtpField .btn-info");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "⏳ Enviando...";
  }

  try {
    const response = await fetch(`${API_URL}/otp/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, purpose: "login" }),
    });
    const data = await response.json();

    if (data.success) {
      showToast("📧 Código enviado para seu email!", "success");
      add2FATestLog("📧 Email OTP - Enviado para " + email);
      if (data.debug_otp) {
        console.log("🔑 Debug OTP:", data.debug_otp);
      }
    } else {
      throw new Error(data.error || "Erro ao enviar código");
    }
  } catch (error) {
    showToast(`❌ ${error.message}`, "error");
    add2FATestLog("❌ Email OTP - Falha: " + error.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = "📧 Enviar";
    }
  }
}

// ============================================
// REGISTRO COM OTP
// ============================================
async function initRegister() {
  const email = document.getElementById("registerEmail").value.trim();
  const password = document.getElementById("registerPassword").value;
  const full_name = document.getElementById("registerFullName").value.trim();
  const phone = document.getElementById("registerPhone").value.trim();

  if (!email || !password) {
    showToast("❌ Email e senha são obrigatórios", "error");
    return;
  }

  if (password.length < 6) {
    showToast("❌ A senha deve ter no mínimo 6 caracteres", "error");
    return;
  }

  const resultDiv = document.getElementById("registerResult");
  resultDiv.innerHTML =
    '<div class="loading">Enviando código de verificação...</div>';

  try {
    const response = await fetch(`${API_URL}/register/init`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, full_name, phone }),
    });
    const data = await response.json();

    if (data.success) {
      registerEmail = email;
      registerOTPSent = true;

      document.getElementById("registerOtpField").style.display = "block";
      document.getElementById("registerBtn").style.display = "none";
      document.getElementById("verifyRegisterBtn").style.display = "block";

      resultDiv.innerHTML = `
                <div style="background:#c6f6d5;padding:15px;border-radius:6px;color:#22543d;">
                    <h4>✅ Código enviado!</h4>
                    <p>Um código de verificação foi enviado para <strong>${email}</strong></p>
                    <p style="font-size:0.8rem;margin-top:5px;">O código é válido por 10 minutos.</p>
                    ${data.debug_otp ? `<p style="font-size:0.7rem;color:#718096;">🔑 Debug: ${data.debug_otp}</p>` : ""}
                </div>
            `;
      showToast("📧 Código enviado para seu email!", "success");
    } else {
      throw new Error(data.error || "Erro ao iniciar registro");
    }
  } catch (error) {
    resultDiv.innerHTML = `
            <div style="background:#fed7d7;padding:15px;border-radius:6px;color:#9b2c2c;">
                <h4>❌ Erro</h4>
                <p>${error.message}</p>
            </div>
        `;
    showToast(`❌ ${error.message}`, "error");
  }
}

async function verifyRegisterOTP() {
  const otp = document.getElementById("registerOtpCode").value;

  if (!otp || otp.length !== 6) {
    showToast("❌ Digite o código de 6 dígitos", "error");
    return;
  }

  const resultDiv = document.getElementById("registerResult");
  resultDiv.innerHTML =
    '<div class="loading">Verificando código e criando conta...</div>';

  try {
    const response = await fetch(`${API_URL}/register/verify-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: registerEmail, otp_code: otp }),
    });
    const data = await response.json();

    if (data.success) {
      if (data.access_token) {
        TOKEN = data.access_token;
        localStorage.setItem("token", TOKEN);
        currentUser = data.user;
        updateAuthStatus();
      }

      resultDiv.innerHTML = `
                <div style="background:#c6f6d5;padding:15px;border-radius:6px;color:#22543d;">
                    <h4>🎉 Conta criada com sucesso!</h4>
                    <p><strong>Email:</strong> ${data.user.email}</p>
                    <p><strong>Nome:</strong> ${data.user.full_name}</p>
                    <p style="font-size:0.8rem;margin-top:5px;">Você já está logado!</p>
                </div>
            `;
      showToast("🎉 Conta criada com sucesso!", "success");

      document.getElementById("registerEmail").value = "";
      document.getElementById("registerPassword").value = "";
      document.getElementById("registerFullName").value = "";
      document.getElementById("registerPhone").value = "";
      document.getElementById("registerOtpCode").value = "";
      document.getElementById("registerOtpField").style.display = "none";
      document.getElementById("registerBtn").style.display = "block";
      document.getElementById("verifyRegisterBtn").style.display = "none";

      loadUsers();
      check2FAStatus();
    } else {
      throw new Error(data.error || "Erro ao verificar código");
    }
  } catch (error) {
    resultDiv.innerHTML = `
            <div style="background:#fed7d7;padding:15px;border-radius:6px;color:#9b2c2c;">
                <h4>❌ Erro</h4>
                <p>${error.message}</p>
            </div>
        `;
    showToast(`❌ ${error.message}`, "error");
  }
}

async function resendRegisterOTP() {
  if (!registerEmail) {
    showToast("❌ Email não encontrado", "error");
    return;
  }

  const resultDiv = document.getElementById("registerResult");
  resultDiv.innerHTML = '<div class="loading">Reenviando código...</div>';

  try {
    const response = await fetch(`${API_URL}/register/resend-otp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: registerEmail }),
    });
    const data = await response.json();

    if (data.success) {
      resultDiv.innerHTML = `
                <div style="background:#c6f6d5;padding:15px;border-radius:6px;color:#22543d;">
                    <h4>✅ Novo código enviado!</h4>
                    <p>Verifique seu email <strong>${registerEmail}</strong></p>
                    ${data.debug_otp ? `<p style="font-size:0.7rem;color:#718096;">🔑 Debug: ${data.debug_otp}</p>` : ""}
                </div>
            `;
      showToast("📧 Novo código enviado!", "success");
    } else {
      throw new Error(data.error || "Erro ao reenviar código");
    }
  } catch (error) {
    resultDiv.innerHTML = `
            <div style="background:#fed7d7;padding:15px;border-radius:6px;color:#9b2c2c;">
                <h4>❌ Erro</h4>
                <p>${error.message}</p>
            </div>
        `;
    showToast(`❌ ${error.message}`, "error");
  }
}

// ============================================
// TOTP - SETUP, VERIFY, REGENERATE
// ============================================
async function setupTOTP() {
  if (!(await requireAuth())) return;

  const resultDiv = document.getElementById("totpSetupResult");
  resultDiv.innerHTML = '<div class="loading">Gerando QR Code...</div>';

  try {
    const response = await fetch(`${API_URL}/totp/setup`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const data = await response.json();

    if (data.success) {
      resultDiv.innerHTML = `
                <div style="text-align:center;">
                    <h4>📱 Escaneie o QR Code</h4>
                    <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(data.qrCodeURL)}" 
                         alt="QR Code" style="border:2px solid #667eea;border-radius:8px;max-width:200px;">
                    <p style="margin-top:10px;font-size:0.8rem;">
                        <strong>Secret:</strong> <code>${data.secret}</code>
                    </p>
                    <div style="background:#fffff0;padding:10px;border-radius:6px;text-align:left;margin-top:10px;">
                        <strong>🔑 Códigos de Backup:</strong>
                        ${data.backupCodes.map((c) => `<div><code>${c}</code></div>`).join("")}
                    </div>
                    <p style="color:#e53e3e;font-weight:600;margin-top:10px;font-size:0.85rem;">
                        ⚠️ Guarde os códigos de backup em local seguro!
                    </p>
                </div>
            `;
      showToast("✅ QR Code gerado!", "success");
      add2FATestLog("🔧 TOTP - QR Code gerado");
    } else {
      throw new Error(data.error || "Erro ao gerar QR Code");
    }
  } catch (error) {
    resultDiv.innerHTML = `<p style="color:#fc8181;">❌ ${error.message}</p>`;
    showToast(`❌ ${error.message}`, "error");
  }
}

async function verifyTOTP() {
  if (!(await requireAuth())) return;

  const code = document.getElementById("verifyTotpCode").value;
  if (!code || code.length !== 6) {
    showToast("❌ Digite um código de 6 dígitos", "error");
    return;
  }

  const resultDiv = document.getElementById("totpVerifyResult");
  resultDiv.innerHTML = '<div class="loading">Verificando...</div>';

  try {
    const response = await fetch(`${API_URL}/totp/verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });
    const data = await response.json();

    if (data.success) {
      resultDiv.innerHTML = `
                <div style="background:#c6f6d5;padding:15px;border-radius:6px;color:#22543d;">
                    <h4>✅ TOTP verificado com sucesso!</h4>
                    <p>${data.message}</p>
                </div>
            `;
      showToast("✅ TOTP verificado!", "success");
      add2FATestLog("✅ TOTP - Verificado com sucesso");
      check2FAStatus();
    } else {
      throw new Error(data.error || "Código inválido");
    }
  } catch (error) {
    resultDiv.innerHTML = `<p style="color:#fc8181;">❌ ${error.message}</p>`;
    showToast(`❌ ${error.message}`, "error");
    add2FATestLog(`❌ TOTP - Falha: ${error.message}`);
  }
}

async function regenerateBackupCodes() {
  if (!(await requireAuth())) return;

  const resultDiv = document.getElementById("backupResult");
  resultDiv.innerHTML = '<div class="loading">Gerando novos códigos...</div>';

  try {
    const response = await fetch(`${API_URL}/totp/regenerate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();

    if (data.success) {
      resultDiv.innerHTML = `
                <div style="background:#fffff0;padding:15px;border-radius:6px;border:1px solid #f6e05e;">
                    <h4>🔑 NOVOS CÓDIGOS DE BACKUP:</h4>
                    ${data.backupCodes.map((c) => `<div><code>${c}</code></div>`).join("")}
                    <p style="color:#e53e3e;font-weight:600;margin-top:10px;font-size:0.85rem;">
                        ⚠️ Guarde os novos códigos em local seguro!
                    </p>
                </div>
            `;
      showToast("✅ Novos códigos de backup gerados!", "success");
      add2FATestLog("🔄 Backup Codes - Regenerados");
    } else {
      throw new Error(data.error || "Erro ao regenerar");
    }
  } catch (error) {
    resultDiv.innerHTML = `<p style="color:#fc8181;">❌ ${error.message}</p>`;
    showToast(`❌ ${error.message}`, "error");
  }
}

// ============================================
// 2FA MANAGEMENT
// ============================================
async function check2FAStatus() {
  if (!TOKEN) {
    document.getElementById("twoFAStatusContent").innerHTML =
      '<p style="color:var(--text-light);">Faça login para verificar o status do 2FA</p>';
    return;
  }

  try {
    const response = await fetch(`${API_URL}/2fa/status`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const data = await response.json();

    if (data.success) {
      const status = data.data;
      document.getElementById("twoFAStatusContent").innerHTML = `
                <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:15px;margin-top:10px;">
                    <div style="background:var(--bg-primary);padding:15px;border-radius:8px;">
                        <strong>📧 Email OTP</strong>
                        <div style="margin-top:5px;">
                            <span class="status-badge ${status.email_enabled ? "active" : "inactive"}">
                                ${status.email_enabled ? "✅ Ativo" : "❌ Desativado"}
                            </span>
                        </div>
                    </div>
                    <div style="background:var(--bg-primary);padding:15px;border-radius:8px;">
                        <strong>📱 Google Authenticator</strong>
                        <div style="margin-top:5px;">
                            <span class="status-badge ${status.totp_enabled ? "active" : "inactive"}">
                                ${status.totp_enabled ? "✅ Ativo" : "❌ Desativado"}
                            </span>
                        </div>
                    </div>
                    <div style="background:var(--bg-primary);padding:15px;border-radius:8px;">
                        <strong>🔑 Método Selecionado</strong>
                        <div style="margin-top:5px;">
                            <span class="status-badge verified">
                                ${
                                  status.method === "both"
                                    ? "🔗 Ambos"
                                    : status.method === "email"
                                      ? "📧 Email"
                                      : status.method === "totp"
                                        ? "📱 TOTP"
                                        : "❌ Nenhum"
                                }
                            </span>
                        </div>
                    </div>
                </div>
            `;

      document.getElementById("twoFABadge").textContent =
        status.method === "both"
          ? "Ambos"
          : status.method === "email"
            ? "Email"
            : status.method === "totp"
              ? "TOTP"
              : "Configurar";

      select2FAMethod(status.method || "both");
    }
  } catch (error) {
    console.error("Erro ao verificar status 2FA:", error);
  }
}

function select2FAMethod(method) {
  selected2FAMethod = method;

  document
    .querySelectorAll(".method-card")
    .forEach((c) => c.classList.remove("selected"));
  document
    .getElementById(`method${method.charAt(0).toUpperCase() + method.slice(1)}`)
    .classList.add("selected");

  document
    .querySelectorAll(".twofa-config")
    .forEach((c) => (c.style.display = "none"));

  if (method === "email" || method === "both") {
    document.getElementById("emailConfig").style.display = "block";
  }
  if (method === "totp" || method === "both") {
    document.getElementById("totpConfig").style.display = "block";
  }
  if (method === "totp" || method === "both") {
    document.getElementById("backupConfig").style.display = "block";
  }
}

async function load2FASettings() {
  if (!TOKEN) return;
  try {
    const response = await fetch(`${API_URL}/2fa/settings`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
    });
    const data = await response.json();
    if (data.success) {
      const settings = data.data;
      document.getElementById("emailBadge").textContent = settings.email_enabled
        ? "✅ Ativo"
        : "❌ Desativado";
      document.getElementById("totpBadge").textContent = settings.totp_enabled
        ? "✅ Ativo"
        : "❌ Desativado";

      if (settings.email_enabled) {
        document.getElementById("enableEmailBtn").textContent =
          "✅ Email OTP Ativo";
        document.getElementById("enableEmailBtn").className = "btn btn-success";
      } else {
        document.getElementById("enableEmailBtn").textContent =
          "📧 Ativar Email OTP";
        document.getElementById("enableEmailBtn").className = "btn btn-info";
      }
    }
  } catch (error) {
    console.error("Erro ao carregar configurações 2FA:", error);
  }
}

async function enableEmailOTP() {
  if (!(await requireAuth())) return;

  try {
    const response = await fetch(`${API_URL}/2fa/enable-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();

    if (data.success) {
      showToast("✅ Email OTP ativado!", "success");
      add2FATestLog("📧 Email OTP - Ativado");
      load2FASettings();
      check2FAStatus();
    } else {
      throw new Error(data.error || "Erro ao ativar Email OTP");
    }
  } catch (error) {
    showToast(`❌ ${error.message}`, "error");
  }
}

async function disable2FA() {
  if (!(await requireAuth())) return;

  const code = document.getElementById("disable2FACode").value;
  if (!code || code.length !== 6) {
    showToast("❌ Digite o código 2FA para desabilitar", "error");
    return;
  }

  if (!confirm("⚠️ Tem certeza que deseja desabilitar o 2FA?")) return;

  try {
    const response = await fetch(`${API_URL}/2fa/disable`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code }),
    });
    const data = await response.json();

    if (data.success) {
      showToast("✅ 2FA desabilitado!", "success");
      add2FATestLog("🚫 2FA - Desabilitado");
      check2FAStatus();
      load2FASettings();
    } else {
      throw new Error(data.error || "Erro ao desabilitar 2FA");
    }
  } catch (error) {
    showToast(`❌ ${error.message}`, "error");
    add2FATestLog(`❌ 2FA - Falha ao desabilitar: ${error.message}`);
  }
}

// ============================================
// 2FA - LOGS
// ============================================
function add2FATestLog(message) {
  const timestamp = new Date().toLocaleString();
  twoFATestLogs.unshift({ timestamp, message });
  if (twoFATestLogs.length > 50) twoFATestLogs.pop();
  render2FATestLogs();
}

function render2FATestLogs() {
  const container = document.getElementById("twoFATestLogs");
  if (twoFATestLogs.length === 0) {
    container.innerHTML =
      '<p style="color:var(--text-light);">Nenhum teste realizado</p>';
    return;
  }
  container.innerHTML = twoFATestLogs
    .map(
      (log) => `
        <div style="padding:3px 0;border-bottom:1px solid var(--border-color);font-size:0.75rem;">
            <span style="color:var(--text-light);">[${log.timestamp}]</span>
            <span>${log.message}</span>
        </div>
    `,
    )
    .join("");
}

// ============================================
// LOAD USERS
// ============================================
async function loadUsers() {
  const tbody = document.getElementById("usersTableBody");
  tbody.innerHTML =
    '<tr><td colspan="8" class="loading">Carregando usuários...</td></tr>';

  try {
    const response = await fetch(`${API_URL}/admin/users`);
    const data = await response.json();

    if (data.success) {
      allUsers = data.users || [];
      document.getElementById("userCountBadge").textContent = allUsers.length;
      updateStats(allUsers);
      applyFilters();
      updateCharts();
      document.getElementById("lastUpdate").textContent =
        new Date().toLocaleString();
    } else {
      throw new Error(data.error || "Erro ao carregar usuários");
    }
  } catch (error) {
    tbody.innerHTML = `
            <tr><td colspan="8" style="text-align:center;padding:40px;color:#fc8181;">
                ❌ Erro: ${error.message}
            </td></tr>
        `;
    showToast(`❌ ${error.message}`, "error");
  }
}

function updateStats(users) {
  const total = users.length;
  const email2FA = users.filter((u) => u.hasEmailOTP).length;
  const totp2FA = users.filter((u) => u.hasTOTP).length;
  const no2FA = users.filter((u) => !u.hasEmailOTP && !u.hasTOTP).length;

  document.getElementById("totalUsers").textContent = total;
  document.getElementById("email2FA").textContent = email2FA;
  document.getElementById("totp2FA").textContent = totp2FA;
  document.getElementById("without2FA").textContent = no2FA;
}

function applyFilters() {
  const status = document.getElementById("filterStatus").value;
  const dateFrom = document.getElementById("filterDateFrom").value;
  const dateTo = document.getElementById("filterDateTo").value;
  const search = document
    .getElementById("globalSearch")
    .value.toLowerCase()
    .trim();

  filteredUsers = allUsers.filter((user) => {
    if (status === "email" && !user.hasEmailOTP) return false;
    if (status === "totp" && !user.hasTOTP) return false;
    if (status === "both" && (!user.hasEmailOTP || !user.hasTOTP)) return false;
    if (status === "no2fa" && (user.hasEmailOTP || user.hasTOTP)) return false;
    if (dateFrom && new Date(user.created_at) < new Date(dateFrom))
      return false;
    if (dateTo && new Date(user.created_at) > new Date(dateTo)) return false;
    if (search) {
      return (
        user.email?.toLowerCase().includes(search) ||
        user.full_name?.toLowerCase().includes(search) ||
        user.id?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  document.getElementById("filterCount").textContent =
    `Mostrando ${filteredUsers.length} usuários`;
  currentPage = 1;
  renderPage();
}

function clearFilters() {
  document.getElementById("filterStatus").value = "all";
  document.getElementById("filterDateFrom").value = "";
  document.getElementById("filterDateTo").value = "";
  document.getElementById("globalSearch").value = "";
  applyFilters();
}

function sortTable(field) {
  if (sortField === field) {
    sortDirection = sortDirection === "asc" ? "desc" : "asc";
  } else {
    sortField = field;
    sortDirection = "asc";
  }
  renderPage();
}

function renderPage() {
  const sorted = [...filteredUsers].sort((a, b) => {
    let aVal = a[sortField] || "";
    let bVal = b[sortField] || "";
    if (typeof aVal === "string") aVal = aVal.toLowerCase();
    if (typeof bVal === "string") bVal = bVal.toLowerCase();
    if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
    if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  const totalPages = Math.ceil(sorted.length / itemsPerPage);
  const start = (currentPage - 1) * itemsPerPage;
  const end = start + itemsPerPage;
  const pageUsers = sorted.slice(start, end);

  document.getElementById("pageInfo").textContent =
    `Página ${currentPage} de ${totalPages || 1}`;
  document.getElementById("prevPageBtn").disabled = currentPage === 1;
  document.getElementById("nextPageBtn").disabled =
    currentPage === totalPages || totalPages === 0;

  renderUsers(pageUsers);
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderPage();
  }
}
function nextPage() {
  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderPage();
  }
}

function renderUsers(users) {
  const tbody = document.getElementById("usersTableBody");
  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-light);">Nenhum usuário encontrado</td></tr>`;
    return;
  }

  tbody.innerHTML = users
    .map((user, index) => {
      const isSelected = selectedUsers.includes(user.id);
      const method =
        user.hasEmailOTP && user.hasTOTP
          ? "🔗 Ambos"
          : user.hasEmailOTP
            ? "📧 Email"
            : user.hasTOTP
              ? "📱 TOTP"
              : "❌ Nenhum";
      return `
        <tr class="${isSelected ? "selected" : ""}">
            <td><input type="checkbox" class="user-checkbox" value="${user.id}" ${isSelected ? "checked" : ""} onchange="toggleUserSelect('${user.id}')"></td>
            <td>${(currentPage - 1) * itemsPerPage + index + 1}</td>
            <td><strong>${user.full_name || user.email}</strong><br><span class="user-id">${user.id.substring(0, 8)}...</span></td>
            <td>${user.email}</td>
            <td><span class="status-badge ${user.hasEmailOTP || user.hasTOTP ? "active" : "inactive"}">${method}</span></td>
            <td><span class="status-badge ${user.hasEmailOTP || user.hasTOTP ? "active" : "inactive"}">${user.hasEmailOTP || user.hasTOTP ? "✅ Protegido" : "❌ Inativo"}</span></td>
            <td style="font-size:0.75rem;color:var(--text-light);">${formatDate(user.created_at)}</td>
            <td>
                <div class="actions">
                    <button class="btn btn-info btn-sm" onclick="showUserDetails('${user.id}')" title="Detalhes">📋</button>
                    <button class="btn btn-warning btn-sm" onclick="showResetPasswordAdmin('${user.id}')" title="Resetar Senha">🔑</button>
                    <button class="btn btn-danger btn-sm" onclick="deleteUser('${user.id}')" title="Deletar">🗑️</button>
                </div>
            </td>
        </tr>
    `;
    })
    .join("");
}

// ============================================
// SELECTION
// ============================================
function toggleSelectAll() {
  const checked = document.getElementById("selectAll").checked;
  document
    .querySelectorAll(".user-checkbox")
    .forEach((cb) => (cb.checked = checked));
  selectedUsers = checked ? filteredUsers.map((u) => u.id) : [];
  updateBulkActions();
}

function toggleUserSelect(userId) {
  const index = selectedUsers.indexOf(userId);
  if (index > -1) {
    selectedUsers.splice(index, 1);
  } else {
    selectedUsers.push(userId);
  }
  updateBulkActions();
}

function updateBulkActions() {
  const bulk = document.getElementById("bulkActions");
  if (selectedUsers.length > 0) {
    bulk.style.display = "flex";
    document.getElementById("selectedCount").textContent =
      `${selectedUsers.length} selecionados`;
  } else {
    bulk.style.display = "none";
  }
  document.getElementById("selectAll").checked =
    selectedUsers.length === filteredUsers.length && filteredUsers.length > 0;
}

// ============================================
// CHARTS
// ============================================
function updateCharts() {
  if (charts.growth) {
    charts.growth.destroy();
  }
  const ctx = document.getElementById("growthChart");
  if (ctx) {
    charts.growth = new Chart(ctx, {
      type: "line",
      data: {
        labels: ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"],
        datasets: [
          {
            label: "Usuários",
            data: [10, 20, 35, 50, 70, 100],
            borderColor: "#667eea",
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
      },
    });
  }
}

// ============================================
// USER DETAILS
// ============================================
async function showUserDetails(userId) {
  const modal = document.getElementById("detailModal");
  const body = document.getElementById("detailModalBody");
  modal.classList.add("active");
  body.innerHTML = '<div class="loading">Carregando detalhes...</div>';

  try {
    const response = await fetch(`${API_URL}/admin/users/${userId}`);
    const data = await response.json();

    if (data.success) {
      const user = data.user;
      body.innerHTML = `
                <div class="detail-row"><span class="detail-label">ID</span><span class="detail-value"><code>${user.user_id}</code></span></div>
                <div class="detail-row"><span class="detail-label">Nome</span><span class="detail-value"><strong>${user.full_name || "-"}</strong></span></div>
                <div class="detail-row"><span class="detail-label">Email</span><span class="detail-value">${user.email}</span></div>
                <div class="detail-row"><span class="detail-label">2FA Email</span><span class="detail-value">${user.hasEmailOTP ? "✅ Ativo" : "❌ Inativo"}</span></div>
                <div class="detail-row"><span class="detail-label">Google Auth</span><span class="detail-value">${user.hasTOTP ? "✅ Ativo" : "❌ Inativo"}</span></div>
                <div class="detail-row"><span class="detail-label">Criado em</span><span class="detail-value">${formatDate(user.created_at)}</span></div>
            `;
    }
  } catch (error) {
    body.innerHTML = `<p style="color:#fc8181;">❌ Erro: ${error.message}</p>`;
  }
}

// ============================================
// RESET PASSWORD (ADMIN)
// ============================================
function showResetPasswordAdmin(userId) {
  selectedUserId = userId;
  document.getElementById("newPassword").value = "";
  document.getElementById("confirmPassword").value = "";
  document.getElementById("resetPasswordModal").classList.add("active");
}

async function resetPasswordAdmin() {
  const password = document.getElementById("newPassword").value;
  const confirm = document.getElementById("confirmPassword").value;
  if (!password || password.length < 6) {
    showToast("❌ A senha deve ter no mínimo 6 caracteres", "error");
    document.getElementById("newPassword").focus();
    return;
  }
  if (password !== confirm) {
    showToast("❌ As senhas não coincidem", "error");
    document.getElementById("confirmPassword").value = "";
    document.getElementById("confirmPassword").focus();
    return;
  }

  try {
    const response = await fetch(`${API_URL}/admin/users/reset-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: selectedUserId, new_password: password }),
    });
    const data = await response.json();
    if (data.success) {
      showToast("✅ Senha resetada!", "success");
      closeModal("resetPasswordModal");
      loadUsers();
    } else {
      throw new Error(data.error || "Erro ao resetar");
    }
  } catch (error) {
    showToast(`❌ ${error.message}`, "error");
  }
}

// ============================================
// CREATE USER
// ============================================
function showCreateUser() {
  document.getElementById("newUserEmail").value = "";
  document.getElementById("newUserPassword").value = "";
  document.getElementById("newUserFullName").value = "";
  document.getElementById("newUserPhone").value = "";
  document.getElementById("createUserModal").classList.add("active");
}

async function createUser() {
  const email = document.getElementById("newUserEmail").value.trim();
  const password = document.getElementById("newUserPassword").value;
  const full_name = document.getElementById("newUserFullName").value.trim();
  const phone = document.getElementById("newUserPhone").value.trim();

  if (!email || !password) {
    showToast("❌ Email e senha obrigatórios", "error");
    return;
  }
  if (password.length < 6) {
    showToast("❌ A senha deve ter no mínimo 6 caracteres", "error");
    return;
  }

  try {
    const response = await fetch(`${API_URL}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        password,
        full_name: full_name || email.split("@")[0],
        phone,
      }),
    });
    const data = await response.json();
    if (data.success) {
      showToast("✅ Usuário criado!", "success");
      closeModal("createUserModal");
      loadUsers();
    } else {
      throw new Error(data.error || "Erro ao criar");
    }
  } catch (error) {
    showToast(`❌ ${error.message}`, "error");
  }
}

// ============================================
// DELETE USER
// ============================================
async function deleteUser(userId) {
  const user = allUsers.find((u) => u.id === userId);
  if (!confirm(`⚠️ Deletar "${user?.email || userId}"?`)) return;
  try {
    const response = await fetch(`${API_URL}/admin/users/delete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    const data = await response.json();
    if (data.success) {
      showToast("✅ Usuário deletado!", "success");
      loadUsers();
    } else {
      throw new Error(data.error || "Erro ao deletar");
    }
  } catch (error) {
    showToast(`❌ ${error.message}`, "error");
  }
}

// ============================================
// LOGS
// ============================================
async function loadLogs() {
  const container = document.getElementById("logsContent");
  container.innerHTML = '<div class="loading">Carregando logs...</div>';
  try {
    const response = await fetch(`${API_URL}/logs`);
    const data = await response.json();
    if (data.success) {
      logEntries = data.logs || [];
      container.innerHTML = logEntries
        .map(
          (log) => `
                <div class="log-entry">
                    <span class="log-time">${new Date(log.timestamp).toLocaleString()}</span>
                    <span class="log-method ${log.method}">${log.method}</span>
                    <span class="log-status ${log.status < 400 ? "success" : "error"}">${log.status}</span>
                    <span class="log-path">${log.path}</span>
                </div>
            `,
        )
        .join("");
    }
  } catch (error) {
    container.innerHTML = `<p style="color:#fc8181;">❌ ${error.message}</p>`;
  }
}

function clearLogs() {
  if (!confirm("Limpar todos os logs?")) return;
  logEntries = [];
  document.getElementById("logsContent").innerHTML =
    '<p style="color:var(--text-light);text-align:center;padding:40px;">Logs limpos</p>';
  showToast("🗑️ Logs limpos", "info");
}

// ============================================
// HELPERS
// ============================================
function formatDate(date) {
  if (!date) return "-";
  const d = new Date(date);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR");
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove("active");
}

function globalSearch(value) {
  clearTimeout(window.searchTimeout);
  window.searchTimeout = setTimeout(() => applyFilters(), 300);
}

// Fechar modais com ESC
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document
      .querySelectorAll(".modal.active")
      .forEach((modal) => modal.classList.remove("active"));
  }
});

// ============================================
// EXPORTAR PARA USO GLOBAL
// ============================================
window.loadUsers = loadUsers;
window.applyFilters = applyFilters;
window.clearFilters = clearFilters;
window.sortTable = sortTable;
window.prevPage = prevPage;
window.nextPage = nextPage;
window.switchTab = switchTab;
window.toggleDarkMode = toggleDarkMode;
window.toggleSidebar = toggleSidebar;
window.toggleSelectAll = toggleSelectAll;
window.toggleUserSelect = toggleUserSelect;
window.showUserDetails = showUserDetails;
window.showResetPasswordAdmin = showResetPasswordAdmin;
window.resetPasswordAdmin = resetPasswordAdmin;
window.deleteUser = deleteUser;
window.showCreateUser = showCreateUser;
window.createUser = createUser;
window.closeModal = closeModal;
window.globalSearch = globalSearch;
window.showToast = showToast;
window.login = login;
window.logout = logout;
window.sendEmailOTP = sendEmailOTP;
window.setupTOTP = setupTOTP;
window.verifyTOTP = verifyTOTP;
window.regenerateBackupCodes = regenerateBackupCodes;
window.disable2FA = disable2FA;
window.check2FAStatus = check2FAStatus;
window.load2FASettings = load2FASettings;
window.select2FAMethod = select2FAMethod;
window.enableEmailOTP = enableEmailOTP;
window.initRegister = initRegister;
window.verifyRegisterOTP = verifyRegisterOTP;
window.resendRegisterOTP = resendRegisterOTP;
window.requestReset = requestReset;
window.resendResetOTP = resendResetOTP;
window.resetPassword = resetPassword;
window.checkToken = checkToken;
window.requireAuth = requireAuth;
