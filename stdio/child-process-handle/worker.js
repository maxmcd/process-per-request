import { spawn } from "node:child_process";
import process from "node:process";
import net from "node:net";

process.on("message", (message, handle) => {
  const [id, type, data] = message;
  if (type == "spawn") {
    const [cmd, ...args] = data;
    let child = spawn(cmd, args, { stdio: ["pipe", handle, "pipe"] });
    child.on("error", (error) => console.log("error", error));
    child.on("exit", (code) => {
      handle.end();
    });
    child.on("close", () => {
      process.send([id, "exit"]);
    });
  }
});
