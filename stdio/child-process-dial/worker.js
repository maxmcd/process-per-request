import { spawn } from "node:child_process";
import process from "node:process";
import net from "node:net";

process.on("message", (message, handle) => {
  const [id, type, data] = message;
  const pipeName = `\0\\${id}`;
  if (type == "spawn") {
    let clientConn = net.createConnection(pipeName, () => {
      const [cmd, ...args] = data;
      let child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
      child.stdout.pipe(clientConn);
      child.on("error", (error) => console.log("error", error));
      child.on("exit", (code) => {
        process.send([id, "exit"]);
      });
    });
  }
});
