import assert from "node:assert";
import http from "node:http";
import net from "node:net";
import { EventEmitter } from "node:events";
import { fork } from "node:child_process";
import fs from "node:fs";

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
  const { stdoutWriter, stdoutReader, stderrWriter, stderrReader, close } =
    await createSocketPair();
  const id = Math.random();
  // Send and wait for our response.
  worker.worker.send([id, "spawn", ["echo", "hi"]], stdoutWriter);

  // worker.worker.send([id, "stderr", undefined], stderrWriter);
  return new Promise((resolve) => {
    // stdoutReader.on("data", (data) => {
    //   console.log("stdout", id, data.toString());
    // });
    stdoutReader.on("close", () => {
      console.log("stdout close");
    });
    worker.ee.on(id, (msg, data) => {
      if (msg == "exit") {
        console.log("exit", id);
      }
    });
  });
};

http
  .createServer(async (_, res) => {
    await spawnInWorker(res);
  })
  .listen(8001)
  .on("listening", () => {
    fetch("http://localhost:8001");
  });
