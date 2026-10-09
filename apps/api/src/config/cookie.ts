import { env } from "./env.js";

export const COOKIE_NAME = "rotina.sid";

export function sessionCookieOptions(idleHours = env.SESSION_IDLE_HOURS) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: env.NODE_ENV === "production",
    maxAge: idleHours * 60 * 60 * 1000,
  };
}
