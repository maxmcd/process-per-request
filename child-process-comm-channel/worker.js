import { spawn } from "node:child_process";
import process from "node:process";
import net from "node:net";
import { Buffer } from "node:buffer";

const pipeName = `\0${process.argv[2]}`;
let clientConn = await new Promise((resolve, reject) => {
  let cc = net
    .createConnection(pipeName, () => resolve(cc))
    .on("error", reject);
});

const MessageType = {
  STDOUT: Buffer.from([1]),
  STDERR: Buffer.from([2]),
  STDOUT_CLOSE: Buffer.from([3]),
  STDERR_CLOSE: Buffer.from([4]),
};

process.on("message", (message, handle) => {
  const [id, type, data] = message;
  if (type == "spawn") {
    const [cmd, ...args] = data;
    let child = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    child.stdout.on("data", (data) =>
      clientConn.write(
        Buffer.concat([
          i32Bytes(id),
          MessageType.STDOUT,
          i32Bytes(data.length),
          data,
        ])
      )
    );
    child.stdout.on("close", (data) =>
      clientConn.write(Buffer.concat([i32Bytes(id), MessageType.STDOUT_CLOSE]))
    );
    child.stderr.on("data", (data) =>
      clientConn.write(
        Buffer.concat([
          i32Bytes(id),
          MessageType.STDERR,
          i32Bytes(data.length),
          data,
        ])
      )
    );
    child.stderr.on("close", (data) =>
      clientConn.write(Buffer.concat([i32Bytes(id), MessageType.STDOUT_CLOSE]))
    );
    child.on("error", (error) => console.log("error", error));
    child.on("exit", (code) => {
      process.send([id, "exit"]);
    });
  }
});

const i32Bytes = (i) => {
  const bytes = Buffer.alloc(4);
  bytes.writeInt32LE(i, 0);
  return bytes;
};
