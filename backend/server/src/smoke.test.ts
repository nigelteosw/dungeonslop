import { expect, test } from "bun:test";
import { VERSION } from "shared";

test("server imports shared", () => {
  expect(VERSION).toBe("0.1.0-ship");
});
