// ============================================================
// handlers/sendgrid/welcome.ts - POST /sendgrid/welcome (admin)
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { isValidEmail } from "../../_lib/validation.ts";
import type { HandlerContext } from "../../_lib/types.ts";
import { sendWelcomeEmail } from "../../_lib/sendgrid/index.ts";

export async function sendgridWelcomeHandler(ctx: HandlerContext): Promise<Response> {
  let body: any;
  try {
    body = await ctx.req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const { to, name, company, role, sandbox } = body;
  if (!to || !name) {
    return json(
      { success: false, error: '"to" and "name" fields are required' },
      400,
    );
  }
  if (!isValidEmail(to)) return json({ success: false, error: "Invalid email" }, 400);

  try {
    const result = await sendWelcomeEmail(
      to,
      { name, company: company || "", role: role || "" },
      { sandbox: sandbox === true },
    );
    return json({ success: true, message: "✅ Welcome email sent successfully!", data: result });
  } catch (error: any) {
    console.error("[sendgrid/welcome] Error:", error.message);
    return json({ success: false, error: error.message }, 500);
  }
}