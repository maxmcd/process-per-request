import assert from "assert";
import { EventEmitter } from "events";

const WRITE_INDEX = 4;
const READ_INDEX = 8;

export async function* read({ sharedState, sharedBuffer, maxMessageSize }) {
  assert(sharedState);
  assert(sharedBuffer);
  assert(maxMessageSize);

  const state = new Int32Array(sharedState);
  const buffer = Buffer.from(sharedBuffer);
  const bufEnd = buffer.length - maxMessageSize;

  let read = 0;
  while (true) {
    let write = Atomics.load(state, WRITE_INDEX);

    if (read > bufEnd) {
      read = 0;
    }

    while (read === write) {
      const { async, value } = Atomics.waitAsync(state, WRITE_INDEX, write);
      if (async) {
        await value;
      }
      write = Atomics.load(state, WRITE_INDEX);
    }

    if (write < read) {
      write = bufEnd;
    }

    const arr = [];
    while (read < write) {
      const len = buffer.readInt32LE(read);
      arr.push(buffer.toString("utf-8", read + 4, read + 4 + len));
      read += 4 + len;
    }

    Atomics.store(state, READ_INDEX, read);
    Atomics.notify(state, READ_INDEX);

    yield* arr;
  }
}

export class Writer extends EventEmitter {
  constructor({ sharedState, sharedBuffer, maxMessageSize }) {
    assert(sharedState && sharedState.byteLength >= 32);
    assert(sharedBuffer);
    assert(maxMessageSize);

    super();

    this._state = new Int32Array(sharedState);
    this._buffer = Buffer.from(sharedBuffer);
    this._write = 0;
    this._maxMessageSize = maxMessageSize;
    this._bufEnd = this._buffer.length - maxMessageSize;
    this._needDrain = false;
  }

  write(data) {
    let read = Atomics.load(this._state, READ_INDEX);

    while (this._isFull(read)) {
      Atomics.wait(this._state, READ_INDEX, read);
      read = Atomics.load(this._state, READ_INDEX);
    }

    const written = this._buffer.write(data, this._write + 4);

    this._buffer.writeInt32LE(written, this._write);
    this._write += 4 + written;

    assert(this._write + 1 < this._buffer.length);

    if (this._write > this._bufEnd) {
      this._write = 0;
    }

    Atomics.store(this._state, WRITE_INDEX, this._write);
    Atomics.notify(this._state, WRITE_INDEX);

    const needDrain = this._isFull(read);
    if (needDrain && !this._needDrain) {
      this._needDrain = true;
      this._drain();
    }

    return needDrain;
  }

  _isFull(read) {
    return this._write < read && this._write + this._maxMessageSize > read;
  }

  async _drain() {
    let read = Atomics.load(this._state, READ_INDEX);
    while (this._isFull(read)) {
      const { async, value } = Atomics.wait(this._state, READ_INDEX, read);
      if (async) {
        await value;
      }
      read = Atomics.load(this._state, READ_INDEX);
    }
    this._needDrain = false;
    this.emit("drain");
  }
}
