import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { z } from "zod";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../../.env") });

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z
    .string()
    .url()
    .default("http://127.0.0.1:5173")
    .transform((value) => value.replace(/\/$/, "")),
  SESSION_SECRET: z.string().min(16),
  SESSION_IDLE_HOURS: z.coerce.number().int().positive().default(12),
});

export const env = schema.parse(process.env);

if (env.API_HOST === "0.0.0.0" || env.API_HOST === "::") {
  throw new Error("A API só pode escutar em localhost. Não use 0.0.0.0.");
}
