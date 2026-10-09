import argon2 from "argon2";
import { pinSchema } from "rotina-bonette-shared";
import { prisma } from "./lib/prisma.js";

async function readHidden(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const stdin = process.stdin;
    const stdout = process.stdout;
    stdout.write(prompt);
    if (!stdin.setRawMode) {
      reject(new Error("Este terminal não aceita digitação oculta. Use INITIAL_PIN."));
      return;
    }
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (chunk: string) => {
      if (chunk === "\u0003") {
        cleanup();
        reject(new Error("cancelado"));
        return;
      }
      if (chunk === "\r" || chunk === "\n") {
        stdout.write("\n");
        cleanup();
        resolve(value);
        return;
      }
      if (chunk === "\u007f" || chunk === "\b") {
        value = value.slice(0, -1);
        return;
      }
      if (/^\d$/.test(chunk) && value.length < 4) value += chunk;
    };
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.off("data", onData);
    };
    stdin.on("data", onData);
  });
}

async function askPin(): Promise<string> {
  const fromEnv = process.env.INITIAL_PIN;
  if (fromEnv) {
    const parsed = pinSchema.safeParse(fromEnv);
    if (!parsed.success) {
      console.error("INITIAL_PIN precisa ter exatamente 4 números.");
      process.exit(1);
    }
    console.log("PIN lido de INITIAL_PIN. Apague essa variável depois do setup.");
    return parsed.data;
  }
  if (!process.stdin.isTTY) {
    console.error("Sem terminal interativo. Rode INITIAL_PIN=1234 npm run setup e depois apague a variável.");
    process.exit(1);
  }
  const first = await readHidden("Crie um PIN de 4 dígitos: ");
  const second = await readHidden("Repita o PIN: ");
  if (first !== second) {
    console.error("Os PINs não coincidem.");
    process.exit(1);
  }
  const parsed = pinSchema.safeParse(first);
  if (!parsed.success) {
    console.error("O PIN precisa ter exatamente 4 números.");
    process.exit(1);
  }
  return parsed.data;
}

const pin = await askPin();
const pinHash = await argon2.hash(pin, { type: argon2.argon2id });
const existing = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
if (existing) {
  await prisma.user.update({ where: { id: existing.id }, data: { pinHash, name: existing.name || "Bonette" } });
  console.log("PIN do usuário único atualizado.");
} else {
  await prisma.user.create({ data: { name: "Bonette", pinHash } });
  console.log("Usuário único criado.");
}
await prisma.$disconnect();
