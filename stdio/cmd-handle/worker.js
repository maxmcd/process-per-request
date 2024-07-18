import { spawn } from "node:child_process";
import process from "node:process";
import net from "node:net";

process.on("message", (message) => {
  const [id, type, data] = message;
  if (type == "spawn") {
    const [cmd, ...args] = data;
    let child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    process.send([id, "cmd"], cmd);
  }
});
