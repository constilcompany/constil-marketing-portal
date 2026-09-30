// ============================================================
// handlers/sendgrid/notification.ts (admin)
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import { isValidEmail } from "../../_lib/validation.ts";
import type { HandlerContext } from "../../_lib/types.ts";
import { sendNotificationEmail } from "../../_lib/sendgrid/index.ts";

export async function sendgridNotificationHandler(ctx: HandlerContext): Promise<Response> {
  let body: any;
  try {
    body = await ctx.req.json();
  } catch {
    return safeError("Invalid request body", 400);
  }

  const {
    to,
    title,
    message,
    name,
    details,
    buttonText,
    buttonLink,
    footerMessage,
    sandbox,
  } = body;

  if (!to || !title || !message) {
    return json(
      {
        success: false,
        error: '"to", "title" and "message" fields are required',
      },
      400,
    );
  }
  if (!isValidEmail(to)) return json({ success: false, error: "Invalid email" }, 400);

  try {
    const result = await sendNotificationEmail(
      to,
      {
        title,
        message,
        name: name || "User",
        details: details || "",
        buttonText: buttonText || "",
        buttonLink: buttonLink || "",
        footerMessage: footerMessage || "",
      },
      { sandbox: sandbox === true },
    );
    return json({
      success: true,
      message: "✅ Notification sent successfully!",
      data: result,
    });
  } catch (error: any) {
    console.error("[sendgrid/notification] Error:", error.message);
    return json({ success: false, error: error.message }, 500);
  }
}