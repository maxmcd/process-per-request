import { spawn } from "node:child_process";
import process from "node:process";

process.on("message", (message) => {
  const [cmd, ...args] = message;
  const cp = spawn(cmd, args, { stdio: "inherit" });
  cp.on("exit", (code) => process.send(["exit", [code]]));
});
