/**
 * Client-side security utilities
 * NOTE: These are convenience helpers. ALL security must be enforced server-side.
 */

/**
 * Sanitize text input - strips HTML tags and trims
 */
export function sanitizeInput(input: string, maxLength = 500): string {
  if (!input || typeof input !== 'string') return '';
  return input
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/[<>'"]/g, '') // Strip dangerous characters
    .trim()
    .substring(0, maxLength);
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 255;
}

/**
 * Validate UUID format
 */
export function isValidUUID(id: string): boolean {
  if (!id || typeof id !== 'string') return false;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Safe error message - never expose internals to users
 */
export function getSafeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Only show known safe error messages
    const safePatterns = [
      'Invalid login credentials',
      'Email not confirmed',
      'already registered',
      'already been registered',
      'Password should be at least',
      'Invalid coupon',
      'Insufficient credits',
      'Missing required fields',
      'Unauthorized',
      'Forbidden',
      'Trial not available',
      'already used a trial',
    ];
    
    for (const pattern of safePatterns) {
      if (error.message.includes(pattern)) return error.message;
    }
  }
  return 'Something went wrong. Please try again.';
}

/**
 * Build secure API URL for edge functions
 */
export function getEdgeFunctionUrl(path: string): string {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  if (!projectId) throw new Error('Configuration error');
  return `https://${projectId}.supabase.co/functions/v1/${path}`;
}
