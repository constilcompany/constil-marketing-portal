// main.ts
// ============================================
// IMPORTAÇÕES
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as OTPAuth from "https://esm.sh/otpauth@9.1.3";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// ============================================
// CARREGA O .env COM DOTENV
// ============================================

// Tenta carregar com dotenv
let env: Record<string, string> = {};
try {
    env = await load();
    console.log("✅ Dotenv carregado com sucesso");
} catch (error) {
    console.log("⚠️ Erro ao carregar dotenv:", error.message);
}

// Função para obter variáveis com fallback
function getEnv(key: string): string | undefined {
    // Primeiro tenta do env carregado
    if (env[key]) return env[key];
    // Depois tenta do Deno.env
    if (Deno.env.get(key)) return Deno.env.get(key);
    return undefined;
}

const SUPABASE_URL = getEnv("SUPABASE_URL");
const SUPABASE_ANON_KEY = getEnv("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = getEnv("SUPABASE_SERVICE_ROLE_KEY");
const SENDGRID_API_KEY = getEnv("SENDGRID_API_KEY");

// ============================================
// VARIÁVEIS GLOBAIS
// ============================================

// EMAIL REMETENTE PARA ENVIO DE OTP (DEVE ESTAR VERIFICADO NO SENDGRID)
const FROM_EMAIL = "na2841090@gmail.com";
const FROM_NAME = "Constil";

console.log("\n🔍 VARIÁVEIS DE AMBIENTE (via dotenv):");
console.log("========================================");
console.log("SUPABASE_URL:", SUPABASE_URL ? "✅ " + SUPABASE_URL : "❌ NÃO ENCONTRADA");
console.log("SUPABASE_ANON_KEY:", SUPABASE_ANON_KEY ? "✅ CONFIGURADA" : "❌ NÃO ENCONTRADA");
console.log("SUPABASE_SERVICE_ROLE_KEY:", SUPABASE_SERVICE_ROLE_KEY ? "✅ CONFIGURADA" : "❌ NÃO ENCONTRADA");
console.log("SENDGRID_API_KEY:", SENDGRID_API_KEY ? "✅ " + SENDGRID_API_KEY.substring(0, 15) + "..." : "❌ NÃO CONFIGURADA");
console.log("FROM_EMAIL:", FROM_EMAIL ? "✅ " + FROM_EMAIL : "❌ NÃO CONFIGURADO");
console.log("========================================\n");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ ERRO: Variáveis de ambiente não configuradas!");
    console.log("\n💡 Verifique se o arquivo .env existe e tem as chaves:");
    console.log("SUPABASE_URL=https://seuprojeto.supabase.co");
    console.log("SUPABASE_ANON_KEY=sua_chave_anon");
    console.log("SUPABASE_SERVICE_ROLE_KEY=sua_chave_service");
    Deno.exit(1);
}

// ============================================
// CRIA O CLIENTE SUPABASE
// ============================================

const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
);

console.log("✅ Cliente Supabase inicializado!");
console.log("📡 Servidor rodando em http://localhost:8000/\n");

// ============================================
// CONFIGURAÇÕES CORS E HELPERS
// ============================================

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};

const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

// ============================================
// SISTEMA DE LOGS
// ============================================

const requestLogs: any[] = [];
const MAX_LOGS = 1000;

function logRequest(method: string, path: string, status: number, duration: number, body?: any, error?: any) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        method,
        path,
        status,
        duration: `${duration}ms`,
        body: body ? JSON.stringify(body).substring(0, 500) : null,
        error: error ? {
            message: error.message || error,
            stack: error.stack,
        } : null,
    };

    requestLogs.unshift(logEntry);
    if (requestLogs.length > MAX_LOGS) {
        requestLogs.pop();
    }

    const statusColor = status >= 200 && status < 300 ? '\x1b[32m' :
        status >= 400 && status < 500 ? '\x1b[33m' :
            status >= 500 ? '\x1b[31m' : '\x1b[0m';

    console.log(
        `${statusColor}[${status}]\x1b[0m`,
        `${method.padEnd(6)}`,
        path,
        `(${duration}ms)`,
        error ? `❌ ${error.message || error}` : ''
    );

    if (error) {
        console.error('\x1b[31m', '  └─ Detalhes:', error.stack || error, '\x1b[0m');
    }
}

// ============================================
// FUNÇÕES DE VALIDAÇÃO
// ============================================

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPassword(password: string): boolean {
    return password.length >= 6 && password.length <= 128;
}

function sanitizeInput(input: any): string {
    if (!input || typeof input !== 'string') return '';
    return input.trim().replace(/[<>]/g, '');
}

// ============================================
// FUNÇÕES TOTP (GOOGLE AUTHENTICATOR)
// ============================================

function generateBackupCodes(): string[] {
    const codes: string[] = [];
    const usedCodes = new Set<string>();

    for (let i = 0; i < 10; i++) {
        let code: string;
        do {
            code = String(Math.floor(10000000 + Math.random() * 90000000));
        } while (usedCodes.has(code));
        usedCodes.add(code);
        codes.push(code);
    }

    return codes;
}

