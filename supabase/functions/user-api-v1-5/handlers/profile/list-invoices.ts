// ============================================================
// handlers/profile/list-invoices.ts - GET /list_invoices
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function listInvoicesHandler(ctx: HandlerContext): Promise<Response> {
  const { serviceClient, userId } = ctx;
  if (!userId) return safeError("Unauthorized", 401);

  const { data, error } = await serviceClient
    .from("invoices")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[list-invoices] DB error:", error.message);
    return json(
      { status: false, message: "Failed to fetch invoices", data: [] },
      500,
    );
  }

  return json({ status: true, message: "Success", data: data ?? [] });
}