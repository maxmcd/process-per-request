import http from "node:http";

import { opSpawn } from "./index.js";

// let foo = await testExecuteTokioCmd((ids, ...values) => {
//   console.log("callback");
//   console.log(values);
// });
// console.log("foo", foo);

http
  .createServer(async (_, res) => {
    const t0 = performance.now();
    let pid = await opSpawn(
      // "bash",
      // ["-c", "kill -9 $$"],
      // "cat",
      // ["../main.c"],
      "echo",
      ["hi"],
      (error, code, signal) => {
        // console.log("exit code", code, signal);
      },
      (error, buf) => {
        buf ? res.write(buf) : res.end();
      },
      (error, buf) => {
        // console.log("stderr buff", buf);
      }
    );
    console.log(pid, "pid", performance.now() - t0);
  })
  .listen(8001)
  .on("listening", async () => {
    let resp = await fetch("http://localhost:8001");
    console.log(await resp.text());
  });

export {};
