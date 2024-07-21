import test from "ava";

import { testExecuteTokioCmd, testExecuteTokioReadfile } from "../index.js";

test("sum from native", async (t) => {
  let result = await testExecuteTokioReadfile("./rustfmt.toml");
  t.assert(result);
});

test("cmd", async (t) => {
  let result = await testExecuteTokioCmd("./rustfmt.toml");
  console.log(result.toString());
  t.assert(result);
});
