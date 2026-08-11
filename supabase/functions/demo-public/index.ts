// ============================================
// DEMO PUBLIC - API DE APRESENTAÇÃO PÚBLICA
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  // === CORS OPTIONS ===
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/demo-public\/?/, "");

  console.log("📥 Requisição:", req.method, path);

  // ============================================
  // ENDPOINTS PÚBLICOS (NÃO EXIGEM AUTENTICAÇÃO)
  // ============================================

  // === GET / ===
  if (req.method === "GET" && path === "") {
    return json({
      name: "Demo Public API",
      version: "1.0.0",
      description: "API de apresentação pública",
      endpoints: {
        "/": "Informações da API",
        "/packages": "Lista de pacotes disponíveis",
        "/health": "Status da API",
        "/info": "Informações do sistema",
        "/time": "Horário atual",
        "/echo": "Ecoa o que você enviar (POST)",
      },
      status: "online",
      timestamp: new Date().toISOString(),
    });
  }

  // === GET /health ===
  if (req.method === "GET" && path === "health") {
    return json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: "running",
    });
  }

  // === GET /time ===
  if (req.method === "GET" && path === "time") {
    return json({
      current_time: new Date().toISOString(),
      timezone: "UTC",
      timestamp: Date.now(),
    });
  }

  // === GET /info ===
  if (req.method === "GET" && path === "info") {
    return json({
      name: "Demo Public API",
      version: "1.0.0",
      environment: "production",
      region: Deno.env.get("SUPABASE_REGION") || "unknown",
      runtime: "Deno",
      features: {
        public_endpoints: true,
        authentication: "optional",
        rate_limiting: false,
      },
    });
  }

  // === GET /packages ===
  if (req.method === "GET" && path === "packages") {
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (!supabaseUrl || !supabaseKey) {
        // Fallback: dados mockados
        return json({
          packages: [
            {
              id: "free-001",
              name: "Plano Gratuito",
              price: 0,
              description: "Perfeito para começar",
              credits: { invoice: 3, estimate: 2, ai_estimate: 1 },
              is_free: true,
            },
            {
              id: "pro-001",
              name: "Plano Profissional",
              price: 99.90,
              description: "Para profissionais",
              credits: { invoice: 10, estimate: 5, ai_estimate: 3 },
              is_free: false,
            },
            {
              id: "enterprise-001",
              name: "Plano Enterprise",
              price: 299.90,
              description: "Para grandes empresas",
              credits: { invoice: 50, estimate: 25, ai_estimate: 10 },
              is_free: false,
              unlimited: true,
            },
          ],
          source: "mock",
          timestamp: new Date().toISOString(),
        });
      }

      // Conectar ao Supabase
      const { createClient } = await import(
        "https://esm.sh/@supabase/supabase-js@2"
      );
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data, error } = await supabase
        .from("credit_packages")
        .select(
          "id, name, price, description, invoice_credits, estimate_credits, ai_estimate_credits, is_free, is_active"
        )
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (error) {
        return json({ error: "Failed to fetch packages", detail: error.message }, 500);
      }

      return json({
        packages: data || [],
        source: "database",
        count: data?.length || 0,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      return json({
        error: "Internal error",
        message: error.message,
      }, 500);
    }
  }

  // === POST /echo ===
  if (req.method === "POST" && path === "echo") {
    try {
      const body = await req.json();
      return json({
        echo: body,
        received_at: new Date().toISOString(),
        headers: {
          content_type: req.headers.get("content-type"),
          user_agent: req.headers.get("user-agent"),
        },
      });
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
  }

  // === GET /users (mock) ===
  if (req.method === "GET" && path === "users") {
    return json({
      users: [
        { id: 1, name: "João Silva", email: "joao@exemplo.com" },
        { id: 2, name: "Maria Oliveira", email: "maria@exemplo.com" },
        { id: 3, name: "Pedro Santos", email: "pedro@exemplo.com" },
      ],
      total: 3,
      timestamp: new Date().toISOString(),
    });
  }

  // === GET /status ===
  if (req.method === "GET" && path === "status") {
    return json({
      status: "online",
      version: "1.0.0",
      endpoints_count: 8,
      public_endpoints: ["/", "/health", "/time", "/info", "/packages", "/echo", "/users", "/status"],
      timestamp: new Date().toISOString(),
    });
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
        "GET /time",
        "GET /info",
        "GET /packages",
        "GET /users",
        "GET /status",
        "POST /echo",
      ],
    },
    404
  );
});