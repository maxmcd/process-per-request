import assert from "node:assert";
import http from "node:http";
import net from "node:net";
import { EventEmitter } from "node:events";
import { fork } from "node:child_process";
import fs from "node:fs";

const newWorker = () => {
  const worker = fork("./stdio/cmd-handle/worker.js", {
    stdio: "inherit",
    // execPath: "/home/maxm/.bun/bin/bun",
  });
  const ee = new EventEmitter();
  // Emit messages from the worker to the EventEmitter by id.
  worker.on("message", ([id, msg, data], handle) => {
    ee.emit(id, msg, data, handle);
  });
  return { worker, ee };
};

// Spawn 8 worker threads.
const workers = Array.from({ length: 8 }, newWorker);
const randomWorker = () => workers[Math.floor(Math.random() * workers.length)];

const spawnInWorker = async () => {
  const worker = randomWorker();
  const id = Math.random();
  worker.worker.send([id, "spawn", ["echo", "hi"]]);

  return new Promise((resolve) => {
    // stdoutReader.on("data", (data) => {
    //   console.log("stdout", id, data.toString());
    // });
    worker.ee.on(id, (msg, data, handle) => {
      console.log("msg", msg, data, handle);
      resolve("hi\n");
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
