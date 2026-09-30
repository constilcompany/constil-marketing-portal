// ============================================================
// handlers/sendgrid/invoice.ts - POST /sendgrid/invoice (admin)
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { isValidEmail } from "../../_lib/validation.ts";
import type { HandlerContext } from "../../_lib/types.ts";
import { sendInvoiceEmail, generateReference, formatDate } from "../../_lib/sendgrid/index.ts";

export async function sendgridInvoiceHandler(ctx: HandlerContext): Promise<Response> {
  let body: any;
  try {
    body = await ctx.req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const { to, name, invoiceNo, issueDate, dueDate, amount, downloadLink, sandbox } = body;
  if (!to) return json({ success: false, error: '"to" field is required' }, 400);
  if (!isValidEmail(to)) return json({ success: false, error: "Invalid email" }, 400);

  try {
    const inv = invoiceNo || generateReference("INV");
    const result = await sendInvoiceEmail(
      to,
      {
        name: name || "John Smith",
        invoiceNo: inv,
        issueDate: issueDate || formatDate(),
        dueDate: dueDate || formatDate(14),
        amount: amount || "8,750.00",
        downloadLink:
          downloadLink || `https://app.constil.com/documents/invoice/${inv}`,
      },
      { sandbox: sandbox === true },
    );
    return json({ success: true, message: "✅ Invoice sent successfully!", data: result });
  } catch (error: any) {
    console.error("[sendgrid/invoice] Error:", error.message);
    return json({ success: false, error: error.message }, 500);
  }
}