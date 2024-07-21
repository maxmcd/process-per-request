#![deny(clippy::all)]

use std::os::unix::process::ExitStatusExt;
use std::process::Stdio;

use futures::prelude::*;
use tokio::io::AsyncReadExt;
use tokio::process::Command;

use napi::bindgen_prelude::{Buffer, JsFunction};
use napi::threadsafe_function::{
  ThreadSafeCallContext, ThreadsafeFunction, ThreadsafeFunctionCallMode,
};
use napi::{CallContext, Env, Error, JsObject, Result, Status};

#[macro_use]
extern crate napi_derive;

#[module_exports]
fn init(mut exports: JsObject, _env: Env) -> Result<()> {
  register_js(&mut exports)?;
  Ok(())
}

pub fn register_js(exports: &mut JsObject) -> Result<()> {
  exports.create_named_method("spawn", test_execute_tokio_cmd)?;
  Ok(())
}

#[js_function(5)]
pub fn test_execute_tokio_cmd(ctx: CallContext) -> Result<JsObject> {
  let cmd = ctx.get::<String>(0)?;
  let args = ctx.get::<Vec<String>>(1)?;

  let exit_func = ctx.get::<JsFunction>(2)?;
  let exit_tsfn =
    ctx
      .env
      .create_threadsafe_function(&exit_func, 0, |ctx: ThreadSafeCallContext<Vec<i32>>| {
        Ok(ctx.value)
      })?;
  let stdout_func = ctx.get::<JsFunction>(3)?;
  let stdout_tsfn: ThreadsafeFunction<Vec<Buffer>> = ctx.env.create_threadsafe_function(
    &stdout_func,
    0,
    |ctx: ThreadSafeCallContext<Vec<Buffer>>| Ok(ctx.value),
  )?;
  let stderr_func = ctx.get::<JsFunction>(4)?;
  let stderr_tsfn = ctx.env.create_threadsafe_function(
    &stderr_func,
    0,
    |ctx: ThreadSafeCallContext<Vec<Buffer>>| Ok(ctx.value),
  )?;
  ctx.env.execute_tokio_future(
    cb_tokio_cmd(cmd, args, exit_tsfn, stdout_tsfn, stderr_tsfn).map(|v| {
      v.map_err(|e| {
        Error::new(
          Status::GenericFailure,
          format!("failed to read file, {}", e),
        )
      })
    }),
    |&mut env, data| env.create_uint32(data),
  )
}

async fn cb_tokio_cmd(
  cmd: String,
  args: Vec<String>,
  exit_cb: ThreadsafeFunction<Vec<i32>>,
  stdout_cb: ThreadsafeFunction<Vec<Buffer>>,
  stderr_cb: ThreadsafeFunction<Vec<Buffer>>,
) -> Result<u32> {
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
        Ok(vec![buf[0..size].to_vec().into()]),
        ThreadsafeFunctionCallMode::NonBlocking,
      );
    }
    stdout_cb.call(Ok(vec![]), ThreadsafeFunctionCallMode::NonBlocking);
  });
  let mut stderr = child.stderr.take().unwrap();
  tokio::spawn(async move {
    let mut buf: [u8; 8192] = [0; 8192]; //chunk size (8K, 65536, etc)
    while let Ok(size) = stderr.read(&mut buf[..]).await {
      if size == 0 {
        break;
      }
      stderr_cb.call(
        Ok(vec![buf[0..size].to_vec().into()]),
        ThreadsafeFunctionCallMode::NonBlocking,
      );
    }
    stderr_cb.call(Ok(vec![]), ThreadsafeFunctionCallMode::NonBlocking);
  });
  let child_id = child.id().unwrap();
  tokio::spawn(async move {
    let status = child.wait().await.unwrap();

    exit_cb.call(
      Ok(vec![
        status.code().or(Some(0)).unwrap(),
        status.signal().or(Some(0)).unwrap(),
      ]),
      ThreadsafeFunctionCallMode::NonBlocking,
    );
  });

  Ok(child_id)
}
