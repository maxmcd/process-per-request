import { spawn } from "node:child_process";
import http from "node:http";
import cluster from "node:cluster";
import { availableParallelism } from "node:os";

if (cluster.isPrimary) {
  for (let i = 0; i < availableParallelism(); i++) cluster.fork();
} else {
  http
    .createServer((req, res) => spawn("echo", ["hi"]).stdout.pipe(res))
    .listen(8001);
}
