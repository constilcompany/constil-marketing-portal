// ============================================================
// handlers/sendgrid/bulk.ts - POST /sendgrid/bulk (admin)
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { sendEmail } from "../../_lib/sendgrid/sendgrid.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function sendgridBulkHandler(ctx: HandlerContext): Promise<Response> {
  let body: any;
  try {
    body = await ctx.req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const { emails, sandbox } = body;

  if (!emails || !Array.isArray(emails) || emails.length === 0) {
    return json(
      {
        success: false,
        error: "Invalid email list. Please send an array with at least one email.",
      },
      400,
    );
  }

  // ⚠️ Hard cap para evitar abuso
  const MAX_BULK = 200;
  if (emails.length > MAX_BULK) {
    return json(
      {
        success: false,
        error: `Too many emails in a single request. Maximum: ${MAX_BULK}`,
      },
      400,
    );
  }

  const results = {
    total: emails.length,
    sent: 0,
    failed: 0,
    details: [] as Array<Record<string, unknown>>,
  };

  // Processa em lotes com concorrência limitada
  const CONCURRENCY = 10;
  const chunks: any[][] = [];
  for (let i = 0; i < emails.length; i += CONCURRENCY) {
    chunks.push(emails.slice(i, i + CONCURRENCY));
  }

  for (const chunk of chunks) {
    await Promise.allSettled(
      chunk.map(async (email: any) => {
        try {
          const result = await sendEmail({
            ...email,
            sandbox: sandbox === true,
            type: "sendgrid/bulk",
          });
          results.sent++;
          results.details.push({ to: email.to, status: "sent", messageId: result.messageId });
        } catch (error: any) {
          results.failed++;
          results.details.push({
            to: email.to,
            status: "failed",
            error: error.message,
          });
        }
      }),
    );
  }

  return json({
    success: true,
    message: `✅ ${results.sent} emails sent, ${results.failed} failed`,
    data: results,
  });
}