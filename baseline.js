import { spawn } from "node:child_process";
import http from "node:http";
http
  .createServer((_, res) =>
    spawn("/bin/echo", ["hi"], { env: {} }).stdout.pipe(res)
  )
  .listen(8001);
