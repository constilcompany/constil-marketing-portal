// ============================================================
// handlers/sendgrid/health.ts - Health check (público)
// ============================================================

import { json } from "../../_lib/response.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function sendgridHealthHandler(_ctx: HandlerContext): Promise<Response> {
  return json({
    status: "healthy",
    service: "sendgrid-integrated",
    timestamp: new Date().toISOString(),
  });
}