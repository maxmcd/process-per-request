import { Pool } from "lightning-pool";

const factory = {
  create: async function (opts) {
    return {
      id: Math.random(),
    };
  },
  destroy: async function ({ id }) {
    console.log(`destroyed ${id}`);
  },
};

const pool = new Pool(factory, { max: 8, min: 8 });

let swimmer = await pool.acquire();

await pool.destroyAsync(swimmer);
await pool.destroyAsync({ id: "foo" });
