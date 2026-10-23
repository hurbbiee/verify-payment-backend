const { test } = require("node:test");
const assert = require("node:assert/strict");
const { matches } = require("../src/routes/telegram.routes");
test("webhook secret requires an exact non-empty match", () => {
  assert.equal(matches("secret", "secret"), true);
  assert.equal(matches("wrong", "secret"), false);
  assert.equal(matches(undefined, "secret"), false);
  assert.equal(matches("", ""), false);
});
