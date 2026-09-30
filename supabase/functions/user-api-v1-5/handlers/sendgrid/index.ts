// ============================================================
// handlers/sendgrid/index.ts - Barrel export
// ============================================================

export { sendgridHealthHandler } from "./health.ts";
export { sendgridStatusHandler } from "./status.ts";
export { sendgridSendHandler } from "./send.ts";
export { sendgridSendRealHandler } from "./send-real.ts";
export { sendgridOtpHandler } from "./otp.ts"; // 👈 FIX: Handler (com "d")
export { sendgridEstimateHandler } from "./estimate.ts";
export { sendgridInvoiceHandler } from "./invoice.ts";
export { sendgridProposalHandler } from "./proposal.ts";
export { sendgridWelcomeHandler } from "./welcome.ts";
export { sendgridResetPasswordHandler } from "./reset-password.ts";
export { sendgridConfirmHandler } from "./confirm.ts";
export { sendgridNotificationHandler } from "./notification.ts";
export { sendgridSimpleHandler } from "./simple.ts";
export { sendgridBulkHandler } from "./bulk.ts";