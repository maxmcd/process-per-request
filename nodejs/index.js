import { spawn, fork } from "node:child_process";
import http from "node:http";
import { EventEmitter } from "node:events";
import assert from "node:assert/strict";
import { Pool } from "lightning-pool";
import { Writable, PassThrough } from "node:stream";

class StdioPassthrough {
  constructor(child) {
    this.child = child;
    this.stdout = new PassThrough();
    this.stderr = new PassThrough();

    this.child.stdout.pipe(this.stdout, { end: false });
    this.child.stderr.pipe(this.stderr, { end: false });

    this.child.on("close", () => {
      this.stdout.end();
      this.stderr.end();
    });
  }

  reset() {
    // Create new PassThrough streams
    const newStdout = new PassThrough();
    const newStderr = new PassThrough();

    // Unpipe the old streams and pipe to the new streams
    this.child.stdout.unpipe(this.stdout);
    this.child.stderr.unpipe(this.stderr);

    this.child.stdout.pipe(newStdout, { end: false });
    this.child.stderr.pipe(newStderr, { end: false });

    // End the old streams
    this.stdout.end();
    this.stderr.end();

    // Replace the old streams with the new ones
    this.stdout = newStdout;
    this.stderr = newStderr;
  }

  getStdout() {
    return this.stdout;
  }

  getStderr() {
    return this.stderr;
  }
}

class Swimmer extends EventEmitter {
  constructor() {
    super();
    this.subscribedPromises = {};
    this.idle = true;
    this.child = fork("./worker.js", {
      // execPath: "/home/maxm/.bun/bin/bun",
      stdio: "pipe",
    });
    this.stdio = new StdioPassthrough(this.child);
    this.child.on("message", (message) => {
      if (message.type === "exit") {
        this.idle = true;
        this.emit("exit", { code: message.code, signal: message.signal });
        this.stdio.stderr.end();
        this.stdio.stdout.end();
      }
      if (message.type === "spawn") {
        this.emit("spawn", { pid: message.pid });
        this.idle = false;
      }
    });
  }
  get stdout() {
    return this.stdio.stdout;
  }
  get stderr() {
    return this.stdio.stderr;
  }
  async reset() {
    if (!this.idle) {
      this.child.send("reset");
      console.log("resetting");
      await this.waitFor("exit");
    }
    this.stdio.reset();
    this.removeAllListeners();
    this.idle = true;
  }
  async waitFor(msg) {
    if (msg === "exit" && this.idle) return;
    await new Promise((resolve) => this.once(msg, resolve));
  }
  async spawn() {
    this.child.send("spawn");
    return await this.waitFor("spawn");
  }
}

const factory = {
  create: async function (opts) {
    console.log("fac:create:call");
    const swimmer = new Swimmer();
    await new Promise((resolve) => swimmer.child.once("spawn", resolve));
    console.log("fac:create:complete");
    return swimmer;
  },
  destroy: async function (swimmer) {},
  reset: async function (swimmer) {
    console.log("fac:reset:call");
    await swimmer.reset();
    console.log("fac:reset:complete");
  },
};

const pool = new Pool(factory, {
  max: 8, // maximum size of the pool
  min: 8, // minimum size of the pool
  // minIdle: 8, // minimum idle resources
});

http
  .createServer(async (req, res) => {
    const swimmer = await pool.acquire();
    swimmer.stdout.pipe(res).on("close", () => {
      pool.release(swimmer);
    });
    await swimmer.spawn();
  })
  .listen(8001);

// import { read, Writer } from "./streams.js";
// import { Worker } from "node:worker_threads";
// const MAX_LEN = 8 * 1024;
// const BUF_END = 256 * MAX_LEN;
// const BUF_LEN = BUF_END + MAX_LEN;

// const sharedBuffer = new SharedArrayBuffer(BUF_LEN);
// const sharedState = new SharedArrayBuffer(128);

// const writer = new Writer({
//   sharedState,
//   sharedBuffer,
//   maxMessageSize: MAX_LEN,
// });

// const worker = new Worker("./worker.js", {
//   workerData: { sharedState, sharedBuffer, maxMessageSize: MAX_LEN },
// });

// worker.on("message", async (message) => {
//   console.log("message");
//   const t0 = performance.now();
//   for (let i = 0; i < 10000; i++) {
//     assert.equal(
//       (
//         await read({
//           sharedState,
//           sharedBuffer,
//           maxMessageSize: MAX_LEN,
//         }).next()
//       ).value,
//       "Hello, World!"
//     );
//   }
//   console.log(performance.now() - t0);
// });
// worker.on("online", async () => {
//   console.log("ok");
// });

// import { ProcessPool } from "child-process-worker-pool";

// const pool = new ProcessPool();

// //create a server object:

// import { spawn } from "node:child_process";
// import http from "node:http";
// import cluster from "node:cluster";
// import { availableParallelism } from "node:os";

// if (cluster.isPrimary) {
//   for (let i = 0; i < availableParallelism(); i++) cluster.fork();
// } else {
//   http
//     .createServer((req, res) => spawn("echo", ["hi"]).stdout.pipe(res))
//     .listen(8001);
// }

// import { spawn } from "node:child_process";
// import http from "node:http";
// import { ProcessPool } from "child-process-worker-pool";

// const pool = new ProcessPool();

// http
//   .createServer((req, res) => {
//     const cp = pool.spawn("echo", ["hi"]);
//     cp.on("exit", () => {
//       res.write("hi");
//       res.end();
//     });
//   })
//   .listen(8001);
