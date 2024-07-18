import assert from "node:assert";
import http from "node:http";
import net from "node:net";
import { EventEmitter } from "node:events";
import { fork } from "node:child_process";
import fs from "node:fs";
import { resolve } from "node:path";

const createSocketPair = async () => {
  const pipeName = `\0\\${Math.random()}`;
  const { serverConn, clientConn, server } = await new Promise((resolve) => {
    let clientConn;
    const server = net.createServer((serverConn) => {
      resolve({ serverConn, clientConn, server });
    });
    server.listen(pipeName, () => {
      clientConn = net.createConnection(pipeName, () => {});
    });
  });
  return {
    stdoutWriter: serverConn,
    stdoutReader: clientConn,
    stderrWriter: clientConn,
    stderrReader: serverConn,
    close: () => {
      clientConn.destroy();
      serverConn.destroy();
      server.close();
    },
  };
};

const newWorker = () => {
  const worker = fork("./child-process-handle/worker.js", {
    stdio: "inherit",
    // execPath: "/home/maxm/.bun/bin/bun",
  });
  const ee = new EventEmitter();
  // Emit messages from the worker to the EventEmitter by id.
  worker.on("message", ([id, msg, data]) => {
    ee.emit(id, msg, data);
  });
  return { worker, ee };
};

// Spawn 8 worker threads.
const workers = Array.from({ length: 20 }, newWorker);
const randomWorker = () => workers[Math.floor(Math.random() * workers.length)];

const spawnInWorker = async (res) => {
  const worker = randomWorker();
  const id = Math.random();
  const pipeName = `\0\\${id}`;

  let { conn, close } = await new Promise((resolve) => {
    const server = net.createServer((conn) => {
      resolve({
        conn,
        close: () => {
          server.close();
        },
      });
    });
    server.listen(pipeName, () => {
      // Send and wait for our response.
      worker.worker.send([id, "spawn", ["echo", "hi"]]);
    });
  });

  // worker.worker.send([id, "stderr", undefined], stderrWriter);
  return new Promise((resolve) => {
    // stdoutReader.on("data", (data) => {
    //   console.log("stdout", id, data.toString());
    // });
    worker.ee.on(id, (msg, data) => {
      if (msg == "exit") {
        conn.pipe(res).on("end", () => {
          close();
          resolve("hi\n");
        });
      }
    });
  });
};

http
  .createServer(async (_, res) => {
    let resp = await spawnInWorker(res);
    // assert.equal(resp, "hi\n"); // no cheating!
    // res.end(resp);
  })
  .listen(8001);
