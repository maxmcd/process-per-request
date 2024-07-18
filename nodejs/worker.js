// import { workerData, parentPort } from "worker_threads";
// import { Writer } from "./streams.js";

// const { sharedState, sharedBuffer, maxMessageSize } = workerData;

// const writer = new Writer({
//   sharedState,
//   sharedBuffer,
//   maxMessageSize,
// });

// parentPort.postMessage("hi");
// for (let i = 0; i < 10000; i++) {
//   writer.write("Hello, World!");
// }
// console.log("done");

import { spawn } from "node:child_process";
let cp;

process.on("message", (message) => {
  if (message === "reset") {
    if (cp) cp.kill();
  } else if (message === "spawn") {
    cp = spawn("echo", ["hi"], { stdio: "inherit" });
    cp.on("spawn", () => process.send({ type: "spawn", pid: cp.pid }));
    cp.on("exit", (code, signal) =>
      process.send({ type: "exit", code, signal })
    );
  }
});
