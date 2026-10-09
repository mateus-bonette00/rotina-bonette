import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import argon2 from "argon2";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { closeApp, createApp } from "../src/app.js";
import { resetPinAttempts } from "../src/lib/attempts.js";
import { prisma } from "../src/lib/prisma.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const pin = "1357";
let app: Awaited<ReturnType<typeof createApp>>;

async function resetDomain() {
  await prisma.focusSession.deleteMany();
  await prisma.calendarBlock.deleteMany();
  await prisma.idea.deleteMany();
  await prisma.routine.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
}

async function login() {
  const agent = request.agent(app);
  const response = await agent.post("/api/v1/auth/login").send({ pin });
  expect(response.status).toBe(200);
  return { agent, csrf: response.body.csrfToken as string };
}

beforeAll(async () => {
  execSync("npx prisma migrate deploy", {
    cwd: path.resolve(here, ".."),
    env: process.env,
    stdio: "inherit",
  });
  app = await createApp();
  const pinHash = await argon2.hash(pin, { type: argon2.argon2id });
  await prisma.user.deleteMany();
  await prisma.user.create({ data: { name: "Bonette", pinHash } });
});

beforeEach(async () => {
  resetPinAttempts();
  await resetDomain();
});

afterAll(async () => {
  await closeApp();
});

describe("auth", () => {
  it("entra com o PIN certo e não devolve o hash", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({ pin });
    expect(response.status).toBe(200);
    expect(response.body.user.name).toBe("Bonette");
    expect(JSON.stringify(response.body)).not.toContain("pinHash");
    expect(response.body.csrfToken).toBeTypeOf("string");
  });

  it("recusa PIN incorreto com mensagem genérica", async () => {
    const response = await request(app).post("/api/v1/auth/login").send({ pin: "0000" });
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("INVALID_PIN");
    expect(response.body.error.message).toBe("PIN inválido ou acesso temporariamente bloqueado");
  });

  it("bloqueia depois de 5 tentativas", async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await request(app).post("/api/v1/auth/login").send({ pin: "0000" });
      expect(response.status).toBe(401);
    }
    const blocked = await request(app).post("/api/v1/auth/login").send({ pin });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("RATE_LIMITED");
  });

  it("bloqueia rota privada sem sessão", async () => {
    const response = await request(app).get("/api/v1/tasks");
    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("UNAUTHORIZED");
  });
});

describe("regras", () => {
  it("exige CSRF em mutation", async () => {
    const { agent } = await login();
    const response = await agent.post("/api/v1/tasks").send({ title: "Sem token" });
    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe("CSRF_INVALID");
  });

  it("valida payload", async () => {
    const { agent, csrf } = await login();
    const response = await agent.post("/api/v1/tasks").set("x-csrf-token", csrf).send({ title: "" });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("permite só uma tarefa em DOING", async () => {
    const { agent, csrf } = await login();
    const first = await agent.post("/api/v1/tasks").set("x-csrf-token", csrf).send({ title: "Primeira", status: "DOING" });
    const second = await agent.post("/api/v1/tasks").set("x-csrf-token", csrf).send({ title: "Segunda", status: "DOING" });
    expect(first.status).toBe(201);
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("DOING_LIMIT_REACHED");
    const retry = await agent.post("/api/v1/tasks").set("x-csrf-token", csrf).send({ title: "Segunda", status: "DOING", confirmReplace: true });
    expect(retry.status).toBe(201);
    const tasks = await agent.get("/api/v1/tasks").set("x-csrf-token", csrf);
    expect(tasks.body.tasks.filter((task: { status: string }) => task.status === "DOING")).toHaveLength(1);
  });

  it("permite no máximo 3 tarefas em TODAY", async () => {
    const { agent, csrf } = await login();
    for (let index = 0; index < 3; index += 1) {
      const response = await agent.post("/api/v1/tasks").set("x-csrf-token", csrf).send({ title: `Hoje ${index}`, status: "TODAY" });
      expect(response.status).toBe(201);
    }
    const overflow = await agent.post("/api/v1/tasks").set("x-csrf-token", csrf).send({ title: "Quarta", status: "TODAY" });
    expect(overflow.status).toBe(409);
    expect(overflow.body.error.code).toBe("TODAY_LIMIT_REACHED");
  });

  it("permite no máximo 4 projetos ACTIVE", async () => {
    const { agent, csrf } = await login();
    for (let index = 0; index < 4; index += 1) {
      const response = await agent.post("/api/v1/projects").set("x-csrf-token", csrf).send({
        name: `Ativo ${index}`,
        color: "#4c86ff",
        status: "ACTIVE",
      });
      expect(response.status).toBe(201);
    }
    const overflow = await agent.post("/api/v1/projects").set("x-csrf-token", csrf).send({
      name: "Quinto",
      color: "#4c86ff",
      status: "ACTIVE",
    });
    expect(overflow.status).toBe(409);
    expect(overflow.body.error.code).toBe("ACTIVE_PROJECT_LIMIT_REACHED");
  });

  it("converte ideia em tarefa", async () => {
    const { agent, csrf } = await login();
    const idea = await agent.post("/api/v1/ideas").set("x-csrf-token", csrf).send({ title: "Uma ideia" });
    const converted = await agent.post(`/api/v1/ideas/${idea.body.idea.id}/convert-to-task`).set("x-csrf-token", csrf).send({});
    expect(converted.status).toBe(201);
    expect(converted.body.idea.status).toBe("CONVERTED");
    expect(converted.body.task.title).toBe("Uma ideia");
    expect(converted.body.task.status).toBe("INBOX");
  });

  it("conclui tarefa", async () => {
    const { agent, csrf } = await login();
    const created = await agent.post("/api/v1/tasks").set("x-csrf-token", csrf).send({ title: "Fechar" });
    const done = await agent.post(`/api/v1/tasks/${created.body.task.id}/complete`).set("x-csrf-token", csrf).send({});
    expect(done.status).toBe(200);
    expect(done.body.task.status).toBe("DONE");
    expect(done.body.task.completedAt).toBeTruthy();
  });
});
