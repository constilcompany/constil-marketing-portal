// ============================================================
// handlers/sendgrid/estimate.ts - POST /sendgrid/estimate (admin)
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { isValidEmail } from "../../_lib/validation.ts";
import type { HandlerContext } from "../../_lib/types.ts";
import { sendEstimateEmail, generateReference, formatDate } from "../../_lib/sendgrid/index.ts";

export async function sendgridEstimateHandler(ctx: HandlerContext): Promise<Response> {
  let body: any;
  try {
    body = await ctx.req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const { to, name, reference, date, total, downloadLink, sandbox } = body;
  if (!to) return json({ success: false, error: '"to" field is required' }, 400);
  if (!isValidEmail(to)) return json({ success: false, error: "Invalid email" }, 400);

  try {
    const result = await sendEstimateEmail(
      to,
      {
        name: name || "John Smith",
        reference: reference || generateReference("EST"),
        date: date || formatDate(),
        total: total || "12,450.00",
        downloadLink:
          downloadLink ||
          `https://app.constil.com/documents/estimate/${generateReference("EST")}`,
      },
      { sandbox: sandbox === true },
    );
    return json({ success: true, message: "✅ Estimate sent successfully!", data: result });
  } catch (error: any) {
    console.error("[sendgrid/estimate] Error:", error.message);
    return json({ success: false, error: error.message }, 500);
  }
}