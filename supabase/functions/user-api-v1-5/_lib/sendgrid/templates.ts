// ============================================================
// _lib/sendgrid/templates.ts - Templates tipados
// ============================================================

import { TEMPLATE_IDS } from "../config.ts";
import { sendTemplateEmail } from "./client.ts";
import {
  generateCode,
  generateToken,
  generateReference,
  formatDate,
} from "./generators.ts";

const opts = (type: string, sandbox = false) => ({ type, sandbox });

export async function sendOtpEmail(to: string, data: any = {}, o: any = {}) {
  if (!TEMPLATE_IDS.otp) throw new Error("OTP template not configured");
  return sendTemplateEmail(
    to,
    TEMPLATE_IDS.otp,
    {
      subject: data.subject || "🔐 Your verification code - CONSTIL",
      code: data.code || generateCode(),
      validity: data.validity || "5",
      name: data.name || "User",
      ...data,
    },
    { ...o, ...opts("otp", o.sandbox) },
  );
}

export async function sendEstimateEmail(to: string, data: any = {}, o: any = {}) {
  if (!TEMPLATE_IDS.estimate) throw new Error("ESTIMATE template not configured");
  const ref = data.reference || generateReference("EST");
  return sendTemplateEmail(
    to,
    TEMPLATE_IDS.estimate,
    {
      subject: data.subject || `📄 Estimate #${ref} - CONSTIL`,
      name: data.name || "John Smith",
      reference: ref,
      date: data.date || formatDate(),
      total: data.total || "12,450.00",
      downloadLink:
        data.downloadLink || `https://app.constil.com/documents/estimate/${ref}`,
      ...data,
    },
    { ...o, ...opts("estimate", o.sandbox) },
  );
}

export async function sendInvoiceEmail(to: string, data: any = {}, o: any = {}) {
  if (!TEMPLATE_IDS.invoice) throw new Error("INVOICE template not configured");
  const inv = data.invoiceNo || generateReference("INV");
  return sendTemplateEmail(
    to,
    TEMPLATE_IDS.invoice,
    {
      subject: data.subject || `🧾 Invoice #${inv} - CONSTIL`,
      name: data.name || "John Smith",
      invoiceNo: inv,
      issueDate: data.issueDate || formatDate(),
      dueDate: data.dueDate || formatDate(14),
      amount: data.amount || "8,750.00",
      downloadLink:
        data.downloadLink || `https://app.constil.com/documents/invoice/${inv}`,
      ...data,
    },
    { ...o, ...opts("invoice", o.sandbox) },
  );
}

export async function sendProposalEmail(to: string, data: any = {}, o: any = {}) {
  if (!TEMPLATE_IDS.proposal) throw new Error("PROPOSAL template not configured");
  const ref = data.reference || generateReference("PROP");
  return sendTemplateEmail(
    to,
    TEMPLATE_IDS.proposal,
    {
      subject: data.subject || `📝 Proposal #${ref} - CONSTIL`,
      name: data.name || "John Smith",
      reference: ref,
      date: data.date || formatDate(),
      downloadLink:
        data.downloadLink || `https://app.constil.com/documents/proposal/${ref}`,
      ...data,
    },
    { ...o, ...opts("proposal", o.sandbox) },
  );
}

export async function sendWelcomeEmail(to: string, data: any = {}, o: any = {}) {
  if (!TEMPLATE_IDS.welcome) throw new Error("WELCOME template not configured");
  return sendTemplateEmail(
    to,
    TEMPLATE_IDS.welcome,
    {
      subject: data.subject || `👋 Welcome to CONSTIL, ${data.name || "User"}!`,
      name: data.name || "User",
      company: data.company || "",
      role: data.role || "",
      ...data,
    },
    { ...o, ...opts("welcome", o.sandbox) },
  );
}

export async function sendResetPasswordEmail(to: string, data: any = {}, o: any = {}) {
  if (!TEMPLATE_IDS.resetPassword)
    throw new Error("RESET_PASSWORD template not configured");
  return sendTemplateEmail(
    to,
    TEMPLATE_IDS.resetPassword,
    {
      subject: data.subject || "🔐 Reset your password - CONSTIL",
      name: data.name || "User",
      code: data.code || generateCode(),
      link: data.link || "https://constil.com/reset-password",
      validity: data.validity || "15",
      ...data,
    },
    { ...o, ...opts("reset-password", o.sandbox) },
  );
}

export async function sendConfirmEmail(to: string, data: any = {}, o: any = {}) {
  if (!TEMPLATE_IDS.confirm) throw new Error("CONFIRM template not configured");
  return sendTemplateEmail(
    to,
    TEMPLATE_IDS.confirm,
    {
      subject: data.subject || "✅ Confirm your email - CONSTIL",
      name: data.name || "User",
      link: data.link || `https://constil.com/confirm/${generateToken(16)}`,
      ...data,
    },
    { ...o, ...opts("confirm", o.sandbox) },
  );
}

export async function sendNotificationEmail(to: string, data: any = {}, o: any = {}) {
  if (!TEMPLATE_IDS.notification)
    throw new Error("NOTIFICATION template not configured");
  return sendTemplateEmail(
    to,
    TEMPLATE_IDS.notification,
    {
      subject: data.subject || `🔔 ${data.title || "New notification"} - CONSTIL`,
      title: data.title || "New notification",
      message: data.message || "You have a new notification.",
      name: data.name || "User",
      details: data.details || "",
      buttonText: data.buttonText || "",
      buttonLink: data.buttonLink || "",
      footerMessage: data.footerMessage || "",
      ...data,
    },
    { ...o, ...opts("notification", o.sandbox) },
  );
}

export async function sendSimpleTemplateEmail(to: string, data: any = {}, o: any = {}) {
  if (!TEMPLATE_IDS.simple) throw new Error("SIMPLE template not configured");
  return sendTemplateEmail(
    to,
    TEMPLATE_IDS.simple,
    {
      subject: data.subject || "📧 Message from CONSTIL",
      name: data.name || "User",
      message: data.message || "This is a message from CONSTIL.",
      additionalHtml: data.additionalHtml || "",
      buttonText: data.buttonText || "",
      buttonLink: data.buttonLink || "",
      footerMessage: data.footerMessage || "",
      ...data,
    },
    { ...o, ...opts("simple", o.sandbox) },
  );
}