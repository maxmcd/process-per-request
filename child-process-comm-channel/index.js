import http from "node:http";
import net from "node:net";
import { EventEmitter } from "node:events";
import { fork } from "node:child_process";
import assert from "node:assert";
import { Buffer } from "node:buffer";

const randomI32 = () => Math.floor(Math.random() * Math.pow(2, 31));

const MessageType = {
  STDOUT: 1,
  STDERR: 2,
  STDOUT_CLOSE: 3,
  STDERR_CLOSE: 4,
};

const readByteStreams = (conn, ee) => {
  let buffer = Buffer.alloc(0);
  conn.on("data", (data) => {
    buffer = Buffer.concat([buffer, data]);
    // Minimum size for header
    while (buffer.length >= 5) {
      const id = buffer.readInt32LE(0);
      const type = buffer.readInt8(4);

      if (type > MessageType.STDERR) {
        if (buffer.length >= 5) {
          ee.emit(id, type);
          buffer = buffer.subarray(5);
        } else {
          break; // Not enough data, wait for more
        }
      } else {
        if (buffer.length >= 9) {
          // Header + length field
          const length = buffer.readInt32LE(5);
          if (buffer.length >= 9 + length) {
            const payload = buffer.subarray(9, 9 + length);
            ee.emit(id, type, payload);
            buffer = buffer.subarray(9 + length);
          } else {
            break; // Not enough data for full message, wait for more
          }
        } else {
          break; // Not enough data for length field, wait for more
        }
      }
    }
  });
};

const newWorker = async () => {
  const pipeName = `${randomI32()}`;
  const ee = new EventEmitter();
  let child;
  return await new Promise((resolve, reject) => {
    const server = net.createServer((conn) => {
      readByteStreams(conn, ee);
      resolve({ conn, child, ee, requests: 0 });
    });
    server.listen(`\0${pipeName}`, () => {
      child = fork("./child-process-comm-channel/worker.js", [pipeName], {
        stdio: "inherit",
        // execPath: "/home/maxm/.bun/bin/bun",
      });
      child.on("exit", (code) => server.close());
      child.on("error", (error) => reject);
      child.on("message", ([id, msg, data]) => ee.emit(id, msg, data));
    });
  });
};

// Spawn 8 worker threads.
const workers = await Promise.all(Array.from({ length: 8 }, newWorker));
let count = 0;
const pickWorkerInOrder = () => workers[(count += 1) % workers.length];
const randomWorker = () => workers[Math.floor(Math.random() * workers.length)];
const pickWorkerWithLeastRequests = () =>
  workers.reduce((selectedWorker, worker) =>
    worker.requests < selectedWorker.requests ? worker : selectedWorker
  );

const spawnInWorker = async (res) => {
  const worker = randomWorker();
  worker.requests += 1;
  const id = randomI32();

  worker.child.send([id, "spawn", ["cat", ["main.c"]]]);
  let resp = "";
  worker.ee.on(id, (msg, data) => {
    if (msg == MessageType.STDOUT) {
      resp += data.toString();
    }
    if (msg == MessageType.STDOUT_CLOSE) {
      res.end(resp);
      worker.requests -= 1;
      worker.ee.removeAllListeners(id);
    }
  });
};

http
  .createServer(async (_, res) => spawnInWorker(res))
  .listen(8001)
  .on("listening", async () => {
    await fetch("http://localhost:8001");
  });
