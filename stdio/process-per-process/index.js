import { PassThrough } from "node:stream";
import http from "node:http";
import { fork } from "node:child_process";
import { EventEmitter } from "node:events";
import { Pool } from "lightning-pool";

// We wrap the stout/stderr streams so that we can reset them between different
// spawn runs.
class StdioPassthrough {
  constructor(stdout, stderr) {
    this.stdout = new PassThrough();
    this.stderr = new PassThrough();
    stdout.pipe(this.stdout, { end: false });
    stderr.pipe(this.stderr, { end: false });
    this.reset = () => {
      const newStdout = new PassThrough();
      const newStderr = new PassThrough();
      stdout.unpipe(this.stdout);
      stderr.unpipe(this.stderr);
      stdout.pipe(newStdout, { end: false });
      stderr.pipe(newStderr, { end: false });
      this.stdout.end();
      this.stderr.end();
      this.stdout = newStdout;
      this.stderr = newStderr;
    };
  }
}

const factory = {
  create: async function (opts) {
    const cp = fork("./stdio/process-per-process/worker.js", {
      stdio: "pipe",
      execPath: "/home/maxm/.bun/bin/bun",
    });
    const ee = new EventEmitter();
    cp.on("message", ([type, msg]) => ee.emit(type, msg));
    const stdio = new StdioPassthrough(cp.stdout, cp.stderr);
    return { cp, ee, stdio };
  },
  destroy: async function ({ cp, stdio }) {
    stdio.stdout.end();
    stdio.stderr.end();
    cp.kill();
  },
  reset: async function ({ cp, ee, stdio }) {
    ee.removeAllListeners();
    stdio.reset();
  },
};

const pool = new Pool(factory, { max: 8, min: 8 });

http
  .createServer(async (_, res) => {
    const swimmer = await pool.acquire();
    swimmer.cp.send(["echo", "hi"]);
    // await new Promise((resolve) => swimmer.ee.once("exit", resolve));
    await new Promise((resolve) => {
      let count = 0;
      swimmer.stdio.stdout.on("data", (data) => {
        count += data.length;
        res.write(data);
        if (count >= 3) {
          res.end();
          resolve();
        }
      });
    });

    pool.release(swimmer);
  })
  .listen(8001);
