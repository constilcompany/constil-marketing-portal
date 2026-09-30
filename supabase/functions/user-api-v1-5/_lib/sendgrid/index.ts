// ============================================================
// _lib/sendgrid/index.ts - Barrel export
// ============================================================

export {
  sendEmail,
  sendTemplateEmail,
  type SendEmailPayload,
} from "./client.ts";

export {
  sendOtpEmail,
  sendEstimateEmail,
  sendInvoiceEmail,
  sendProposalEmail,
  sendWelcomeEmail,
  sendResetPasswordEmail,
  sendConfirmEmail,
  sendNotificationEmail,
  sendSimpleTemplateEmail,
} from "./templates.ts";

export {
  generateCode,
  generateToken,
  generateReference,
  formatDate,
} from "./generators.ts";