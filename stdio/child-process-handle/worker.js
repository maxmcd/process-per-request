import { spawn } from "node:child_process";
import process from "node:process";
import net from "node:net";

process.on("message", (message, handle) => {
  const [id, type, data] = message;
  if (type == "spawn") {
    const [cmd, ...args] = data;
    let child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    child.stdout.pipe(handle);
    child.stdout.on("close", () => {
      console.log("stdout close");
      handle.end();
    });
    child.on("error", (error) => console.log("error", error));
    child.on("exit", (code) => {
      process.send([id, "exit"]);
    });
  }
});
