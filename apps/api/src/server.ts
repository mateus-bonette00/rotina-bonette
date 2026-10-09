import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./lib/logger.js";
import { prisma } from "./lib/prisma.js";

const app = await createApp();
const users = await prisma.user.count();
if (users === 0) {
  logger.warn("Nenhum usuário cadastrado. Rode npm run setup para criar o PIN.");
}

app.listen(env.API_PORT, env.API_HOST, () => {
  logger.info({ host: env.API_HOST, port: env.API_PORT }, "Rotina Bonette API no ar");
});
