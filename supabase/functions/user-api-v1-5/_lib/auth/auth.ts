// supabase/functions/user-api-v1-5/_lib/auth.ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function authenticateRequest(
  req: Request,
  serviceClient: any,
): Promise<
  | { ok: true; userId: string; userEmail: string | null }
  | { ok: false; error: string; status: number }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }

  const anonClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } =
    await anonClient.auth.getClaims(token);

  if (claimsErr || !claimsData?.claims) {
    return { ok: false, error: "Unauthorized", status: 401 };
  }

  const userId = claimsData.claims.sub as string;

  const { data: profile } = await serviceClient
    .from("profiles")
    .select("email")
    .eq("user_id", userId)
    .single();

  return { ok: true, userId, userEmail: profile?.email ?? null };
}