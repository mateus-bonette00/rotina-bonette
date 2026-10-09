import { spawn } from "node:child_process";

const children = [
  spawn("npm", ["run", "build", "-w", "rotina-bonette-shared"], { stdio: "inherit" }),
];

children[0].on("exit", (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
  }
  const api = spawn("npm", ["run", "dev:api"], { stdio: "inherit" });
  const web = spawn("npm", ["run", "dev:web"], { stdio: "inherit" });
  const stop = () => {
    api.kill("SIGTERM");
    web.kill("SIGTERM");
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  api.on("exit", (apiCode) => {
    web.kill("SIGTERM");
    process.exit(apiCode ?? 0);
  });
});
