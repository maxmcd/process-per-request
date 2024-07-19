import { spawn } from "node:child_process";
import process from "node:process";

process.on("message", (message) => {
  const [id, cmd, ...args] = message;
  const cp = spawn(cmd, args);
  cp.stdout.on("data", (data) => process.send([id, "stdout", data]));
  cp.stderr.on("data", (data) => process.send([id, "stderr", data]));
  cp.on("close", (code, signal) => process.send([id, "exit", code, signal]));
});
