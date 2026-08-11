// ============================================
// USER-AUTH - API DE AUTENTICAÇÃO PÚBLICA
// ============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

// ============================================
// HELPERS
// ============================================

function sanitize(input: unknown, maxLength = 500): string {
  if (!input || typeof input !== "string") return "";
  return input.replace(/<[^>]*>/g, "").replace(/[<>'"]/g, "").trim().substring(0, maxLength);
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "") && email.length <= 255;
}

function isValidPassword(password: string): boolean {
  return typeof password === "string" && password.length >= 8 && password.length <= 128;
}

// ============================================
// MAIN HANDLER
// ============================================

Deno.serve(async (req) => {
  // === CORS ===
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/user-auth\/?/, "");

  console.log("📥 [user-auth] Requisição:", req.method, path);

  // ============================================
  // CLIENTE SUPABASE
  // ============================================

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // ============================================
  // ENDPOINTS PÚBLICOS
  // ============================================

  // === GET / ===
  if (req.method === "GET" && path === "") {
    return json({
      name: "User Auth API",
      version: "1.0.0",
      description: "API de autenticação pública",
      endpoints: {
        "GET /": "Informações da API",
        "GET /health": "Status da API",
        "POST /login": "Autenticar usuário",
        "POST /register": "Registrar novo usuário",
        "POST /google": "Login com Google",
        "POST /send-otp": "Enviar código OTP",
        "POST /verify-otp": "Verificar código OTP",
        "POST /forgot-password": "Solicitar reset de senha",
        "POST /reset-password": "Resetar senha com OTP",
      },
      status: "online",
      timestamp: new Date().toISOString(),
    });
  }

  // === GET /health ===
  if (req.method === "GET" && path === "health") {
    return json({
      status: "healthy",
      service: "user-auth",
      timestamp: new Date().toISOString(),
    });
  }

  // === POST /register ===
  if (req.method === "POST" && path === "register") {
    try {
      const body = await req.json();
      
      const email = sanitize(body.email, 255).toLowerCase();
      const password = body.password;
      const full_name = sanitize(body.full_name, 100);
      const company_name = sanitize(body.company_name, 100);
      const coupon_code = sanitize(body.coupon_code, 50);

      // Validações
      if (!email || !password || !full_name) {
        return json({ error: "Email, password and full_name are required" }, 400);
      }
      if (!isValidEmail(email)) {
        return json({ error: "Invalid email format" }, 400);
      }
      if (!isValidPassword(password)) {
        return json({ error: "Password must be 8-128 characters" }, 400);
      }

      // Criar usuário
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name, company_name },
      });

      if (createErr) {
        if (createErr.message.includes("already registered")) {
          return json({ error: "Email already registered" }, 400);
        }
        return json({ error: "Registration failed: " + createErr.message }, 400);
      }

      const userId = newUser.user.id;

      // Criar perfil
      await supabase.from("profiles").insert({
        user_id: userId,
        email: email,
        full_name: full_name,
        company_name: company_name || null,
      });

      // Aplicar cupom se existir
      if (coupon_code) {
        const { data: coupon } = await supabase
          .from("coupons")
          .select("*")
          .eq("code", coupon_code.toUpperCase())
          .eq("is_active", true)
          .single();

        if (coupon) {
          const withinLimit = !coupon.usage_limit || coupon.usage_count < coupon.usage_limit;
          const notExpired = !coupon.expiry_date || new Date(coupon.expiry_date) > new Date();

          if (withinLimit && notExpired) {
            await supabase.from("user_attributions").insert({
              user_id: userId,
              influencer_id: coupon.influencer_id,
              coupon_id: coupon.id,
            });
            await supabase
              .from("coupons")
              .update({ usage_count: coupon.usage_count + 1 })
              .eq("id", coupon.id);
          }
        }
      }

      return json({
        success: true,
        message: "Account created successfully",
        user: {
          id: userId,
          email: email,
          full_name: full_name,
        },
      });
    } catch (error) {
      console.error("[REGISTER] Error:", error);
      return json({ error: "Registration failed" }, 500);
    }
  }

  // === POST /login ===
  if (req.method === "POST" && path === "login") {
    try {
      const body = await req.json();
      const email = sanitize(body.email, 255).toLowerCase();
      const password = body.password;

      if (!email || !password) {
        return json({ error: "Email and password are required" }, 400);
      }
      if (!isValidEmail(email)) {
        return json({ error: "Invalid email format" }, 400);
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return json({ error: "Invalid credentials" }, 401);
      }

      // Registrar sessão
      const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      await supabase.from("sessions").insert({
        user_id: data.user.id,
        is_active: true,
        ip_address: clientIP.substring(0, 45),
        user_agent: (req.headers.get("user-agent") || "").substring(0, 255),
      });

      return json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: {
          id: data.user.id,
          email: data.user.email,
        },
        expires_in: data.session.expires_in,
      });
    } catch (error) {
      console.error("[LOGIN] Error:", error);
      return json({ error: "Login failed" }, 500);
    }
  }

  // === POST /send-otp ===
  if (req.method === "POST" && path === "send-otp") {
    try {
      const body = await req.json();
      const email = sanitize(body.email, 255).toLowerCase();

      if (!email) {
        return json({ error: "Email is required" }, 400);
      }
      if (!isValidEmail(email)) {
        return json({ error: "Invalid email format" }, 400);
      }

      // Verificar se email existe
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", email)
        .single();

      if (existingUser) {
        return json({ error: "Email already registered. Please login instead." }, 400);
      }

      // Gerar OTP
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

      // Invalidar OTPs anteriores
      await supabase
        .from("password_reset_otps")
        .update({ used: true })
        .eq("email", email)
        .eq("used", false);

      // Salvar OTP
      await supabase.from("password_reset_otps").insert({
        email,
        otp_code: otp,
        expires_at: expiresAt.toISOString(),
      });

      // Enviar email (opcional - implementar SendGrid)
      console.log(`📧 OTP para ${email}: ${otp}`);

      return json({
        success: true,
        message: "OTP sent successfully",
        expires_in: 600, // 10 minutos em segundos
      });
    } catch (error) {
      console.error("[SEND-OTP] Error:", error);
      return json({ error: "Failed to send OTP" }, 500);
    }
  }

  // === POST /verify-otp ===
  if (req.method === "POST" && path === "verify-otp") {
    try {
      const body = await req.json();
      const email = sanitize(body.email, 255).toLowerCase();
      const otpCode = sanitize(body.otp, 10);

      if (!email || !otpCode) {
        return json({ error: "Email and OTP are required" }, 400);
      }

      const { data: otpRecord } = await supabase
        .from("password_reset_otps")
        .select("*")
        .eq("email", email)
        .eq("otp_code", otpCode)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!otpRecord) {
        return json({ error: "Invalid or expired OTP" }, 400);
      }

      // Marcar como usado
      await supabase
        .from("password_reset_otps")
        .update({ used: true })
        .eq("id", otpRecord.id);

      return json({
        success: true,
        message: "OTP verified successfully",
        email: email,
      });
    } catch (error) {
      console.error("[VERIFY-OTP] Error:", error);
      return json({ error: "Failed to verify OTP" }, 500);
    }
  }

  // === POST /forgot-password ===
  if (req.method === "POST" && path === "forgot-password") {
    try {
      const body = await req.json();
      const email = sanitize(body.email, 255).toLowerCase();

      if (!email) {
        return json({ error: "Email is required" }, 400);
      }
      if (!isValidEmail(email)) {
        return json({ error: "Invalid email format" }, 400);
      }

      // Verificar se usuário existe (mas não revelar)
      const { data: users } = await supabase.auth.admin.listUsers();
      const userExists = users?.users?.some((u: any) => u.email?.toLowerCase() === email);

      if (userExists) {
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await supabase
          .from("password_reset_otps")
          .update({ used: true })
          .eq("email", email)
          .eq("used", false);

        await supabase.from("password_reset_otps").insert({
          email,
          otp_code: otp,
          expires_at: expiresAt.toISOString(),
        });

        console.log(`🔐 Reset OTP para ${email}: ${otp}`);
      }

      // Sempre retornar sucesso para não revelar se email existe
      return json({
        success: true,
        message: "If an account exists, a reset code has been sent.",
      });
    } catch (error) {
      console.error("[FORGOT-PASSWORD] Error:", error);
      return json({ error: "Failed to process request" }, 500);
    }
  }

  // === POST /reset-password ===
  if (req.method === "POST" && path === "reset-password") {
    try {
      const body = await req.json();
      const email = sanitize(body.email, 255).toLowerCase();
      const otpCode = sanitize(body.otp, 10);
      const password = body.password;

      if (!email || !otpCode || !password) {
        return json({ error: "Email, OTP and password are required" }, 400);
      }
      if (!isValidEmail(email)) {
        return json({ error: "Invalid email format" }, 400);
      }
      if (!isValidPassword(password)) {
        return json({ error: "Password must be 8-128 characters" }, 400);
      }

      // Verificar OTP
      const { data: otpRecord } = await supabase
        .from("password_reset_otps")
        .select("*")
        .eq("email", email)
        .eq("otp_code", otpCode)
        .eq("used", false)
        .gte("expires_at", new Date().toISOString())
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (!otpRecord) {
        return json({ error: "Invalid or expired OTP" }, 400);
      }

      // Marcar OTP como usado
      await supabase
        .from("password_reset_otps")
        .update({ used: true })
        .eq("id", otpRecord.id);

      // Encontrar usuário
      const { data: users } = await supabase.auth.admin.listUsers();
      const targetUser = users?.users?.find((u: any) => u.email?.toLowerCase() === email);

      if (!targetUser) {
        return json({ error: "User not found" }, 404);
      }

      // Atualizar senha
      const { error } = await supabase.auth.admin.updateUserById(targetUser.id, { password });
      if (error) {
        return json({ error: "Failed to update password" }, 400);
      }

      return json({
        success: true,
        message: "Password updated successfully",
      });
    } catch (error) {
      console.error("[RESET-PASSWORD] Error:", error);
      return json({ error: "Failed to reset password" }, 500);
    }
  }

  // === POST /google ===
  if (req.method === "POST" && path === "google") {
    try {
      const body = await req.json();
      const idToken = body.id_token;

      if (!idToken) {
        return json({ error: "Google id_token is required" }, 400);
      }

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: idToken,
      });

      if (error) {
        return json({ error: "Google sign-in failed: " + error.message }, 401);
      }

      const userId = data.user.id;
      const isNewUser = data.user.created_at === data.user.updated_at;

      // Atualizar perfil com nome do Google se for novo
      if (isNewUser && data.user.user_metadata?.full_name) {
        await supabase
          .from("profiles")
          .update({
            full_name: data.user.user_metadata.full_name,
          })
          .eq("user_id", userId);
      }

      // Criar sessão
      const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
      await supabase.from("sessions").insert({
        user_id: userId,
        is_active: true,
        ip_address: clientIP.substring(0, 45),
        user_agent: (req.headers.get("user-agent") || "").substring(0, 255),
      });

      return json({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: {
          id: userId,
          email: data.user.email,
        },
        is_new_user: isNewUser,
        expires_in: data.session.expires_in,
      });
    } catch (error) {
      console.error("[GOOGLE] Error:", error);
      return json({ error: "Google sign-in failed" }, 500);
    }
  }

  // === GET /user/:id ===
  if (req.method === "GET" && path.startsWith("user/")) {
    const userId = path.replace("user/", "");
    
    if (!userId) {
      return json({ error: "User ID is required" }, 400);
    }

    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, company_name, phone, avatar_url")
        .eq("user_id", userId)
        .single();

      if (error || !profile) {
        return json({ error: "User not found" }, 404);
      }

      return json({ user: profile });
    } catch (error) {
      console.error("[GET-USER] Error:", error);
      return json({ error: "Failed to fetch user" }, 500);
    }
  }

  // ============================================
  // 404 - Endpoint não encontrado
  // ============================================

  return json(
    {
      error: "Endpoint not found",
      path: path,
      method: req.method,
      available_endpoints: [
        "GET /",
        "GET /health",
        "POST /register",
        "POST /login",
        "POST /google",
        "POST /send-otp",
        "POST /verify-otp",
        "POST /forgot-password",
        "POST /reset-password",
        "GET /user/:id",
      ],
    },
    404
  );
});