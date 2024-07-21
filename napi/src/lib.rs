#![deny(clippy::all)]

use std::os::unix::process::ExitStatusExt;
use std::process::Stdio;

use tokio::io::AsyncReadExt;
use tokio::process::Command;

use napi::bindgen_prelude::Buffer;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi::{Env, JsObject, Result};

#[macro_use]
extern crate napi_derive;

#[napi(ts_return_type = "Promise<number>")]
pub fn op_spawn(
  env: Env,
  cmd: String,
  args: Vec<String>,
  exit_cb: ThreadsafeFunction<(i32, i32)>,
  stdout_cb: ThreadsafeFunction<Option<Buffer>>,
  stderr_cb: ThreadsafeFunction<Option<Buffer>>,
) -> Result<JsObject> {
  env.spawn_future(async move {
    let mut child = Command::new(cmd)
      .args(args)
      .stdout(Stdio::piped())
      .stderr(Stdio::piped())
      .spawn()?;

    let mut stdout = child.stdout.take().unwrap();
    tokio::spawn(async move {
      let mut buf: [u8; 8192] = [0; 8192]; //chunk size (8K, 65536, etc)
      while let Ok(size) = stdout.read(&mut buf[..]).await {
        if size == 0 {
          break;
        }
        stdout_cb.call(
          Ok(Some(buf[0..size].to_vec().into())),
          ThreadsafeFunctionCallMode::NonBlocking,
        );
      }
      stdout_cb.call(Ok(None), ThreadsafeFunctionCallMode::NonBlocking);
    });
    let mut stderr = child.stderr.take().unwrap();
    tokio::spawn(async move {
      let mut buf: [u8; 8192] = [0; 8192]; //chunk size (8K, 65536, etc)
      while let Ok(size) = stderr.read(&mut buf[..]).await {
        if size == 0 {
          break;
        }
        stderr_cb.call(
          Ok(Some(buf[0..size].to_vec().into())),
          ThreadsafeFunctionCallMode::NonBlocking,
        );
      }
      stderr_cb.call(Ok(None), ThreadsafeFunctionCallMode::NonBlocking);
    });
    let child_id = child.id().unwrap();
    tokio::spawn(async move {
      let status = child.wait().await.unwrap();
      exit_cb.call(
        Ok((
          status.code().or(Some(0)).unwrap(),
          status.signal().or(Some(0)).unwrap(),
        )),
        ThreadsafeFunctionCallMode::NonBlocking,
      );
    });

    Ok(child_id)
  })
}
