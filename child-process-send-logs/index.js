import http from "node:http";
import { EventEmitter } from "node:events";
import { fork } from "node:child_process";

const newWorker = () => {
  const worker = fork("./child-process-send-logs/worker.js", {
    serialization: "advanced",
  });
  const ee = new EventEmitter();
  // Emit messages from the worker to the EventEmitter by id.
  worker.on("message", ([id, ...msg]) => ee.emit(id, msg));
  return { worker, ee };
};

// Spawn 8 worker threads.
const workers = Array.from({ length: 8 }, newWorker);
const randomWorker = () => workers[Math.floor(Math.random() * workers.length)];

const spawnInWorker = async (res) => {
  const worker = randomWorker();
  const id = Math.random();
  // Send and wait for our response.
  worker.worker.send([id, "cat", "main.c"]);
  worker.ee.on(id, ([e, data]) => {
    if (e === "stdout") res.write(data);
    if (e === "stderr") res.write(data);
    if (e === "exit") res.end();
  });
};

http.createServer(async (_, res) => spawnInWorker(res)).listen(8001);
