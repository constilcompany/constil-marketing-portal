// ============================================================
// handlers/profile/get-profile.ts - GET /get_profile
// ============================================================

import { json, safeError } from "../../_lib/response.ts";
import type { HandlerContext } from "../../_lib/types.ts";

export async function getProfileHandler(ctx: HandlerContext): Promise<Response> {
  const { serviceClient, userId } = ctx;
  if (!userId) return safeError("Unauthorized", 401);

  const { data, error } = await serviceClient
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("[get-profile] DB error:", error.message);
    return json(
      { status: false, message: "Failed to fetch profile", data: null },
      500,
    );
  }

  if (!data) {
    return json(
      { status: false, message: "Profile not found", data: null },
      404,
    );
  }

  return json({
    status: true,
    message: "Success",
    data: {
      ...data,
      email_verified: data.email_verified || false,
      phone_verified: data.phone_verified || false,
    },
  });
}