async function setupTOTP(supabase: any, userId: string, email: string) {
    const secret = new OTPAuth.Secret({ size: 20 });
    const secretBase32 = secret.base32;

    const totp = new OTPAuth.TOTP({
        issuer: "Constil",
        label: email,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
        secret: secret,
    });

    const qrCodeURL = totp.toString();
    const backupCodes = generateBackupCodes();

    const { data: existing } = await supabase
        .from("totp_secrets")
        .select("id")
        .eq("user_id", userId)
        .single();

    let error;
    if (existing) {
        const { error: updateError } = await supabase
            .from("totp_secrets")
            .update({
                secret: secretBase32,
                backup_codes: backupCodes,
                is_verified: false,
                updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);
        error = updateError;
    } else {
        const { error: insertError } = await supabase
            .from("totp_secrets")
            .insert({
                user_id: userId,
                secret: secretBase32,
                backup_codes: backupCodes,
                is_verified: false,
            });
        error = insertError;
    }

    if (error) throw new Error(`Failed to save TOTP secret: ${error.message}`);

    return {
        secret: secretBase32,
        qrCodeURL,
        backupCodes,
    };
}

async function verifyTOTP(supabase: any, userId: string, token: string) {
    const { data: totpData, error } = await supabase
        .from("totp_secrets")
        .select("*")
        .eq("user_id", userId)
        .single();

    if (error || !totpData) {
        return { valid: false, isBackupCode: false, message: "TOTP not configured" };
    }

    if (totpData.backup_codes?.includes(token)) {
        const updatedBackupCodes = totpData.backup_codes.filter(
            (code: string) => code !== token
        );

        await supabase
            .from("totp_secrets")
            .update({ backup_codes: updatedBackupCodes })
            .eq("user_id", userId);

        return { valid: true, isBackupCode: true, message: "Backup code used successfully" };
    }

    const secret = new OTPAuth.Secret({ base32: totpData.secret });
    const totp = new OTPAuth.TOTP({
        secret: secret,
        algorithm: "SHA1",
        digits: 6,
        period: 30,
    });

    const delta = totp.validate({ token, window: 1 });

    if (delta !== null) {
        if (!totpData.is_verified) {
            await supabase
                .from("totp_secrets")
                .update({
                    is_verified: true,
                    verified_at: new Date().toISOString(),
                })
                .eq("user_id", userId);
        }

        return { valid: true, isBackupCode: false, message: "TOTP verified successfully" };
    }

    return { valid: false, isBackupCode: false, message: "Invalid code" };
}

async function isTOTPActive(supabase: any, userId: string): Promise<boolean> {
    const { data, error } = await supabase
        .from("totp_secrets")
        .select("is_verified")
        .eq("user_id", userId)
        .single();

    if (error || !data) return false;
    return data.is_verified === true;
}

async function disableTOTP(supabase: any, userId: string): Promise<boolean> {
    const { error } = await supabase
        .from("totp_secrets")
        .delete()
        .eq("user_id", userId);

    return !error;
}

async function regenerateBackupCodes(supabase: any, userId: string): Promise<string[]> {
    const backupCodes = generateBackupCodes();

    const { error } = await supabase
        .from("totp_secrets")
        .update({
            backup_codes: backupCodes,
            updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

    if (error) throw new Error(`Failed to regenerate backup codes: ${error.message}`);

    return backupCodes;
}

async function getTOTPData(supabase: any, userId: string) {
    const { data, error } = await supabase
        .from("totp_secrets")
        .select("*")
        .eq("user_id", userId)
        .single();

    if (error) return null;
    return data;
}

// ============================================
// FUNÇÕES OTP POR EMAIL
// ============================================

function generateOTP(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
}

async function sendOTPEmail(
    email: string,
    otpCode: string,
    purpose: string = 'login'
): Promise<boolean> {
    const sendgridKey = SENDGRID_API_KEY;

    if (!sendgridKey) {
        console.error("❌ SENDGRID_API_KEY não configurada");
        return false;
    }

    const subjects = {
        login: '🔐 Seu código de acesso Constil',
        registration: '✅ Confirme seu cadastro Constil',
        verification: '✅ Verifique seu email Constil',
        password_reset: '🔑 Redefinição de senha Constil'
    };

    const titles = {
        login: 'Código de Acesso',
        registration: 'Confirme seu Cadastro',
        verification: 'Verificação de Email',
        password_reset: 'Redefinição de Senha'
    };

    const subject = subjects[purpose as keyof typeof subjects] || subjects.login;
    const title = titles[purpose as keyof typeof titles] || titles.login;

    const body = `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px; background: #f8f9fa; border-radius: 12px;">
            <div style="text-align: center; margin-bottom: 24px;">
                <h2 style="color: #1a1a2e; margin: 0;">🔐 ${FROM_NAME}</h2>
                <p style="color: #718096; margin: 4px 0 0;">Sua plataforma de gestão</p>
            </div>
            
            <div style="background: white; padding: 24px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05);">
                <h3 style="color: #1a1a2e; margin-top: 0;">${title}</h3>
                <p style="color: #4a5568; line-height: 1.6;">
                    ${purpose === 'registration'
            ? 'Use o código abaixo para confirmar seu cadastro e criar sua conta.'
            : purpose === 'login'
                ? 'Use o código abaixo para acessar sua conta.'
                : purpose === 'password_reset'
                    ? 'Use o código abaixo para redefinir sua senha.'
                    : 'Use o código abaixo para verificar seu email.'
        }
                    Este código é válido por <strong>10 minutos</strong>.
                </p>
                
                <div style="background: #f0f2f5; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                    <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #1a1a2e; font-family: monospace;">
                        ${otpCode}
                    </span>
                </div>
                
                <p style="color: #718096; font-size: 12px; margin-bottom: 0;">
                    ⚠️ Se você não solicitou este código, ignore este email.
                </p>
            </div>
            
            <div style="text-align: center; margin-top: 24px; color: #a0aec0; font-size: 12px;">
                <p>© ${new Date().getFullYear()} ${FROM_NAME}. Todos os direitos reservados.</p>
                <p>Este é um email automático, por favor não responda.</p>
            </div>
        </div>
    `;

    try {
        const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${sendgridKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                personalizations: [{ to: [{ email }] }],
                from: { email: FROM_EMAIL, name: FROM_NAME },
                subject,
                content: [{ type: "text/html", value: body }],
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("❌ Erro ao enviar email:", errorText);
            return false;
        }

        console.log(`✅ OTP enviado para ${email} (${purpose}) via ${FROM_EMAIL}`);
        return true;
    } catch (error) {
        console.error("❌ Erro ao enviar email:", error);
        return false;
    }
}

async function storeOTP(
    supabase: any,
    userId: string,
    email: string,
    purpose: string = 'login'
): Promise<{ otp: string; success: boolean }> {
    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    try {
        await supabase
            .from("email_otps")
            .update({ used: true })
            .eq("user_id", userId)
            .eq("used", false);

        const { error } = await supabase
            .from("email_otps")
            .insert({
                user_id: userId,
                email,
                otp_code: otp,
                purpose,
                expires_at: expiresAt.toISOString(),
                used: false,
            });

        if (error) {
            console.error("❌ Erro ao armazenar OTP:", error);
            return { otp, success: false };
        }

        return { otp, success: true };
    } catch (error) {
        console.error("❌ Erro ao armazenar OTP:", error);
        return { otp, success: false };
    }
}

async function verifyOTP(
    supabase: any,
    userId: string,
    otpCode: string,
    purpose: string = 'login'
): Promise<{ valid: boolean; message: string }> {
    try {
        const { data: otpRecord, error } = await supabase
            .from("email_otps")
            .select("*")
            .eq("user_id", userId)
            .eq("otp_code", otpCode)
            .eq("purpose", purpose)
            .eq("used", false)
            .gte("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (error || !otpRecord) {
            return { valid: false, message: "Código inválido ou expirado" };
        }

        if (otpRecord.attempts >= 5) {
            await supabase
                .from("email_otps")
                .update({ used: true })
                .eq("id", otpRecord.id);
            return { valid: false, message: "Muitas tentativas. Solicite um novo código." };
        }

        await supabase
            .from("email_otps")
            .update({ attempts: otpRecord.attempts + 1 })
            .eq("id", otpRecord.id);

        await supabase
            .from("email_otps")
            .update({ used: true })
            .eq("id", otpRecord.id);

        return { valid: true, message: "Código verificado com sucesso" };
    } catch (error) {
        console.error("❌ Erro ao verificar OTP:", error);
        return { valid: false, message: "Erro ao verificar código" };
    }
}

// ============================================
// FUNÇÕES RESET DE SENHA COM OTP
// ============================================

/**
 * Inicia o processo de reset de senha
 * Envia um OTP por email para o usuário
 */
// Substitua a função forgotPassword por esta versão com fallback

async function forgotPassword(
    supabase: any,
    email: string,
    clientIP?: string
): Promise<{ success: boolean; message: string; debug_otp?: string }> {
    if (!email || !isValidEmail(email)) {
        return { success: false, message: "Invalid email format" };
    }

    const { data: user, error } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", email)
        .single();

    if (error || !user) {
        return {
            success: true,
            message: "If the email exists, a reset code will be sent"
        };
    }

    const ip = clientIP || "unknown";
    const allowed = await checkRateLimit(supabase, `${ip}:${email}`, "forgot-password", 3, 300);
    if (!allowed) {
        return {
            success: false,
            message: "Too many requests. Please wait 5 minutes."
        };
    }

    const otp = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Invalida OTPs anteriores
    await supabase
        .from("password_reset_otps")
        .update({ used: true })
        .eq("email", email)
        .eq("used", false);

    // Insere OTP com fallback para colunas que podem não existir
    try {
        // Tenta inserir com todas as colunas
        const { error: storeError } = await supabase
            .from("password_reset_otps")
            .insert({
                email,
                otp_code: otp,
                expires_at: expiresAt.toISOString(),
                used: false,
                attempts: 0,
            });

        if (storeError && storeError.code === "PGRST204") {
            // Se a coluna não existe, insere sem ela
            console.warn("⚠️ Coluna 'attempts' não existe, inserindo sem ela");
            const { error: retryError } = await supabase
                .from("password_reset_otps")
                .insert({
                    email,
                    otp_code: otp,
                    expires_at: expiresAt.toISOString(),
                    used: false,
                });

            if (retryError) {
                console.error("❌ Erro ao armazenar OTP:", retryError);
                return { success: false, message: "Failed to generate reset code" };
            }
        } else if (storeError) {
            console.error("❌ Erro ao armazenar OTP:", storeError);
            return { success: false, message: "Failed to generate reset code" };
        }
    } catch (error) {
        console.error("❌ Erro ao armazenar OTP:", error);
        return { success: false, message: "Failed to generate reset code" };
    }

    const emailSent = await sendOTPEmail(email, otp, 'password_reset');

    console.log(`📧 OTP de reset enviado para ${email}: ${otp}`);

    return {
        success: true,
        message: emailSent
            ? "Reset code sent to your email"
            : "Code generated but email failed. Please try again.",
        ...(Deno.env.get("ENV") === "development" ? { debug_otp: otp } : {}),
    };
}
/**
 * Verifica o OTP para reset de senha
 */
async function verifyResetOTP(
    supabase: any,
    email: string,
    otpCode: string
): Promise<{ valid: boolean; message: string }> {
    if (!email || !otpCode) {
        return { valid: false, message: "Email and OTP code are required" };
    }

    const { data: otpRecord, error } = await supabase
        .from("password_reset_otps")
        .select("*")
        .eq("email", email)
        .eq("otp_code", otpCode)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (error || !otpRecord) {
        return { valid: false, message: "Invalid or expired reset code" };
    }

    if (otpRecord.attempts >= 5) {
        await supabase
            .from("password_reset_otps")
            .update({ used: true })
            .eq("id", otpRecord.id);
        return { valid: false, message: "Too many attempts. Request a new code." };
    }

    // Atualiza tentativas
    await supabase
        .from("password_reset_otps")
        .update({ attempts: otpRecord.attempts + 1 })
        .eq("id", otpRecord.id);

    // Marca como usado (será usado apenas uma vez)
    await supabase
        .from("password_reset_otps")
        .update({ used: true })
        .eq("id", otpRecord.id);

    return { valid: true, message: "Reset code verified successfully" };
}

/**
 * Reseta a senha do usuário
 */
async function resetPassword(
    supabase: any,
    email: string,
    otpCode: string,
    newPassword: string
): Promise<{ success: boolean; message: string }> {
    if (!email || !otpCode || !newPassword) {
        return { success: false, message: "Email, OTP code and password are required" };
    }

    if (!isValidEmail(email)) {
        return { success: false, message: "Invalid email format" };
    }

    if (!isValidPassword(newPassword)) {
        return { success: false, message: "Password must be at least 6 characters" };
    }

    // Verifica o OTP
    const verification = await verifyResetOTP(supabase, email, otpCode);
    if (!verification.valid) {
        return { success: false, message: verification.message };
    }

    // Busca o usuário no Auth
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
        console.error("❌ Erro ao listar usuários:", listError);
        return { success: false, message: "User not found" };
    }

    const targetUser = users?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    if (!targetUser) {
        return { success: false, message: "User not found" };
    }

    // Atualiza a senha
    const { error: updateError } = await supabase.auth.admin.updateUserById(
        targetUser.id,
        { password: newPassword }
    );

    if (updateError) {
        console.error("❌ Erro ao atualizar senha:", updateError);
        return { success: false, message: "Failed to update password" };
    }

    return { success: true, message: "Password updated successfully" };
}

// ============================================
// FUNÇÕES 2FA - GET USER SETTINGS
// ============================================

async function get2FASettings(supabase: any, userId: string) {
    let { data: settings, error } = await supabase
        .from("user_2fa_settings")
        .select("*")
        .eq("user_id", userId)
        .single();

    if (error && error.code === "PGRST116") {
        const { data: newSettings } = await supabase
            .from("user_2fa_settings")
            .insert({
                user_id: userId,
                method: 'email',
                email_enabled: true,
                totp_enabled: false
            })
            .select()
            .single();
        settings = newSettings;
    }

    return settings;
}

async function getUser2FAMethods(supabase: any, userId: string) {
    const settings = await get2FASettings(supabase, userId);
    const totpActive = await isTOTPActive(supabase, userId);

    const methods: string[] = [];
    if (settings?.email_enabled) methods.push('email');
    if (totpActive) methods.push('totp');

    return {
        methods,
        has2FA: methods.length > 0,
        settings,
        totpActive
    };
}

// ============================================
// FUNÇÃO RATE LIMIT
// ============================================

async function checkRateLimit(
    supabase: any,
    identifier: string,
    endpoint: string,
    maxRequests: number = 5,
    windowSeconds: number = 300
): Promise<boolean> {
    const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

    const { data, error } = await supabase
        .from("rate_limits")
        .select("request_count")
        .eq("identifier", identifier)
        .eq("endpoint", endpoint)
        .gte("window_start", windowStart)
        .single();

    if (error && error.code !== "PGRST116") return true;

    if (data && data.request_count >= maxRequests) {
        return false;
    }

    if (data) {
        await supabase
            .from("rate_limits")
            .update({ request_count: data.request_count + 1 })
            .eq("identifier", identifier)
            .eq("endpoint", endpoint)
            .gte("window_start", windowStart);
    } else {
        await supabase.from("rate_limits").insert({
            identifier,
            endpoint,
            request_count: 1,
            window_start: new Date().toISOString(),
        });
    }

    return true;
}

// ============================================
// FUNÇÃO CRIAR USUÁRIO DE TESTE
// ============================================

async function createTestUser() {
    const testEmail = "teste@exemplo.com";
    const testPassword = "senha123";

    const { data: existingUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", testEmail)
        .single();

    if (existingUser) {
        console.log(`✅ Usuário de teste já existe: ${testEmail}`);
        return;
    }

    const { data, error } = await supabase.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true,
        user_metadata: {
            full_name: "Usuário Teste",
        },
    });

    if (error) {
        console.error("❌ Erro ao criar usuário de teste:", error.message);
        return;
    }

    console.log(`✅ Usuário de teste criado:`);
    console.log(`   Email: ${testEmail}`);
    console.log(`   Senha: ${testPassword}`);
    console.log(`   ID: ${data.user.id}`);
}

// ============================================
// SERVIDOR PRINCIPAL
// ============================================

Deno.serve(async (req) => {
    const startTime = Date.now();

    if (req.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    try {
        // ============================================
        // ENDPOINT: GET /api/health
        // ============================================
        if (method === "GET" && path === "/api/health") {
            const response = json({
                status: "ok",
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                logs: requestLogs.slice(0, 10),
            });
            logRequest(method, path, 200, Date.now() - startTime);
            return response;
        }

        // ============================================
        // ENDPOINT: GET /api/logs
        // ============================================
        if (method === "GET" && path === "/api/logs") {
            const response = json({
                success: true,
                total: requestLogs.length,
                logs: requestLogs.slice(0, 100),
            });
            logRequest(method, path, 200, Date.now() - startTime);
            return response;
        }

        // ============================================
        // ENDPOINT: POST /api/forgot-password - SOLICITAR RESET DE SENHA
        // ============================================
        if (method === "POST" && path === "/api/forgot-password") {
            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const { email } = body;

            if (!email) {
                const error = "Email is required";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
            const result = await forgotPassword(supabase, email, clientIP);

            logRequest(method, path, result.success ? 200 : 400, Date.now() - startTime, { email });
            return json(result);
        }

        // ============================================
        // ENDPOINT: POST /api/verify-reset-otp - VERIFICAR OTP DE RESET
        // ============================================
        if (method === "POST" && path === "/api/verify-reset-otp") {
            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const { email, otp } = body;

            if (!email || !otp) {
                const error = "Email and OTP code are required";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const result = await verifyResetOTP(supabase, email, otp);

            logRequest(method, path, result.valid ? 200 : 401, Date.now() - startTime, { email });
            return json(result);
        }

        // ============================================
        // ENDPOINT: POST /api/reset-password - RESETAR SENHA
        // ============================================
        if (method === "POST" && path === "/api/reset-password") {
            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const { email, otp, new_password } = body;

            if (!email || !otp || !new_password) {
                const error = "Email, OTP code and password are required";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const result = await resetPassword(supabase, email, otp, new_password);

            logRequest(method, path, result.success ? 200 : 400, Date.now() - startTime, { email });
            return json(result);
        }

        // ============================================
        // ENDPOINT: POST /api/register/init - INICIAR REGISTRO COM OTP
        // ============================================
        if (method === "POST" && path === "/api/register/init") {
            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const { email, password, full_name, phone, company_name } = body;

            if (!email || !password) {
                const error = "Email and password are required";
                logRequest(method, path, 400, Date.now() - startTime, { email }, error);
                return json({ error }, 400);
            }

            if (!isValidEmail(email)) {
                const error = "Invalid email format";
                logRequest(method, path, 400, Date.now() - startTime, { email }, error);
                return json({ error }, 400);
            }

            if (!isValidPassword(password)) {
                const error = "Password must be at least 6 characters";
                logRequest(method, path, 400, Date.now() - startTime, { email }, error);
                return json({ error }, 400);
            }

            // Verifica se o email já está registrado
            const { data: existingUser } = await supabase
                .from("profiles")
                .select("id")
                .eq("email", email)
                .single();

            if (existingUser) {
                const error = "Email already registered. Please login.";
                logRequest(method, path, 400, Date.now() - startTime, { email }, error);
                return json({ error }, 400);
            }

            // Rate limit
            const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
            const allowed = await checkRateLimit(supabase, `${clientIP}:${email}`, "register-init", 3, 300);
            if (!allowed) {
                const error = "Too many registration attempts. Please wait 5 minutes.";
                logRequest(method, path, 429, Date.now() - startTime, { email }, error);
                return json({ error }, 429);
            }

            // Gera e armazena OTP
            const otp = generateOTP();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

            // Limpa OTPs anteriores
            await supabase
                .from("registration_otps")
                .update({ used: true })
                .eq("email", email);

            // Armazena dados temporários do registro
            const { error: storeError } = await supabase
                .from("registration_otps")
                .insert({
                    email: email,
                    otp_code: otp,
                    full_name: sanitizeInput(full_name) || email.split("@")[0],
                    password: password,
                    phone: sanitizeInput(phone) || null,
                    company_name: sanitizeInput(company_name) || null,
                    expires_at: expiresAt.toISOString(),
                    used: false,
                    attempts: 0,
                });

            if (storeError) {
                console.error("❌ Erro ao armazenar OTP de registro:", storeError);
                const error = "Failed to initiate registration";
                logRequest(method, path, 500, Date.now() - startTime, { email }, error);
                return json({ error }, 500);
            }

            // Envia email com OTP
            const emailSent = await sendOTPEmail(email, otp, 'registration');

            console.log(`📧 OTP de registro enviado para ${email}: ${otp}`);

            const response = json({
                success: true,
                message: emailSent
                    ? "Verification code sent to your email"
                    : "Code generated but email failed. Please try again.",
                email: email,
                expires_in: "10 minutes",
                ...(Deno.env.get("ENV") === "development" ? { debug_otp: otp } : {}),
            });
            logRequest(method, path, 200, Date.now() - startTime, { email });
            return response;
        }

        // ============================================
        // ENDPOINT: POST /api/register/verify-otp - VERIFICAR OTP E COMPLETAR REGISTRO
        // ============================================
        if (method === "POST" && path === "/api/register/verify-otp") {
            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const { email, otp_code } = body;

            if (!email || !otp_code) {
                const error = "Email and OTP code are required";
                logRequest(method, path, 400, Date.now() - startTime, { email }, error);
                return json({ error }, 400);
            }

            // Busca o OTP de registro
            const { data: otpData, error: otpError } = await supabase
                .from("registration_otps")
                .select("*")
                .eq("email", email)
                .eq("otp_code", otp_code)
                .eq("used", false)
                .gte("expires_at", new Date().toISOString())
                .single();

            if (otpError || !otpData) {
                const error = "Invalid or expired verification code";
                logRequest(method, path, 401, Date.now() - startTime, { email }, error);
                return json({ error }, 401);
            }

            // Verifica tentativas
            if (otpData.attempts >= 5) {
                await supabase
                    .from("registration_otps")
                    .update({ used: true })
                    .eq("email", email);

                const error = "Too many attempts. Please request a new code.";
                logRequest(method, path, 429, Date.now() - startTime, { email }, error);
                return json({ error }, 429);
            }

            // Atualiza tentativas
            await supabase
                .from("registration_otps")
                .update({ attempts: otpData.attempts + 1 })
                .eq("email", email);

            // Cria o usuário
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email: email,
                password: otpData.password,
                email_confirm: true,
                user_metadata: {
                    full_name: otpData.full_name || email.split("@")[0],
                    phone: otpData.phone || null,
                    company_name: otpData.company_name || null,
                },
            });

            if (createError) {
                console.error("❌ Erro ao criar usuário:", createError);
                const error = "Failed to create account. Please try again.";
                logRequest(method, path, 500, Date.now() - startTime, { email }, error);
                return json({ error }, 500);
            }

            // Marca OTP como usado
            await supabase
                .from("registration_otps")
                .update({ used: true })
                .eq("email", email);

            // Cria perfil
            const { error: profileError } = await supabase
                .from("profiles")
                .insert({
                    user_id: newUser.user.id,
                    email: email,
                    full_name: otpData.full_name || email.split("@")[0],
                    phone: otpData.phone || null,
                    company_name: otpData.company_name || null,
                    created_at: new Date().toISOString(),
                });

            if (profileError) {
                console.error("❌ Erro ao criar perfil:", profileError);
            }

            // Cria configurações 2FA padrão
            await supabase
                .from("user_2fa_settings")
                .upsert({
                    user_id: newUser.user.id,
                    method: 'email',
                    email_enabled: true,
                    totp_enabled: false,
                }, { onConflict: 'user_id' });

            // Cria wallet inicial
            const { error: walletError } = await supabase
                .from("user_credit_wallets")
                .insert({
                    user_id: newUser.user.id,
                    invoice_remaining: 0,
                    estimate_remaining: 0,
                    ai_estimate_remaining: 0,
                    invoice_unlimited: false,
                    estimate_unlimited: false,
                    ai_estimate_unlimited: false,
                });

            if (walletError) {
                console.error("❌ Erro ao criar wallet:", walletError);
            }

            // Cria créditos iniciais
            const { error: creditsError } = await supabase
                .from("user_credits")
                .insert({
                    user_id: newUser.user.id,
                    balance: 0,
                });

            if (creditsError) {
                console.error("❌ Erro ao criar créditos:", creditsError);
            }

            // Faz login automático
            const { data: session, error: sessionError } = await supabase.auth.signInWithPassword({
                email: email,
                password: otpData.password,
            });

            const response = json({
                success: true,
                message: "Account created successfully!",
                user: {
                    id: newUser.user.id,
                    email: newUser.user.email,
                    full_name: newUser.user.user_metadata?.full_name || email.split("@")[0],
                },
                ...(session && !sessionError ? {
                    access_token: session.session?.access_token,
                    refresh_token: session.session?.refresh_token,
                } : {}),
            });
            logRequest(method, path, 200, Date.now() - startTime, { email });
            return response;
        }

        // ============================================
        // ENDPOINT: POST /api/register/resend-otp - REENVIAR OTP
        // ============================================
        if (method === "POST" && path === "/api/register/resend-otp") {
            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const { email } = body;

            if (!email) {
                const error = "Email is required";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            // Rate limit
            const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
            const allowed = await checkRateLimit(supabase, `${clientIP}:${email}`, "register-resend", 2, 300);
            if (!allowed) {
                const error = "Too many requests. Please wait 5 minutes.";
                logRequest(method, path, 429, Date.now() - startTime, { email }, error);
                return json({ error }, 429);
            }

            // Busca registro pendente
            const { data: otpData, error: otpError } = await supabase
                .from("registration_otps")
                .select("*")
                .eq("email", email)
                .eq("used", false)
                .single();

            if (otpError || !otpData) {
                const error = "No pending registration found. Please start over.";
                logRequest(method, path, 404, Date.now() - startTime, { email }, error);
                return json({ error }, 404);
            }

            // Gera novo OTP
            const newOtp = generateOTP();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

            await supabase
                .from("registration_otps")
                .update({
                    otp_code: newOtp,
                    expires_at: expiresAt.toISOString(),
                    attempts: 0,
                })
                .eq("email", email);

            // Envia email
            const emailSent = await sendOTPEmail(email, newOtp, 'registration');

            console.log(`📧 Novo OTP de registro enviado para ${email}: ${newOtp}`);

            const response = json({
                success: true,
                message: emailSent
                    ? "New verification code sent to your email"
                    : "Code generated but email failed. Please try again.",
                ...(Deno.env.get("ENV") === "development" ? { debug_otp: newOtp } : {}),
            });
            logRequest(method, path, 200, Date.now() - startTime, { email });
            return response;
        }

        // ============================================
        // ENDPOINT: POST /api/register (LEGACY - Manter para compatibilidade)
        // ============================================
        if (method === "POST" && path === "/api/register") {
            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const { email, password, full_name, phone, company_name } = body;

            if (!email || !password) {
                const error = "Email and password required";
                logRequest(method, path, 400, Date.now() - startTime, body, error);
                return json({ error }, 400);
            }

            if (password.length < 6) {
                const error = "Password must be at least 6 characters";
                logRequest(method, path, 400, Date.now() - startTime, { email }, error);
                return json({ error }, 400);
            }

            const { data, error } = await supabase.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: {
                    full_name: full_name || email.split("@")[0],
                    phone: phone || null,
                    company_name: company_name || null,
                },
            });

            if (error) {
                logRequest(method, path, 400, Date.now() - startTime, { email }, error);
                return json({ error: error.message }, 400);
            }

            const response = json({
                success: true,
                user: {
                    id: data.user.id,
                    email: data.user.email,
                },
                message: "User created successfully",
            });
            logRequest(method, path, 200, Date.now() - startTime, { email });
            return response;
        }

        // ============================================
        // ENDPOINT: POST /api/login
        // ============================================
        if (method === "POST" && path === "/api/login") {
            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const { email, password, otp_code, totp_code } = body;

            if (!email || !password) {
                const error = "Email and password required";
                logRequest(method, path, 400, Date.now() - startTime, body, error);
                return json({ error }, 400);
            }

            const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
            const allowed = await checkRateLimit(supabase, `${clientIP}:${email}`, "login", 10, 300);
            if (!allowed) {
                const error = "Too many login attempts. Please try again later.";
                logRequest(method, path, 429, Date.now() - startTime, { email }, error);
                return json({ error }, 429);
            }

            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                logRequest(method, path, 401, Date.now() - startTime, { email }, error);
                return json({ error: "Invalid credentials" }, 401);
            }

            const user2FA = await getUser2FAMethods(supabase, data.user.id);

            if (user2FA.has2FA) {
                let verified = false;

                if (user2FA.methods.includes('email') && otp_code) {
                    const otpResult = await verifyOTP(supabase, data.user.id, otp_code, 'login');
                    if (otpResult.valid) verified = true;
                }

                if (user2FA.methods.includes('totp') && totp_code) {
                    const totpResult = await verifyTOTP(supabase, data.user.id, totp_code);
                    if (totpResult.valid) verified = true;
                }

                if (!verified) {
                    return json({
                        error: "2FA required",
                        requires2FA: true,
                        methods: user2FA.methods,
                        message: "Please provide your 2FA code"
                    }, 401);
                }
            }

            const has2FA = user2FA.has2FA;

            await supabase.from("sessions").insert({
                user_id: data.user.id,
                is_active: true,
                ip_address: clientIP.substring(0, 45),
                user_agent: (req.headers.get("user-agent") || "").substring(0, 255),
            });

            const response = json({
                success: true,
                access_token: data.session.access_token,
                refresh_token: data.session.refresh_token,
                user: {
                    id: data.user.id,
                    email: data.user.email,
                    has2FA,
                    methods: user2FA.methods,
                },
            });
            logRequest(method, path, 200, Date.now() - startTime, { email });
            return response;
        }

        // ============================================
        // ENDPOINT: POST /api/logout
        // ============================================
        if (method === "POST" && path === "/api/logout") {
            const authHeader = req.headers.get("Authorization");
            if (!authHeader?.startsWith("Bearer ")) {
                const error = "Unauthorized";
                logRequest(method, path, 401, Date.now() - startTime, null, error);
                return json({ error }, 401);
            }

            const token = authHeader.replace("Bearer ", "");
            const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const { error } = await anonClient.auth.signOut();

            if (error) {
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error: error.message }, 400);
            }

            const response = json({
                success: true,
                message: "Logged out successfully",
            });
            logRequest(method, path, 200, Date.now() - startTime);
            return response;
        }

        // ============================================
        // ENDPOINT: POST /api/otp/send
        // ============================================
        if (method === "POST" && path === "/api/otp/send") {
            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const { email, purpose = "login" } = body;

            if (!email) {
                const error = "Email is required";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const { data: user, error: userError } = await supabase
                .from("profiles")
                .select("user_id")
                .eq("email", email)
                .single();

            if (userError || !user) {
                const response = json({
                    success: true,
                    message: "If the email exists, a code will be sent",
                });
                logRequest(method, path, 200, Date.now() - startTime, { email });
                return response;
            }

            const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
            const allowed = await checkRateLimit(supabase, `${clientIP}:${email}`, "otp-send", 3, 300);
            if (!allowed) {
                const error = "Too many requests. Please wait 5 minutes.";
                logRequest(method, path, 429, Date.now() - startTime, { email }, error);
                return json({ error }, 429);
            }

            const result = await storeOTP(supabase, user.user_id, email, purpose);
            if (!result.success) {
                const error = "Failed to generate OTP";
                logRequest(method, path, 500, Date.now() - startTime, { email }, error);
                return json({ error }, 500);
            }

            const emailSent = await sendOTPEmail(email, result.otp, purpose);

            console.log(`📧 OTP enviado para ${email}: ${result.otp}`);

            const response = json({
                success: true,
                message: emailSent
                    ? "Code sent to your email"
                    : "Code generated but email failed. Check your email.",
                email: email,
                ...(Deno.env.get("ENV") === "development" ? { debug_otp: result.otp } : {}),
            });
            logRequest(method, path, 200, Date.now() - startTime, { email });
            return response;
        }

        // ============================================
        // ENDPOINT: POST /api/otp/verify
        // ============================================
        if (method === "POST" && path === "/api/otp/verify") {
            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const { email, otp, purpose = "login" } = body;

            if (!email || !otp) {
                const error = "Email and OTP code are required";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const { data: user, error: userError } = await supabase
                .from("profiles")
                .select("user_id")
                .eq("email", email)
                .single();

            if (userError || !user) {
                const error = "User not found";
                logRequest(method, path, 404, Date.now() - startTime, { email }, error);
                return json({ error }, 404);
            }

            const result = await verifyOTP(supabase, user.user_id, otp, purpose);

            if (!result.valid) {
                logRequest(method, path, 401, Date.now() - startTime, { email }, result.message);
                return json({ error: result.message }, 401);
            }

            const response = json({
                success: true,
                message: result.message,
            });
            logRequest(method, path, 200, Date.now() - startTime, { email });
            return response;
        }

        // ============================================
        // ENDPOINT: POST /api/totp/setup
        // ============================================
        if (method === "POST" && path === "/api/totp/setup") {
            const authHeader = req.headers.get("Authorization");
            if (!authHeader?.startsWith("Bearer ")) {
                const error = "Unauthorized";
                logRequest(method, path, 401, Date.now() - startTime, null, error);
                return json({ error }, 401);
            }

            const token = authHeader.replace("Bearer ", "");
            const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

            if (authError || !user) {
                logRequest(method, path, 401, Date.now() - startTime, null, authError);
                return json({ error: "Invalid token" }, 401);
            }

            try {
                const result = await setupTOTP(supabase, user.id, user.email!);

                await supabase
                    .from("user_2fa_settings")
                    .upsert({
                        user_id: user.id,
                        totp_enabled: false,
                        method: 'both'
                    }, { onConflict: 'user_id' });

                const response = json({
                    success: true,
                    secret: result.secret,
                    qrCodeURL: result.qrCodeURL,
                    backupCodes: result.backupCodes,
                    message: "Scan QR code with Google Authenticator",
                });
                logRequest(method, path, 200, Date.now() - startTime, { userId: user.id });
                return response;
            } catch (error) {
                logRequest(method, path, 500, Date.now() - startTime, { userId: user.id }, error);
                return json({ error: error.message }, 500);
            }
        }

        // ============================================
        // ENDPOINT: POST /api/totp/verify
        // ============================================
        if (method === "POST" && path === "/api/totp/verify") {
            const authHeader = req.headers.get("Authorization");
            if (!authHeader?.startsWith("Bearer ")) {
                const error = "Unauthorized";
                logRequest(method, path, 401, Date.now() - startTime, null, error);
                return json({ error }, 401);
            }

            const token = authHeader.replace("Bearer ", "");
            const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

            if (authError || !user) {
                logRequest(method, path, 401, Date.now() - startTime, null, authError);
                return json({ error: "Invalid token" }, 401);
            }

            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const { code } = body;
            if (!code || typeof code !== "string" || code.length !== 6) {
                const error = "Valid 6-digit code required";
                logRequest(method, path, 400, Date.now() - startTime, { userId: user.id }, error);
                return json({ error }, 400);
            }

            const result = await verifyTOTP(supabase, user.id, code);

            if (!result.valid) {
                logRequest(method, path, 401, Date.now() - startTime, { userId: user.id }, result.message);
                return json({ error: result.message }, 401);
            }

            if (result.valid && !result.isBackupCode) {
                await supabase
                    .from("user_2fa_settings")
                    .upsert({
                        user_id: user.id,
                        totp_enabled: true,
                        method: 'both'
                    }, { onConflict: 'user_id' });
            }

            const response = json({
                success: true,
                message: result.message,
                isBackupCode: result.isBackupCode,
            });
            logRequest(method, path, 200, Date.now() - startTime, { userId: user.id });
            return response;
        }

        // ============================================
        // ENDPOINT: GET /api/totp/status
        // ============================================
        if (method === "GET" && path === "/api/totp/status") {
            const authHeader = req.headers.get("Authorization");
            if (!authHeader?.startsWith("Bearer ")) {
                const error = "Unauthorized";
                logRequest(method, path, 401, Date.now() - startTime, null, error);
                return json({ error }, 401);
            }

            const token = authHeader.replace("Bearer ", "");
            const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

            if (authError || !user) {
                logRequest(method, path, 401, Date.now() - startTime, null, authError);
                return json({ error: "Invalid token" }, 401);
            }

            const isActive = await isTOTPActive(supabase, user.id);

            let backupCodesLeft = 0;
            let totpData = null;
            if (isActive) {
                totpData = await getTOTPData(supabase, user.id);
                backupCodesLeft = totpData?.backup_codes?.length || 0;
            }

            const response = json({
                isActive,
                backupCodesLeft,
                isVerified: isActive,
                message: isActive ? "TOTP is active" : "TOTP is not configured",
                data: totpData ? {
                    createdAt: totpData.created_at,
                    verifiedAt: totpData.verified_at,
                    updatedAt: totpData.updated_at,
                } : null,
            });
            logRequest(method, path, 200, Date.now() - startTime, { userId: user.id });
            return response;
        }

        // ============================================
        // ENDPOINT: POST /api/totp/regenerate
        // ============================================
        if (method === "POST" && path === "/api/totp/regenerate") {
            const authHeader = req.headers.get("Authorization");
            if (!authHeader?.startsWith("Bearer ")) {
                const error = "Unauthorized";
                logRequest(method, path, 401, Date.now() - startTime, null, error);
                return json({ error }, 401);
            }

            const token = authHeader.replace("Bearer ", "");
            const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

            if (authError || !user) {
                logRequest(method, path, 401, Date.now() - startTime, null, authError);
                return json({ error: "Invalid token" }, 401);
            }

            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const { code } = body;
            if (!code) {
                const error = "TOTP code required to regenerate backup codes";
                logRequest(method, path, 400, Date.now() - startTime, { userId: user.id }, error);
                return json({ error }, 400);
            }

            const result = await verifyTOTP(supabase, user.id, code);
            if (!result.valid) {
                logRequest(method, path, 401, Date.now() - startTime, { userId: user.id }, result.message);
                return json({ error: result.message }, 401);
            }

            try {
                const backupCodes = await regenerateBackupCodes(supabase, user.id);
                const response = json({
                    success: true,
                    backupCodes,
                    message: "New backup codes generated successfully",
                });
                logRequest(method, path, 200, Date.now() - startTime, { userId: user.id });
                return response;
            } catch (error) {
                logRequest(method, path, 500, Date.now() - startTime, { userId: user.id }, error);
                return json({ error: error.message }, 500);
            }
        }

        // ============================================
        // ENDPOINT: GET /api/totp/backup-codes
        // ============================================
        if (method === "GET" && path === "/api/totp/backup-codes") {
            const authHeader = req.headers.get("Authorization");
            if (!authHeader?.startsWith("Bearer ")) {
                const error = "Unauthorized";
                logRequest(method, path, 401, Date.now() - startTime, null, error);
                return json({ error }, 401);
            }

            const token = authHeader.replace("Bearer ", "");
            const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

            if (authError || !user) {
                logRequest(method, path, 401, Date.now() - startTime, null, authError);
                return json({ error: "Invalid token" }, 401);
            }

            const totpData = await getTOTPData(supabase, user.id);
            if (!totpData) {
                const error = "TOTP not configured";
                logRequest(method, path, 404, Date.now() - startTime, { userId: user.id }, error);
                return json({ error }, 404);
            }

            const response = json({
                success: true,
                backupCodes: totpData.backup_codes || [],
                count: totpData.backup_codes?.length || 0,
            });
            logRequest(method, path, 200, Date.now() - startTime, { userId: user.id });
            return response;
        }

        // ============================================
        // ENDPOINT: GET /api/2fa/status
        // ============================================
        if (method === "GET" && path === "/api/2fa/status") {
            const authHeader = req.headers.get("Authorization");
            if (!authHeader?.startsWith("Bearer ")) {
                const error = "Unauthorized";
                logRequest(method, path, 401, Date.now() - startTime, null, error);
                return json({ error }, 401);
            }

            const token = authHeader.replace("Bearer ", "");
            const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

            if (authError || !user) {
                logRequest(method, path, 401, Date.now() - startTime, null, authError);
                return json({ error: "Invalid token" }, 401);
            }

            try {
                const settings = await get2FASettings(supabase, user.id);
                const totpActive = await isTOTPActive(supabase, user.id);
                const emailEnabled = settings?.email_enabled || false;
                const method = settings?.method || (emailEnabled && totpActive ? 'both' : emailEnabled ? 'email' : totpActive ? 'totp' : 'none');

                const response = json({
                    success: true,
                    data: {
                        email_enabled: emailEnabled,
                        totp_enabled: totpActive,
                        method: method,
                        settings: settings || null
                    }
                });
                logRequest(method, path, 200, Date.now() - startTime, { userId: user.id });
                return response;
            } catch (error) {
                logRequest(method, path, 500, Date.now() - startTime, { userId: user.id }, error);
                return json({ error: error.message }, 500);
            }
        }

        // ============================================
        // ENDPOINT: GET /api/2fa/settings
        // ============================================
        if (method === "GET" && path === "/api/2fa/settings") {
            const authHeader = req.headers.get("Authorization");
            if (!authHeader?.startsWith("Bearer ")) {
                const error = "Unauthorized";
                logRequest(method, path, 401, Date.now() - startTime, null, error);
                return json({ error }, 401);
            }

            const token = authHeader.replace("Bearer ", "");
            const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

            if (authError || !user) {
                logRequest(method, path, 401, Date.now() - startTime, null, authError);
                return json({ error: "Invalid token" }, 401);
            }

            try {
                const settings = await get2FASettings(supabase, user.id);
                const response = json({
                    success: true,
                    data: settings
                });
                logRequest(method, path, 200, Date.now() - startTime, { userId: user.id });
                return response;
            } catch (error) {
                logRequest(method, path, 500, Date.now() - startTime, { userId: user.id }, error);
                return json({ error: error.message }, 500);
            }
        }

        // ============================================
        // ENDPOINT: POST /api/2fa/enable-email
        // ============================================
        if (method === "POST" && path === "/api/2fa/enable-email") {
            const authHeader = req.headers.get("Authorization");
            if (!authHeader?.startsWith("Bearer ")) {
                const error = "Unauthorized";
                logRequest(method, path, 401, Date.now() - startTime, null, error);
                return json({ error }, 401);
            }

            const token = authHeader.replace("Bearer ", "");
            const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

            if (authError || !user) {
                logRequest(method, path, 401, Date.now() - startTime, null, authError);
                return json({ error: "Invalid token" }, 401);
            }

            try {
                const { data: settings, error } = await supabase
                    .from("user_2fa_settings")
                    .upsert({
                        user_id: user.id,
                        email_enabled: true,
                        method: 'email'
                    }, { onConflict: 'user_id' })
                    .select()
                    .single();

                if (error) throw error;

                const response = json({
                    success: true,
                    message: "Email OTP enabled successfully",
                    data: settings
                });
                logRequest(method, path, 200, Date.now() - startTime, { userId: user.id });
                return response;
            } catch (error) {
                logRequest(method, path, 500, Date.now() - startTime, { userId: user.id }, error);
                return json({ error: error.message }, 500);
            }
        }

        // ============================================
        // ENDPOINT: POST /api/2fa/disable
        // ============================================
        if (method === "POST" && path === "/api/2fa/disable") {
            const authHeader = req.headers.get("Authorization");
            if (!authHeader?.startsWith("Bearer ")) {
                const error = "Unauthorized";
                logRequest(method, path, 401, Date.now() - startTime, null, error);
                return json({ error }, 401);
            }

            const token = authHeader.replace("Bearer ", "");
            const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

            if (authError || !user) {
                logRequest(method, path, 401, Date.now() - startTime, null, authError);
                return json({ error: "Invalid token" }, 401);
            }

            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const { code } = body;
            if (!code) {
                const error = "Verification code required";
                logRequest(method, path, 400, Date.now() - startTime, { userId: user.id }, error);
                return json({ error }, 400);
            }

            try {
                let verified = false;

                const totpResult = await verifyTOTP(supabase, user.id, code);
                if (totpResult.valid) {
                    verified = true;
                }

                if (!verified) {
                    const { data: otpData } = await supabase
                        .from("email_otps")
                        .select("*")
                        .eq("user_id", user.id)
                        .eq("otp_code", code)
                        .eq("used", false)
                        .gte("expires_at", new Date().toISOString())
                        .single();

                    if (otpData) {
                        await supabase
                            .from("email_otps")
                            .update({ used: true })
                            .eq("id", otpData.id);
                        verified = true;
                    }
                }

                if (!verified) {
                    const error = "Invalid verification code";
                    logRequest(method, path, 401, Date.now() - startTime, { userId: user.id }, error);
                    return json({ error }, 401);
                }

                await supabase
                    .from("user_2fa_settings")
                    .upsert({
                        user_id: user.id,
                        email_enabled: false,
                        totp_enabled: false,
                        method: 'none'
                    }, { onConflict: 'user_id' });

                await disableTOTP(supabase, user.id);

                const response = json({
                    success: true,
                    message: "2FA disabled successfully"
                });
                logRequest(method, path, 200, Date.now() - startTime, { userId: user.id });
                return response;
            } catch (error) {
                logRequest(method, path, 500, Date.now() - startTime, { userId: user.id }, error);
                return json({ error: error.message }, 500);
            }
        }

        // ============================================
        // ENDPOINT: POST /api/2fa/select-method
        // ============================================
        if (method === "POST" && path === "/api/2fa/select-method") {
            const authHeader = req.headers.get("Authorization");
            if (!authHeader?.startsWith("Bearer ")) {
                const error = "Unauthorized";
                logRequest(method, path, 401, Date.now() - startTime, null, error);
                return json({ error }, 401);
            }

            const token = authHeader.replace("Bearer ", "");
            const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

            if (authError || !user) {
                logRequest(method, path, 401, Date.now() - startTime, null, authError);
                return json({ error: "Invalid token" }, 401);
            }

            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const { method } = body;
            if (!method || !['email', 'totp', 'both'].includes(method)) {
                const error = "Invalid method. Use 'email', 'totp', or 'both'";
                logRequest(method, path, 400, Date.now() - startTime, { userId: user.id }, error);
                return json({ error }, 400);
            }

            try {
                const { data: settings, error } = await supabase
                    .from("user_2fa_settings")
                    .upsert({
                        user_id: user.id,
                        method: method
                    }, { onConflict: 'user_id' })
                    .select()
                    .single();

                if (error) throw error;

                const response = json({
                    success: true,
                    message: `2FA method set to ${method}`,
                    data: settings
                });
                logRequest(method, path, 200, Date.now() - startTime, { userId: user.id });
                return response;
            } catch (error) {
                logRequest(method, path, 500, Date.now() - startTime, { userId: user.id }, error);
                return json({ error: error.message }, 500);
            }
        }

        // ============================================
        // ENDPOINT: GET /api/user
        // ============================================
        if (method === "GET" && path === "/api/user") {
            const authHeader = req.headers.get("Authorization");
            if (!authHeader?.startsWith("Bearer ")) {
                const error = "Unauthorized";
                logRequest(method, path, 401, Date.now() - startTime, null, error);
                return json({ error }, 401);
            }

            const token = authHeader.replace("Bearer ", "");
            const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
            const { data: { user }, error: authError } = await anonClient.auth.getUser(token);

            if (authError || !user) {
                logRequest(method, path, 401, Date.now() - startTime, null, authError);
                return json({ error: "Invalid token" }, 401);
            }

            const user2FA = await getUser2FAMethods(supabase, user.id);

            const response = json({
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    has2FA: user2FA.has2FA,
                    methods: user2FA.methods,
                    created_at: user.created_at,
                    last_sign_in_at: user.last_sign_in_at,
                    metadata: user.user_metadata,
                },
            });
            logRequest(method, path, 200, Date.now() - startTime, { userId: user.id });
            return response;
        }

        // ============================================
        // ENDPOINT: GET /api/admin/users
        // ============================================
        if (method === "GET" && path === "/api/admin/users") {
            try {
                console.log("📋 Listando usuários...");

                const { data: profiles, error: profileError } = await supabase
                    .from("profiles")
                    .select("*");

                if (profileError) {
                    console.error("❌ Erro ao buscar profiles:", profileError);
                    logRequest(method, path, 500, Date.now() - startTime, null, profileError);
                    return json({
                        error: "Failed to fetch users",
                        details: profileError.message
                    }, 500);
                }

                console.log(`✅ Encontrados ${profiles?.length || 0} perfis`);

                const usersWithDetails = await Promise.all(
                    (profiles || []).map(async (profile: any) => {
                        try {
                            const [totpData, settings] = await Promise.all([
                                supabase.from("totp_secrets").select("is_verified").eq("user_id", profile.user_id).maybeSingle(),
                                supabase.from("user_2fa_settings").select("email_enabled").eq("user_id", profile.user_id).maybeSingle(),
                            ]);

                            return {
                                id: profile.user_id,
                                email: profile.email,
                                full_name: profile.full_name || profile.email,
                                created_at: profile.created_at || new Date().toISOString(),
                                hasTOTP: totpData.data?.is_verified || false,
                                hasEmailOTP: settings.data?.email_enabled || false,
                            };
                        } catch (err) {
                            return {
                                id: profile.user_id,
                                email: profile.email,
                                full_name: profile.full_name || profile.email,
                                created_at: profile.created_at || new Date().toISOString(),
                                hasTOTP: false,
                                hasEmailOTP: false,
                            };
                        }
                    })
                );

                const response = json({
                    success: true,
                    total: usersWithDetails.length,
                    users: usersWithDetails,
                });
                logRequest(method, path, 200, Date.now() - startTime);
                return response;

            } catch (error) {
                console.error("❌ Erro ao listar usuários:", error);
                logRequest(method, path, 500, Date.now() - startTime, null, error);
                return json({
                    error: "Internal server error",
                    details: error.message
                }, 500);
            }
        }

        // ============================================
        // ENDPOINT: GET /api/admin/users/:id
        // ============================================
        if (method === "GET" && path.startsWith("/api/admin/users/")) {
            const userId = path.replace("/api/admin/users/", "");

            try {
                const { data: profile, error: profileError } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("user_id", userId)
                    .single();

                if (profileError) {
                    logRequest(method, path, 404, Date.now() - startTime, null, profileError);
                    return json({ error: "User not found" }, 404);
                }

                const [totpData, settings] = await Promise.all([
                    supabase.from("totp_secrets").select("*").eq("user_id", userId).maybeSingle(),
                    supabase.from("user_2fa_settings").select("*").eq("user_id", userId).maybeSingle(),
                ]);

                const userDetails = {
                    ...profile,
                    totp: totpData.data || null,
                    settings: settings.data || null,
                    hasTOTP: totpData.data?.is_verified || false,
                    hasEmailOTP: settings.data?.email_enabled || false,
                };

                const response = json({
                    success: true,
                    user: userDetails,
                });
                logRequest(method, path, 200, Date.now() - startTime);
                return response;

            } catch (error) {
                logRequest(method, path, 500, Date.now() - startTime, null, error);
                return json({ error: "Internal server error", details: error.message }, 500);
            }
        }

        // ============================================
        // ENDPOINT: POST /api/admin/users/reset-password
        // ============================================
        if (method === "POST" && path === "/api/admin/users/reset-password") {
            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const { user_id, new_password } = body;

            if (!user_id || !new_password) {
                const error = "user_id and new_password required";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            if (new_password.length < 6) {
                const error = "Password must be at least 6 characters";
                logRequest(method, path, 400, Date.now() - startTime, { user_id }, error);
                return json({ error }, 400);
            }

            try {
                const { error } = await supabase.auth.admin.updateUserById(
                    user_id,
                    { password: new_password }
                );

                if (error) {
                    logRequest(method, path, 400, Date.now() - startTime, { user_id }, error);
                    return json({ error: error.message }, 400);
                }

                const response = json({
                    success: true,
                    message: "Password reset successfully",
                    user_id: user_id,
                });
                logRequest(method, path, 200, Date.now() - startTime, { user_id });
                return response;

            } catch (error) {
                logRequest(method, path, 500, Date.now() - startTime, { user_id }, error);
                return json({ error: "Internal server error", details: error.message }, 500);
            }
        }

        // ============================================
        // ENDPOINT: POST /api/admin/users/delete
        // ============================================
        if (method === "POST" && path === "/api/admin/users/delete") {
            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const { user_id } = body;

            if (!user_id) {
                const error = "user_id required";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            try {
                const { error } = await supabase.auth.admin.deleteUser(user_id);

                if (error) {
                    logRequest(method, path, 400, Date.now() - startTime, { user_id }, error);
                    return json({ error: error.message }, 400);
                }

                const response = json({
                    success: true,
                    message: "User deleted successfully",
                    user_id: user_id,
                });
                logRequest(method, path, 200, Date.now() - startTime, { user_id });
                return response;

            } catch (error) {
                logRequest(method, path, 500, Date.now() - startTime, { user_id }, error);
                return json({ error: "Internal server error", details: error.message }, 500);
            }
        }

        // ============================================
        // ENDPOINT: GET /api/test
        // ============================================
        if (method === "GET" && path === "/api/test") {
            const response = json({
                success: true,
                message: "API is working!",
                endpoints: [
                    "📊 Health & Logs:",
                    "GET  /api/health - Health check",
                    "GET  /api/logs - View logs",
                    "",
                    "🔐 Reset de Senha:",
                    "POST /api/forgot-password - Solicitar reset de senha",
                    "POST /api/verify-reset-otp - Verificar OTP de reset",
                    "POST /api/reset-password - Resetar senha",
                    "",
                    "🔐 Autenticação:",
                    "POST /api/register/init - Iniciar registro com OTP",
                    "POST /api/register/verify-otp - Verificar OTP e criar conta",
                    "POST /api/register/resend-otp - Reenviar OTP de registro",
                    "POST /api/register - Registrar (legacy)",
                    "POST /api/login - Login com 2FA",
                    "POST /api/logout - Logout",
                    "",
                    "📧 Email OTP:",
                    "POST /api/otp/send - Enviar OTP por email",
                    "POST /api/otp/verify - Verificar OTP por email",
                    "",
                    "📱 Google Authenticator:",
                    "POST /api/totp/setup - Setup TOTP",
                    "POST /api/totp/verify - Verificar TOTP",
                    "GET  /api/totp/status - Status TOTP",
                    "POST /api/totp/regenerate - Regenerar backup codes",
                    "GET  /api/totp/backup-codes - Ver backup codes",
                    "",
                    "⚙️  2FA Management:",
                    "GET  /api/2fa/status - Status 2FA",
                    "GET  /api/2fa/settings - Configurações 2FA",
                    "POST /api/2fa/enable-email - Ativar Email OTP",
                    "POST /api/2fa/disable - Desabilitar 2FA",
                    "POST /api/2fa/select-method - Selecionar método 2FA",
                    "",
                    "👤 User:",
                    "GET  /api/user - Informações do usuário",
                    "",
                    "👥 Admin:",
                    "GET  /api/admin/users - Listar todos os usuários",
                    "GET  /api/admin/users/:id - Detalhes do usuário",
                    "POST /api/admin/users/reset-password - Resetar senha",
                    "POST /api/admin/users/delete - Deletar usuário",
                ],
            });
            logRequest(method, path, 200, Date.now() - startTime);
            return response;
        }

        // ============================================
        // ROTA NÃO ENCONTRADA
        // ============================================
        const error = `Route not found: ${method} ${path}`;
        logRequest(method, path, 404, Date.now() - startTime, null, error);
        return json({ error: "Not found" }, 404);

    } catch (error) {
        console.error("❌ Error:", error);
        logRequest(method, path, 500, Date.now() - startTime, null, error);
        return json({
            error: "Internal server error",
            message: error.message
        }, 500);
    }
});

// ============================================
// CRIA USUÁRIO DE TESTE NA INICIALIZAÇÃO
// ============================================

await createTestUser();

console.log("\n🚀 Servidor pronto para uso!");
/*
console.log("📋 Endpoints disponíveis:");
console.log("   🔑 Reset de Senha:");
console.log("   POST /api/forgot-password - Solicitar reset de senha");
console.log("   POST /api/verify-reset-otp - Verificar OTP de reset");
console.log("   POST /api/reset-password - Resetar senha");
console.log("   📧 Registro com OTP:");
console.log("   POST /api/register/init - Iniciar registro com OTP");
console.log("   POST /api/register/verify-otp - Verificar OTP e criar conta");
console.log("   POST /api/register/resend-otp - Reenviar OTP de registro");
console.log("   🔐 Autenticação:");
console.log("   POST /api/login - Login with 2FA");
console.log("   POST /api/logout - Logout");
console.log("   📧 Email OTP:");
console.log("   POST /api/otp/send - Send email OTP");
console.log("   POST /api/otp/verify - Verify email OTP");
console.log("   📱 Google Authenticator:");
console.log("   POST /api/totp/setup - Setup TOTP");
console.log("   POST /api/totp/verify - Verify TOTP");
console.log("   GET  /api/totp/status - TOTP status");
console.log("   POST /api/totp/regenerate - Regenerate backup codes");
console.log("   GET  /api/totp/backup-codes - Get backup codes");
console.log("   ⚙️  2FA Management:");
console.log("   GET  /api/2fa/status - 2FA status");
console.log("   GET  /api/2fa/settings - 2FA settings");
console.log("   POST /api/2fa/enable-email - Enable email OTP");
console.log("   POST /api/2fa/disable - Disable 2FA");
console.log("   POST /api/2fa/select-method - Select 2FA method");
console.log("   👤 User:");
console.log("   GET  /api/user - User info");
console.log("   👥 Admin:");
console.log("   GET  /api/admin/users - List all users");
console.log("   GET  /api/admin/users/:id - Get user details");
console.log("   POST /api/admin/users/reset-password - Reset user password");
console.log("   POST /api/admin/users/delete - Delete user");
console.log("   📊 Utils:");
console.log("   GET  /api/health - Health check");
console.log("   GET  /api/logs - View logs");
console.log("   GET  /api/test - Test API\n");
*/