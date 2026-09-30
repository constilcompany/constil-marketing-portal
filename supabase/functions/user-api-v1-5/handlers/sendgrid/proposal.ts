// ============================================================
// handlers/sendgrid/proposal.ts - POST /sendgrid/proposal (admin)
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { isValidEmail } from "../../_lib/validation.ts";
import type { HandlerContext } from "../../_lib/types.ts";
import { sendProposalEmail, generateReference, formatDate } from "../../_lib/sendgrid/index.ts";

export async function sendgridProposalHandler(ctx: HandlerContext): Promise<Response> {
  let body: any;
  try {
    body = await ctx.req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const { to, name, reference, date, downloadLink, sandbox } = body;
  if (!to) return json({ success: false, error: '"to" field is required' }, 400);
  if (!isValidEmail(to)) return json({ success: false, error: "Invalid email" }, 400);

  try {
    const ref = reference || generateReference("PROP");
    const result = await sendProposalEmail(
      to,
      {
        name: name || "John Smith",
        reference: ref,
        date: date || formatDate(),
        downloadLink:
          downloadLink || `https://app.constil.com/documents/proposal/${ref}`,
      },
      { sandbox: sandbox === true },
    );
    return json({ success: true, message: "✅ Proposal sent successfully!", data: result });
  } catch (error: any) {
    console.error("[sendgrid/proposal] Error:", error.message);
    return json({ success: false, error: error.message }, 500);
  }
}