// main.ts
// ============================================
// IMPORTAÇÕES
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as OTPAuth from "https://esm.sh/otpauth@9.1.3";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";
import { sha256 } from "https://deno.land/std@0.224.0/crypto/sha256.ts";

// ============================================
// CARREGA O .env COM DOTENV
// ============================================

let env: Record<string, string> = {};
try {
    env = await load();
    console.log("✅ Dotenv carregado com sucesso");
} catch (error) {
    console.log("⚠️ Erro ao carregar dotenv:", error.message);
}

function getEnv(key: string): string | undefined {
    if (env[key]) return env[key];
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

const FROM_EMAIL = getEnv("FROM_EMAIL") || "na2841090@gmail.com";
const FROM_NAME = getEnv("FROM_NAME") || "Constil";

// Configurações de segurança
const SECURITY_CONFIG = {
    SESSION_TIMEOUT_DAYS: 7,
    MAX_LOGIN_ATTEMPTS: 10,
    MAX_REGISTER_ATTEMPTS: 3,
    MAX_RESEND_ATTEMPTS: 2,
    MAX_OTP_ATTEMPTS: 5,
    RATE_LIMIT_WINDOW: 300, // 5 minutos
    OTP_EXPIRY_MINUTES: 10,
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_MAX_LENGTH: 128,
    MAX_EMAIL_LENGTH: 255,
    MAX_NAME_LENGTH: 100,
};

console.log("\n🔍 VARIÁVEIS DE AMBIENTE:");
console.log("========================================");
console.log("SUPABASE_URL:", SUPABASE_URL ? "✅ CONFIGURADA" : "❌ NÃO ENCONTRADA");
console.log("SENDGRID_API_KEY:", SENDGRID_API_KEY ? "✅ CONFIGURADA" : "❌ NÃO CONFIGURADA");
console.log("FROM_EMAIL:", FROM_EMAIL ? "✅ " + FROM_EMAIL : "❌ NÃO CONFIGURADO");
console.log("========================================\n");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("❌ ERRO: Variáveis de ambiente não configuradas!");
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

// Restringe CORS em produção
const ALLOWED_ORIGINS = getEnv("ALLOWED_ORIGINS")?.split(",") || ["*"];
const isProduction = getEnv("ENV") === "production";

const corsHeaders = {
    "Access-Control-Allow-Origin": isProduction ? ALLOWED_ORIGINS[0] : "*",
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Max-Age": "86400",
};

const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
        status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

// ============================================
// SISTEMA DE LOGS (COM SANITIZAÇÃO)
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
        body: body ? sanitizeLogData(body) : null,
        error: error ? {
            message: sanitizeLogData(error.message || error),
            stack: error.stack ? sanitizeLogData(error.stack) : null,
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
        error ? `❌ ${sanitizeLogData(error.message || error)}` : ''
    );

    if (error && error.stack) {
        console.error('\x1b[31m', '  └─ Detalhes:', sanitizeLogData(error.stack), '\x1b[0m');
    }
}

function sanitizeLogData(data: any): any {
    if (typeof data === 'string') {
        // Remove dados sensíveis
        return data
            .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [REDACTED]')
            .replace(/["'](password|token|secret|key|code)["']\s*:\s*["'][^"']*["']/gi, '"$1":"[REDACTED]"')
            .substring(0, 1000);
    }
    if (typeof data === 'object' && data !== null) {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(data)) {
            if (['password', 'token', 'secret', 'key', 'code', 'otp', 'otp_code'].includes(key.toLowerCase())) {
                sanitized[key] = '[REDACTED]';
            } else {
                sanitized[key] = sanitizeLogData(value);
            }
        }
        return sanitized;
    }
    return data;
}

// ============================================
// FUNÇÕES DE VALIDAÇÃO E SANITIZAÇÃO MELHORADAS
// ============================================

function isValidEmail(email: string): boolean {
    if (!email || typeof email !== 'string') return false;
    if (email.length > SECURITY_CONFIG.MAX_EMAIL_LENGTH) return false;
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
}

function isValidPassword(password: string): boolean {
    if (!password || typeof password !== 'string') return false;
    const len = password.length;
    if (len < SECURITY_CONFIG.PASSWORD_MIN_LENGTH || len > SECURITY_CONFIG.PASSWORD_MAX_LENGTH) return false;
    
    // Força de senha
    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);
    
    // Pelo menos 3 das 4 categorias
    const strength = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;
    return strength >= 3;
}

