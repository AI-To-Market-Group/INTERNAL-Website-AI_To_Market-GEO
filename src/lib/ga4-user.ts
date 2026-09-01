import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE_NAME = "ga4_oauth_uid";

export async function getOrCreateUserId(): Promise<string> {
  const cookieStore = await cookies();
  let id = cookieStore.get(COOKIE_NAME)?.value;
  if (!id) {
    id = crypto.randomUUID();
    cookieStore.set(COOKIE_NAME, id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 year
    });
  }
  return id;
}

