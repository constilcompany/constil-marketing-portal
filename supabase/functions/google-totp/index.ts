// index.ts - No início
// ============================================
// VERIFICAÇÃO DE VARIÁVEIS DE AMBIENTE
// ============================================

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

console.log("🔍 Verificando variáveis de ambiente...");
console.log("SUPABASE_URL:", SUPABASE_URL ? "✅ Configurada" : "❌ NÃO CONFIGURADA");
console.log("SUPABASE_ANON_KEY:", SUPABASE_ANON_KEY ? "✅ Configurada" : "❌ NÃO CONFIGURADA");
console.log("SUPABASE_SERVICE_ROLE_KEY:", SUPABASE_SERVICE_ROLE_KEY ? "✅ Configurada" : "❌ NÃO CONFIGURADA");

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ Erro: Variáveis de ambiente não configuradas!");
  console.log("\n📝 Como configurar:");
  console.log("1. Crie um arquivo .env na raiz do projeto");
  console.log("2. Adicione as seguintes linhas:");
  console.log("   SUPABASE_URL=sua_url");
  console.log("   SUPABASE_ANON_KEY=sua_chave_anon");
  console.log("   SUPABASE_SERVICE_ROLE_KEY=sua_chave_service");
  console.log("\n3. Execute com: deno run --allow-net --allow-env --allow-read index.ts");
  Deno.exit(1);
}

// Agora sim, cria o cliente
const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY
);