import { randomBytes, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import argon2 from "argon2";
import type { Request } from "express";
import { changePinSchema, loginSchema } from "rotina-bonette-shared";
import { sessionCookieOptions } from "../config/cookie.js";
import { clearPinFailures, pinBackoff, pinLockRemaining, recordPinFailure } from "../lib/attempts.js";
import { AppError } from "../lib/errors.js";
import { asyncHandler, parse } from "../lib/http.js";
import { logger } from "../lib/logger.js";
import { prisma } from "../lib/prisma.js";
import { getSettings } from "./settings.js";

const GENERIC = "PIN inválido ou acesso temporariamente bloqueado";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: process.env.NODE_ENV === "test" ? 1000 : 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: GENERIC, details: {} } },
});

let dummyHash: string | null = null;

async function fakeHash(): Promise<string> {
  if (!dummyHash) dummyHash = await argon2.hash("0000", { type: argon2.argon2id });
  return dummyHash;
}

function clientKey(req: Request): string {
  return req.ip || "local";
}

function regenerate(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((error) => (error ? reject(error) : resolve()));
  });
}

function publicUser(user: { id: string; name: string; lastLoginAt: Date | null }) {
  return { id: user.id, name: user.name, lastLoginAt: user.lastLoginAt };
}

function requireSessionAndCsrf(req: Request): string {
  if (!req.session.userId || !req.session.csrfToken) {
    throw new AppError(401, "UNAUTHORIZED", "Faça login para continuar.");
  }
  const token = req.get("x-csrf-token") ?? "";
  if (!tokensMatch(token, req.session.csrfToken)) {
    throw new AppError(403, "CSRF_INVALID", "Não foi possível confirmar esta ação. Atualize a página.");
  }
  return req.session.userId;
}

async function rejectPin(req: Request): Promise<never> {
  const fails = recordPinFailure(clientKey(req));
  await pinBackoff(fails);
  logger.warn({ event: "login_failed", fails, ip: clientKey(req) }, "tentativa de PIN recusada");
  throw new AppError(401, "INVALID_PIN", GENERIC);
}

export const authRouter = Router();

authRouter.get(
  "/session",
  asyncHandler(async (req, res) => {
    if (!req.session.userId) {
      res.json({ authenticated: false, user: null, csrfToken: null });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.session.userId } });
    if (!user) {
      res.json({ authenticated: false, user: null, csrfToken: null });
      return;
    }
    res.json({ authenticated: true, user: publicUser(user), csrfToken: req.session.csrfToken ?? null });
  }),
);

authRouter.get(
  "/csrf",
  asyncHandler(async (req, res) => {
    if (!req.session.userId || !req.session.csrfToken) {
      throw new AppError(401, "UNAUTHORIZED", "Faça login para continuar.");
    }
    res.json({ csrfToken: req.session.csrfToken });
  }),
);

authRouter.post(
  "/login",
  authLimiter,
  asyncHandler(async (req, res) => {
    const input = parse(loginSchema, req.body);
    const key = clientKey(req);
    if (pinLockRemaining(key) > 0) {
      logger.warn({ event: "login_locked", ip: key }, "PIN bloqueado");
      throw new AppError(429, "RATE_LIMITED", GENERIC);
    }

    const user = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
    const hash = user?.pinHash ?? (await fakeHash());
    const matches = await argon2.verify(hash, input.pin).catch(() => false);
    if (!user || !matches) await rejectPin(req);
    if (!user) throw new AppError(401, "INVALID_PIN", GENERIC);

    clearPinFailures(key);
    const settings = await getSettings();
    await regenerate(req);
    req.session.userId = user.id;
    req.session.csrfToken = randomBytes(32).toString("hex");
    req.session.cookie.maxAge = sessionCookieOptions(settings.sessionIdleHours).maxAge;
    await saveSession(req);
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    logger.info({ event: "login_ok", userId: updated.id }, "login");
    res.json({ user: publicUser(updated), csrfToken: req.session.csrfToken });
  }),
);

authRouter.post(
  "/logout",
  asyncHandler(async (req, res) => {
    requireSessionAndCsrf(req);
    await destroySession(req);
    res.json({ ok: true });
  }),
);

authRouter.post(
  "/logout-all",
  asyncHandler(async (req, res) => {
    requireSessionAndCsrf(req);
    await destroySession(req);
    await prisma.$executeRaw`DELETE FROM session`;
    res.json({ ok: true });
  }),
);

authRouter.post(
  "/change-pin",
  asyncHandler(async (req, res) => {
    const userId = requireSessionAndCsrf(req);
    const input = parse(changePinSchema, req.body);
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new AppError(401, "UNAUTHORIZED", "Faça login para continuar.");
    const matches = await argon2.verify(user.pinHash, input.currentPin).catch(() => false);
    if (!matches) {
      logger.warn({ event: "pin_change_failed", userId: user.id }, "PIN atual recusado");
      throw new AppError(401, "INVALID_PIN", GENERIC);
    }
    const pinHash = await argon2.hash(input.newPin, { type: argon2.argon2id });
    await prisma.user.update({ where: { id: user.id }, data: { pinHash } });
    await regenerate(req);
    req.session.userId = user.id;
    req.session.csrfToken = randomBytes(32).toString("hex");
    await saveSession(req);
    await prisma.$executeRaw`DELETE FROM session WHERE sid <> ${req.sessionID}`;
    logger.info({ event: "pin_changed", userId: user.id }, "PIN alterado");
    res.json({ ok: true, csrfToken: req.session.csrfToken });
  }),
);

export function tokensMatch(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
