// ============================================
// HELLO WORLD - FUNÇÃO SIMPLES
// ============================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Responder OPTIONS para CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  // Pegar o caminho da URL
  const url = new URL(req.url);
  const path = url.pathname;

  console.log("📥 Requisição recebida:", req.method, path);

  // ROTA: GET /hello
  if (req.method === "GET" && path.endsWith("/hello")) {
    return new Response(
      JSON.stringify({ 
        message: "Olá Mundo! 🚀", 
        timestamp: new Date().toISOString(),
        path: path 
      }),
      {
        status: 200,
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        },
      }
    );
  }

  // ROTA: GET / (raiz)
  if (req.method === "GET" && (path === "/" || path.endsWith("/"))) {
    return new Response(
      JSON.stringify({
        message: "Bem-vindo à API!",
        endpoints: {
          "/hello": "Retorna 'Olá Mundo'",
          "/ping": "Retorna 'pong'",
        },
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        },
      }
    );
  }

  // ROTA: GET /ping
  if (req.method === "GET" && path.endsWith("/ping")) {
    return new Response(
      JSON.stringify({ 
        pong: true, 
        timestamp: new Date().toISOString() 
      }),
      {
        status: 200,
        headers: { 
          ...corsHeaders, 
          "Content-Type": "application/json" 
        },
      }
    );
  }

  // ROTA: POST /echo
  if (req.method === "POST" && path.endsWith("/echo")) {
    try {
      const body = await req.json();
      return new Response(
        JSON.stringify({
          echo: body,
          received_at: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json" 
          },
        }
      );
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON body" }),
        {
          status: 400,
          headers: { 
            ...corsHeaders, 
            "Content-Type": "application/json" 
          },
        }
      );
    }
  }

  // Se nenhuma rota for encontrada
  return new Response(
    JSON.stringify({ 
      error: "Not found", 
      path: path,
      available_endpoints: ["/hello", "/ping", "/echo (POST)"] 
    }),
    {
      status: 404,
      headers: { 
        ...corsHeaders, 
        "Content-Type": "application/json" 
      },
    }
  );
});