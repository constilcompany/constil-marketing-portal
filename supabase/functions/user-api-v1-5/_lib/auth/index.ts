// ============================================================
// _lib/auth/index.ts - Barrel export
// ============================================================

export {
  getServiceClient,
  getAnonClient,
} from "./client.ts";

export {
  requireAuth,
  requireAdmin,
  AuthError,
  type AuthContext,
} from "./context.ts";

export { getClientIP } from "./ip.ts";