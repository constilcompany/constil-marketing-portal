// handlers/auth/index.ts
export { registerHandler } from "./register.ts";
export { loginHandler } from "./login.ts";
export { googleHandler } from "./google.ts";
export { sendSignupOtpHandler, verifyOtpHandler } from "./otp.ts";
export { forgotPasswordHandler, resetPasswordHandler } from "./password.ts";