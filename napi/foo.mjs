import http from "node:http";

import { spawn } from "./index.js";

// let foo = await testExecuteTokioCmd((ids, ...values) => {
//   console.log("callback");
//   console.log(values);
// });
// console.log("foo", foo);

http
  .createServer(async (_, res) => {
    await spawn(
      "bash",
      ["-c", "kill -9 $$"],
      (ids, code, signal) => {
        console.log("exit code", code, signal);
      },
      (ids, buf) => {
        buf ? res.write(buf) : res.end();
      },
      (ids, buf) => {
        console.log("stderr buff", buf);
      }
    );
  })
  .listen(8001)
  .on("listening", async () => {
    let resp = await fetch("http://localhost:8001");
    console.log(await resp.text());
  });

export {};
