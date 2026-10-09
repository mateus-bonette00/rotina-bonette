import path from "node:path";
import cors from "cors";
import { Prisma } from "@prisma/client";
import express, { type NextFunction, type Request, type Response } from "express";
import session from "express-session";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import { env } from "./config/env.js";
import { COOKIE_NAME, sessionCookieOptions } from "./config/cookie.js";
import { AppError } from "./lib/errors.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";
import { tokensMatch, authRouter } from "./modules/auth.js";
import { calendarRouter } from "./modules/calendar.js";
import { dashboardRouter } from "./modules/dashboard.js";
import { focusRouter } from "./modules/focus.js";
import { ideasRouter } from "./modules/ideas.js";
import { projectsRouter } from "./modules/projects.js";
import { routinesRouter } from "./modules/routines.js";
import { settingsRouter } from "./modules/settings.js";
import { tasksRouter } from "./modules/tasks.js";

const PgStore = connectPgSimple(session);
const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

export async function ensureConstraints(): Promise<void> {
  await prisma.$executeRawUnsafe(
    `CREATE UNIQUE INDEX IF NOT EXISTS task_one_doing ON "Task" ("status") WHERE "status" = 'DOING'::"TaskStatus"`,
  );
}

function originAllowed(req: Request): boolean {
  const origin = req.get("origin");
  const referer = req.get("referer");
  if (origin && origin !== env.WEB_ORIGIN) return false;
  if (referer && !referer.startsWith(env.WEB_ORIGIN)) return false;
  if (env.NODE_ENV === "production" && !origin && !referer) return false;
  return true;
}

export async function createApp() {
  await ensureConstraints();
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", env.TRUST_PROXY || false);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'none'"],
          connectSrc: ["'self'"],
          frameAncestors: ["'none'"],
        },
      },
    }),
  );
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json({ limit: "5mb" }));
  if (env.NODE_ENV !== "test") {
    app.use((req, res, next) => {
      const started = Date.now();
      res.on("finish", () => {
        if (req.path.includes("/auth/login") || req.path.includes("/auth/change-pin")) return;
        logger.info({ method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - started }, "request");
      });
      next();
    });
  }
  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: env.NODE_ENV === "test" ? 5000 : 300,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: {
          code: "RATE_LIMITED",
          message: "Muitas requisições. Tente de novo em instantes.",
          details: {},
        },
      },
    }),
  );
  app.use(
    session({
      name: COOKIE_NAME,
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: sessionCookieOptions(),
      store: new PgStore({ pool, createTableIfMissing: true }),
    }),
  );

  app.use((req, res, next) => {
    if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
      next();
      return;
    }
    if (!originAllowed(req)) {
      next(new AppError(403, "CSRF_INVALID", "Origem da requisição recusada."));
      return;
    }
    next();
  });

  app.use("/api/v1/auth", authRouter);

  app.use("/api/v1", (req, _res, next) => {
    if (!req.session.userId) {
      next(new AppError(401, "UNAUTHORIZED", "Faça login para continuar."));
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      const token = req.get("x-csrf-token") ?? "";
      const expected = req.session.csrfToken ?? "";
      if (!token || !expected || !tokensMatch(token, expected)) {
        next(new AppError(403, "CSRF_INVALID", "Não foi possível confirmar esta ação. Atualize a página."));
        return;
      }
    }
    next();
  });

  app.use("/api/v1/dashboard", dashboardRouter);
  app.use("/api/v1/projects", projectsRouter);
  app.use("/api/v1/tasks", tasksRouter);
  app.use("/api/v1/ideas", ideasRouter);
  app.use("/api/v1/calendar", calendarRouter);
  app.use("/api/v1/routines", routinesRouter);
  app.use("/api/v1/focus", focusRouter);
  app.use("/api/v1/settings", settingsRouter);

  app.use("/api", (_req, _res, next) => {
    next(new AppError(404, "NOT_FOUND", "Rota não encontrada."));
  });

  if (env.WEB_DIST) {
    app.use(express.static(env.WEB_DIST));
    app.get("*", (_req, res) => res.sendFile(path.join(env.WEB_DIST!, "index.html")));
  }

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof AppError) {
      res.status(error.status).json({
        error: { code: error.code, message: error.message, details: error.details },
      });
      return;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      res.status(409).json({
        error: {
          code: "DOING_LIMIT_REACHED",
          message: "Já existe uma tarefa em execução.",
          details: {},
        },
      });
      return;
    }
    logger.error({ err: error }, "erro interno");
    const message = env.NODE_ENV === "production" ? "Erro interno." : "Erro interno.";
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message, details: {} } });
  });

  return app;
}

export async function closeApp(): Promise<void> {
  await prisma.$disconnect();
  await pool.end();
}
