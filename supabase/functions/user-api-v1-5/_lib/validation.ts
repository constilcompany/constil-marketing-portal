// ============================================================
// _lib/validation.ts - Sanitização e validação
// ============================================================

export function sanitize(input: unknown, maxLength = 500): string {
  if (!input || typeof input !== "string") return "";
  return input
    .replace(/<[^>]*>/g, "")
    .replace(/[<>'"]/g, "")
    .trim()
    .substring(0, maxLength);
}

export const isValidUUID = (id: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    id || "",
  );

export const isValidEmail = (email: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "") && email.length <= 255;

export const isValidPhone = (phone: string): boolean => {
  if (!phone) return true;
  return /^\+?[1-9]\d{1,14}$/.test(phone.replace(/\s/g, ""));
};

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") return "Password is required";
  if (password.length < 8 || password.length > 128)
    return "Password must be 8-128 characters";
  return null;
}