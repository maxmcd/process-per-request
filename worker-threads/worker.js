import { execFile } from "node:child_process";
import { parentPort } from "node:worker_threads";

parentPort.on("message", (message) => {
  const [id, cmd, ...args] = message;

  execFile(cmd, args, (_error, stdout, _stderr) => {
    parentPort.postMessage([id, stdout]);
  });
});
