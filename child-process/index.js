import assert from "node:assert";
import http from "node:http";
import { EventEmitter } from "node:events";
import { fork } from "node:child_process";

const newWorker = () => {
  const worker = fork("./child-process/worker.js", {
    execPath: "/home/maxm/.bun/bin/bun",
  });
  const ee = new EventEmitter();
  // Emit messages from the worker to the EventEmitter by id.
  worker.on("message", ([id, msg]) => ee.emit(id, msg));
  return { worker, ee };
};

// Spawn 8 worker threads.
const workers = Array.from({ length: 20 }, newWorker);
const randomWorker = () => workers[Math.floor(Math.random() * workers.length)];

const spawnInWorker = async () => {
  const worker = randomWorker();
  const id = Math.random();
  // Send and wait for our response.
  worker.worker.send([id, "echo", "hi"]);
  return new Promise((resolve) => {
    worker.ee.once(id, (msg) => {
      resolve(msg);
    });
  });
};

http
  .createServer(async (_, res) => {
    let resp = await spawnInWorker();
    assert.equal(resp, "hi\n"); // no cheating!
    res.end(resp);
  })
  .listen(8001);