function sanitizeString(input: any, maxLength: number = 500, allowSpecial: boolean = false): string {
    if (!input || typeof input !== 'string') return '';
    
    let sanitized = input.trim();
    
    // Remove HTML tags
    sanitized = sanitized.replace(/<[^>]*>/g, '');
    
    // Remove caracteres perigosos
    if (!allowSpecial) {
        sanitized = sanitized.replace(/[<>'"]/g, '');
    }
    
    // Remove caracteres de controle
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Limita tamanho
    if (sanitized.length > maxLength) {
        sanitized = sanitized.substring(0, maxLength);
    }
    
    return sanitized;
}

function sanitizeEmail(email: string): string {
    return sanitizeString(email, SECURITY_CONFIG.MAX_EMAIL_LENGTH).toLowerCase();
}

function isValidUUID(id: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '');
}

function isValidIdentifier(identifier: string): boolean {
    return /^[a-zA-Z0-9_:@.\-]+$/.test(identifier) && identifier.length <= 255;
}

function hashData(data: string): string {
    return new TextDecoder().decode(sha256(data));
}

function generateSecureOTP(): string {
    // Usa crypto.getRandomValues para maior segurança
    const array = new Uint8Array(6);
    crypto.getRandomValues(array);
    return String(Array.from(array, (byte) => byte % 10).join('')).padStart(6, '0');
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
            const array = new Uint8Array(4);
            crypto.getRandomValues(array);
            code = String(Array.from(array, (byte) => byte % 10).join('')).padStart(8, '0');
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
                    Este código é válido por <strong>${SECURITY_CONFIG.OTP_EXPIRY_MINUTES} minutos</strong>.
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

        console.log(`✅ OTP enviado para ${email} (${purpose})`);
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
    const otp = generateSecureOTP();
    const expiresAt = new Date(Date.now() + SECURITY_CONFIG.OTP_EXPIRY_MINUTES * 60 * 1000);

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

        if (otpRecord.attempts >= SECURITY_CONFIG.MAX_OTP_ATTEMPTS) {
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
// FUNÇÕES RESET DE SENHA COM OTP (MELHORADAS)
// ============================================

async function forgotPassword(
    supabase: any,
    email: string,
    clientIP?: string
): Promise<{ success: boolean; message: string; debug_otp?: string }> {
    const sanitizedEmail = sanitizeEmail(email);
    
    if (!sanitizedEmail || !isValidEmail(sanitizedEmail)) {
        return { success: false, message: "Invalid email format" };
    }

    // Verifica se o usuário existe (mas não revela)
    const { data: user, error } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("email", sanitizedEmail)
        .single();

    if (error || !user) {
        // Sempre retorna sucesso para não revelar existência
        return {
            success: true,
            message: "If the email exists, a reset code will be sent"
        };
    }

    // Rate limit por IP + email
    const ip = sanitizeString(clientIP || "unknown", 45);
    const rateKey = `${ip}:${sanitizedEmail}`;
    
    if (!isValidIdentifier(rateKey)) {
        return { success: false, message: "Invalid request" };
    }
    
    const allowed = await checkRateLimit(
        supabase, 
        rateKey, 
        "forgot-password", 
        3, 
        SECURITY_CONFIG.RATE_LIMIT_WINDOW
    );
    
    if (!allowed) {
        return {
            success: false,
            message: `Too many requests. Please wait ${SECURITY_CONFIG.RATE_LIMIT_WINDOW / 60} minutes.`
        };
    }

    const otp = generateSecureOTP();
    const expiresAt = new Date(Date.now() + SECURITY_CONFIG.OTP_EXPIRY_MINUTES * 60 * 1000);

    // Invalida OTPs anteriores
    await supabase
        .from("password_reset_otps")
        .update({ used: true })
        .eq("email", sanitizedEmail)
        .eq("used", false);

    // Insere OTP com hash (mais seguro)
    const otpHash = hashData(otp);
    const { error: storeError } = await supabase
        .from("password_reset_otps")
        .insert({
            email: sanitizedEmail,
            otp_hash: otpHash,
            expires_at: expiresAt.toISOString(),
            used: false,
            attempts: 0,
        });

    if (storeError) {
        console.error("❌ Erro ao armazenar OTP:", storeError);
        return { success: false, message: "Failed to generate reset code" };
    }

    const emailSent = await sendOTPEmail(sanitizedEmail, otp, 'password_reset');

    console.log(`📧 OTP de reset enviado para ${sanitizedEmail}`);

    return {
        success: true,
        message: emailSent
            ? "Reset code sent to your email"
            : "Code generated but email failed. Please try again.",
        ...(getEnv("ENV") === "development" ? { debug_otp: otp } : {}),
    };
}

async function verifyResetOTP(
    supabase: any,
    email: string,
    otpCode: string
): Promise<{ valid: boolean; message: string }> {
    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedOtp = sanitizeString(otpCode, 10);

    if (!sanitizedEmail || !sanitizedOtp) {
        return { valid: false, message: "Email and OTP code are required" };
    }

    const otpHash = hashData(sanitizedOtp);

    const { data: otpRecord, error } = await supabase
        .from("password_reset_otps")
        .select("*")
        .eq("email", sanitizedEmail)
        .eq("otp_hash", otpHash)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (error || !otpRecord) {
        return { valid: false, message: "Invalid or expired reset code" };
    }

    if (otpRecord.attempts >= SECURITY_CONFIG.MAX_OTP_ATTEMPTS) {
        await supabase
            .from("password_reset_otps")
            .update({ used: true })
            .eq("id", otpRecord.id);
        return { valid: false, message: "Too many attempts. Request a new code." };
    }

    await supabase
        .from("password_reset_otps")
        .update({ attempts: otpRecord.attempts + 1 })
        .eq("id", otpRecord.id);

    await supabase
        .from("password_reset_otps")
        .update({ used: true })
        .eq("id", otpRecord.id);

    return { valid: true, message: "Reset code verified successfully" };
}

async function resetPassword(
    supabase: any,
    email: string,
    otpCode: string,
    newPassword: string
): Promise<{ success: boolean; message: string }> {
    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedOtp = sanitizeString(otpCode, 10);

    if (!sanitizedEmail || !sanitizedOtp || !newPassword) {
        return { success: false, message: "Email, OTP code and password are required" };
    }

    if (!isValidEmail(sanitizedEmail)) {
        return { success: false, message: "Invalid email format" };
    }

    if (!isValidPassword(newPassword)) {
        return { 
            success: false, 
            message: `Password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, number and special character` 
        };
    }

    const verification = await verifyResetOTP(supabase, sanitizedEmail, sanitizedOtp);
    if (!verification.valid) {
        return { success: false, message: verification.message };
    }

    const { data: users, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
        console.error("❌ Erro ao listar usuários:", listError);
        return { success: false, message: "User not found" };
    }

    const targetUser = users?.users?.find((u: any) => u.email?.toLowerCase() === sanitizedEmail.toLowerCase());
    if (!targetUser) {
        return { success: false, message: "User not found" };
    }

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
// FUNÇÃO RATE LIMIT MELHORADA
// ============================================

async function checkRateLimit(
    supabase: any,
    identifier: string,
    endpoint: string,
    maxRequests: number = 5,
    windowSeconds: number = 300
): Promise<boolean> {
    // Valida o identificador
    if (!isValidIdentifier(identifier)) {
        console.warn("⚠️ Identificador inválido para rate limit:", identifier);
        return true; // Permite por segurança, mas registra
    }

    const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

    try {
        const { data, error } = await supabase
            .from("rate_limits")
            .select("request_count, id")
            .eq("identifier", identifier)
            .eq("endpoint", endpoint)
            .gte("window_start", windowStart)
            .order("window_start", { ascending: false })
            .limit(1)
            .single();

        if (error && error.code !== "PGRST116") {
            console.error("❌ Erro no rate limit:", error);
            return true; // Em caso de erro, permite por segurança
        }

        if (data && data.request_count >= maxRequests) {
            return false;
        }

        if (data) {
            await supabase
                .from("rate_limits")
                .update({ 
                    request_count: data.request_count + 1,
                    updated_at: new Date().toISOString()
                })
                .eq("id", data.id);
        } else {
            await supabase.from("rate_limits").insert({
                identifier,
                endpoint,
                request_count: 1,
                window_start: new Date().toISOString(),
            });
        }

        return true;
    } catch (error) {
        console.error("❌ Erro no rate limit:", error);
        return true; // Em caso de erro, permite por segurança
    }
}

// ============================================
// FUNÇÃO LIMPEZA DE RATE LIMITS
// ============================================

async function cleanupRateLimits(supabase: any) {
    try {
        const cutoff = new Date(Date.now() - 3600000).toISOString(); // 1 hora
        await supabase
            .from("rate_limits")
            .delete()
            .lt("window_start", cutoff);
    } catch (error) {
        console.error("❌ Erro na limpeza de rate limits:", error);
    }
}

// ============================================
// FUNÇÃO SESSÃO COM TIMEOUT
// ============================================

async function createSession(
    supabase: any,
    userId: string,
    clientIP: string,
    userAgent: string
): Promise<void> {
    const sanitizedIP = sanitizeString(clientIP, 45);
    const sanitizedUA = sanitizeString(userAgent, 255);
    
    // Desativa sessões antigas do mesmo usuário (opcional - single session)
    // await supabase
    //     .from("sessions")
    //     .update({ is_active: false })
    //     .eq("user_id", userId)
    //     .eq("is_active", true);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + SECURITY_CONFIG.SESSION_TIMEOUT_DAYS);

    await supabase.from("sessions").insert({
        user_id: userId,
        is_active: true,
        expires_at: expiresAt.toISOString(),
        ip_address: sanitizedIP,
        user_agent: sanitizedUA,
    });
}

// ============================================
// FUNÇÃO VERIFICAR SESSÃO
// ============================================

async function verifySession(
    supabase: any,
    userId: string
): Promise<boolean> {
    const { data, error } = await supabase
        .from("sessions")
        .select("id, expires_at, is_active")
        .eq("user_id", userId)
        .eq("is_active", true)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

    if (error || !data) return false;
    
    // Atualiza o timestamp da sessão (keep alive)
    await supabase
        .from("sessions")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", data.id);

    return true;
}

// ============================================
// FUNÇÃO CRIAR USUÁRIO DE TESTE
// ============================================

async function createTestUser() {
    const testEmail = "teste@exemplo.com";
    const testPassword = "Senha123!";

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

// Limpeza periódica de rate limits (a cada hora)
setInterval(() => {
    cleanupRateLimits(supabase).catch(() => {});
}, 3600000);

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
        // ENDPOINT: POST /api/forgot-password
        // ============================================
        if (method === "POST" && path === "/api/forgot-password") {
            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const email = sanitizeEmail(body.email);

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
        // ENDPOINT: POST /api/verify-reset-otp
        // ============================================
        if (method === "POST" && path === "/api/verify-reset-otp") {
            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const email = sanitizeEmail(body.email);
            const otp = sanitizeString(body.otp, 10);

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
        // ENDPOINT: POST /api/reset-password
        // ============================================
        if (method === "POST" && path === "/api/reset-password") {
            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const email = sanitizeEmail(body.email);
            const otp = sanitizeString(body.otp, 10);
            const newPassword = body.new_password;

            if (!email || !otp || !newPassword) {
                const error = "Email, OTP code and password are required";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const result = await resetPassword(supabase, email, otp, newPassword);

            logRequest(method, path, result.success ? 200 : 400, Date.now() - startTime, { email });
            return json(result);
        }

        // ============================================
        // ENDPOINT: POST /api/register/init
        // ============================================
        if (method === "POST" && path === "/api/register/init") {
            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const email = sanitizeEmail(body.email);
            const password = body.password;
            const full_name = sanitizeString(body.full_name, SECURITY_CONFIG.MAX_NAME_LENGTH);
            const phone = sanitizeString(body.phone, 20);
            const company_name = sanitizeString(body.company_name, SECURITY_CONFIG.MAX_NAME_LENGTH);

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
                const error = `Password must be at least ${SECURITY_CONFIG.PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, number and special character`;
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
            const allowed = await checkRateLimit(
                supabase, 
                `${clientIP}:${email}`, 
                "register-init", 
                SECURITY_CONFIG.MAX_REGISTER_ATTEMPTS, 
                SECURITY_CONFIG.RATE_LIMIT_WINDOW
            );
            
            if (!allowed) {
                const error = `Too many registration attempts. Please wait ${SECURITY_CONFIG.RATE_LIMIT_WINDOW / 60} minutes.`;
                logRequest(method, path, 429, Date.now() - startTime, { email }, error);
                return json({ error }, 429);
            }

            // Gera OTP (não armazena senha em texto puro)
            const otp = generateSecureOTP();
            const expiresAt = new Date(Date.now() + SECURITY_CONFIG.OTP_EXPIRY_MINUTES * 60 * 1000);

            // Limpa OTPs anteriores
            await supabase
                .from("registration_otps")
                .update({ used: true })
                .eq("email", email);

            // Armazena apenas hash da senha e dados temporários
            const passwordHash = hashData(password);
            
            const { error: storeError } = await supabase
                .from("registration_otps")
                .insert({
                    email: email,
                    otp_code: otp,
                    full_name: full_name || email.split("@")[0],
                    password_hash: passwordHash,
                    phone: phone || null,
                    company_name: company_name || null,
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

            console.log(`📧 OTP de registro enviado para ${email}`);

            const response = json({
                success: true,
                message: emailSent
                    ? "Verification code sent to your email"
                    : "Code generated but email failed. Please try again.",
                email: email,
                expires_in: `${SECURITY_CONFIG.OTP_EXPIRY_MINUTES} minutes`,
                ...(getEnv("ENV") === "development" ? { debug_otp: otp } : {}),
            });
            logRequest(method, path, 200, Date.now() - startTime, { email });
            return response;
        }

        // ============================================
        // ENDPOINT: POST /api/register/verify-otp
        // ============================================
        if (method === "POST" && path === "/api/register/verify-otp") {
            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const email = sanitizeEmail(body.email);
            const otp_code = sanitizeString(body.otp_code, 10);

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

            if (otpData.attempts >= SECURITY_CONFIG.MAX_OTP_ATTEMPTS) {
                await supabase
                    .from("registration_otps")
                    .update({ used: true })
                    .eq("email", email);

                const error = "Too many attempts. Please request a new code.";
                logRequest(method, path, 429, Date.now() - startTime, { email }, error);
                return json({ error }, 429);
            }

            await supabase
                .from("registration_otps")
                .update({ attempts: otpData.attempts + 1 })
                .eq("email", email);

            // A senha é recuperada do hash (não armazenamos em texto puro)
            // Nota: Isso requer que a senha seja armazenada na primeira etapa
            // Em produção, você deve solicitar a senha novamente ou usar um fluxo diferente
            
            // Cria o usuário
            const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
                email: email,
                password: "SenhaTemporaria123!", // Senha temporária
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

            // Faz login automático com a senha temporária
            const { data: session, error: sessionError } = await supabase.auth.signInWithPassword({
                email: email,
                password: "SenhaTemporaria123!",
            });

            // Cria sessão com timeout
            if (session && !sessionError) {
                const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
                const userAgent = req.headers.get("user-agent") || "unknown";
                await createSession(supabase, newUser.user.id, clientIP, userAgent);
            }

            const response = json({
                success: true,
                message: "Account created successfully! Please set your password after login.",
                user: {
                    id: newUser.user.id,
                    email: newUser.user.email,
                    full_name: newUser.user.user_metadata?.full_name || email.split("@")[0],
                },
                ...(session && !sessionError ? {
                    access_token: session.session?.access_token,
                    refresh_token: session.session?.refresh_token,
                } : {}),
                requires_password_change: true,
            });
            logRequest(method, path, 200, Date.now() - startTime, { email });
            return response;
        }

        // ============================================
        // ENDPOINT: POST /api/register/resend-otp
        // ============================================
        if (method === "POST" && path === "/api/register/resend-otp") {
            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const email = sanitizeEmail(body.email);

            if (!email) {
                const error = "Email is required";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
            const allowed = await checkRateLimit(
                supabase, 
                `${clientIP}:${email}`, 
                "register-resend", 
                SECURITY_CONFIG.MAX_RESEND_ATTEMPTS, 
                SECURITY_CONFIG.RATE_LIMIT_WINDOW
            );
            
            if (!allowed) {
                const error = `Too many requests. Please wait ${SECURITY_CONFIG.RATE_LIMIT_WINDOW / 60} minutes.`;
                logRequest(method, path, 429, Date.now() - startTime, { email }, error);
                return json({ error }, 429);
            }

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

            const newOtp = generateSecureOTP();
            const expiresAt = new Date(Date.now() + SECURITY_CONFIG.OTP_EXPIRY_MINUTES * 60 * 1000);

            await supabase
                .from("registration_otps")
                .update({
                    otp_code: newOtp,
                    expires_at: expiresAt.toISOString(),
                    attempts: 0,
                })
                .eq("email", email);

            const emailSent = await sendOTPEmail(email, newOtp, 'registration');

            console.log(`📧 Novo OTP de registro enviado para ${email}`);

            const response = json({
                success: true,
                message: emailSent
                    ? "New verification code sent to your email"
                    : "Code generated but email failed. Please try again.",
                ...(getEnv("ENV") === "development" ? { debug_otp: newOtp } : {}),
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

            const email = sanitizeEmail(body.email);
            const password = body.password;
            const otp_code = sanitizeString(body.otp_code, 10);
            const totp_code = sanitizeString(body.totp_code, 10);

            if (!email || !password) {
                const error = "Email and password required";
                logRequest(method, path, 400, Date.now() - startTime, body, error);
                return json({ error }, 400);
            }

            const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
            
            // Rate limit mais restrito para login
            const allowed = await checkRateLimit(
                supabase, 
                `${clientIP}:${email}`, 
                "login", 
                SECURITY_CONFIG.MAX_LOGIN_ATTEMPTS, 
                SECURITY_CONFIG.RATE_LIMIT_WINDOW
            );
            
            if (!allowed) {
                const error = `Too many login attempts. Please try again later.`;
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

            // Cria sessão com timeout
            const userAgent = req.headers.get("user-agent") || "unknown";
            await createSession(supabase, data.user.id, clientIP, userAgent);

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
                session_timeout_days: SECURITY_CONFIG.SESSION_TIMEOUT_DAYS,
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
            
            // Desativa a sessão
            try {
                const { data: { user } } = await anonClient.auth.getUser(token);
                if (user) {
                    await supabase
                        .from("sessions")
                        .update({ is_active: false })
                        .eq("user_id", user.id)
                        .eq("is_active", true);
                }
            } catch (e) {
                // Ignora erros de sessão
            }

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

            // Verifica sessão ativa
            const sessionValid = await verifySession(supabase, user.id);
            if (!sessionValid) {
                return json({ error: "Session expired. Please login again." }, 401);
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
        // ENDPOINT: POST /api/otp/send
        // ============================================
        if (method === "POST" && path === "/api/otp/send") {
            let body: any;
            try { body = await req.json(); } catch {
                const error = "Invalid request body";
                logRequest(method, path, 400, Date.now() - startTime, null, error);
                return json({ error }, 400);
            }

            const email = sanitizeEmail(body.email);
            const purpose = sanitizeString(body.purpose, 20) || "login";

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
            const allowed = await checkRateLimit(
                supabase, 
                `${clientIP}:${email}`, 
                "otp-send", 
                3, 
                SECURITY_CONFIG.RATE_LIMIT_WINDOW
            );
            
            if (!allowed) {
                const error = `Too many requests. Please wait ${SECURITY_CONFIG.RATE_LIMIT_WINDOW / 60} minutes.`;
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

            console.log(`📧 OTP enviado para ${email}`);

            const response = json({
                success: true,
                message: emailSent
                    ? "Code sent to your email"
                    : "Code generated but email failed. Check your email.",
                email: email,
                ...(getEnv("ENV") === "development" ? { debug_otp: result.otp } : {}),
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

            const email = sanitizeEmail(body.email);
            const otp = sanitizeString(body.otp, 10);
            const purpose = sanitizeString(body.purpose, 20) || "login";

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
            message: getEnv("ENV") === "development" ? error.message : undefined
        }, 500);
    }
});

// ============================================
// CRIA USUÁRIO DE TESTE NA INICIALIZAÇÃO
// ============================================

await createTestUser();

console.log("\n🚀 Servidor pronto para uso!");
console.log("📋 Endpoints principais:");
console.log("   🔐 Autenticação:");
console.log("   POST /api/register/init - Iniciar registro");
console.log("   POST /api/register/verify-otp - Verificar OTP");
console.log("   POST /api/login - Login");
console.log("   POST /api/logout - Logout");
console.log("   POST /api/forgot-password - Resetar senha");
console.log("   POST /api/otp/send - Enviar OTP");
console.log("   POST /api/otp/verify - Verificar OTP");
console.log("   👤 User:");
console.log("   GET /api/user - Informações do usuário");
console.log("   📊 Utils:");
console.log("   GET /api/health - Health check");
console.log("   GET /api/logs - View logs");
console.log("   GET /api/test - Test API\n");