import http from "node:http";
import net from "node:net";
import { EventEmitter } from "node:events";
import { fork } from "node:child_process";

const newWorker = () => {
  const worker = fork("./child-process-dial/worker.js", {
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
    conn.pipe(res);
    conn.on("close", () => {
      console.log("con close");
    });
    worker.ee.on(id, (msg, data) => {
      console.log(msg, data);
      if (msg == "exit") {
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
  .listen(8001)
  .on("listening", async () => {
    await fetch("http://localhost:8001");
  });
