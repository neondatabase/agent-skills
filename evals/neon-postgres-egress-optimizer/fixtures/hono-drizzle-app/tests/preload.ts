import { beforeAll, afterAll } from "bun:test";
import { provisionDatabase, seed, cleanup } from "./setup";

beforeAll(async () => {
  await provisionDatabase();
  await seed();
}, 60_000);

afterAll(async () => {
  await cleanup();
});
