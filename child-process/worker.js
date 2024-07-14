import { execFile } from "node:child_process";
import process from "node:process";

process.on("message", (message) => {
  const [id, cmd, ...args] = message;

  execFile(cmd, args, (_error, stdout, _stderr) => {
    process.send([id, stdout]);
  });
});
