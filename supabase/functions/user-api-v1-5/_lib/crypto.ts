// ============================================================
// _lib/crypto.ts - Geração segura de códigos/tokens
// ============================================================

/**
 * Gera OTP de 6 dígitos criptograficamente seguro
 */
export function generateCode(): string {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return String(100000 + (arr[0] % 900000));
}

/**
 * Gera token aleatório seguro (hex)
 */
export function generateToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Gera referência legível (ex: INV-2025-0042)
 */
export function generateReference(prefix: string): string {
  const year = new Date().getFullYear();
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  const id = String(arr[0] % 10000).padStart(4, "0");
  return `${prefix}-${year}-${id}`;
}

export function formatDate(daysToAdd = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysToAdd);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}