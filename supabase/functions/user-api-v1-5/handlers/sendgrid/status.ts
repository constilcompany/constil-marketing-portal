// ============================================================
// handlers/sendgrid/status.ts - Status SendGrid (admin)
// ============================================================

import { json } from "../../_lib/response.ts";
import { FROM_EMAIL, SENDGRID_API_KEY, TEMPLATE_IDS, ENVIRONMENT } from "../../_lib/config.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function sendgridStatusHandler(_ctx: HandlerContext): Promise<Response> {
  return json({
    success: true,
    service: "SendGrid",
    from: FROM_EMAIL,
    apiKeyConfigured: !!SENDGRID_API_KEY,
    templates: {
      otp: !!TEMPLATE_IDS.otp,
      estimate: !!TEMPLATE_IDS.estimate,
      invoice: !!TEMPLATE_IDS.invoice,
      proposal: !!TEMPLATE_IDS.proposal,
      welcome: !!TEMPLATE_IDS.welcome,
      resetPassword: !!TEMPLATE_IDS.resetPassword,
      confirm: !!TEMPLATE_IDS.confirm,
      notification: !!TEMPLATE_IDS.notification,
      simple: !!TEMPLATE_IDS.simple,
    },
    environment: ENVIRONMENT,
    status: "operational",
    timestamp: new Date().toISOString(),
  });
}