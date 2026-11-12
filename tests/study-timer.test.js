const assert = require("node:assert/strict");
const { test } = require("node:test");
const { createClock } = require("../public/modules/study-timer.js");
const { normalizeAnswer } = require("../public/modules/study-session.js");

test("study answers ignore punctuation, case and spacing, but preserve words and word order", () => {
  assert.equal(normalizeAnswer("  DON'T wait!\nCome here.  "), normalizeAnswer("don’t wait come HERE"));
  assert.equal(normalizeAnswer("Well-known, really?"), normalizeAnswer("well known really"));
  assert.notEqual(normalizeAnswer("I will go"), normalizeAnswer("I go"));
  assert.notEqual(normalizeAnswer("I am here"), normalizeAnswer("I here am"));
  assert.notEqual(normalizeAnswer("I like it"), normalizeAnswer("I lik it"));
});

test("inactivity warning can be canceled; delayed ticks stop at the inactivity deadline", () => {
  let now = 0;
  const clock = createClock(() => now);
  clock.start(30);
  now = 60000;
  assert.equal(clock.snapshot().warning, 5);
  now = 64000;
  assert.equal(clock.snapshot().warning, 1);
  clock.activity();
  assert.equal(clock.snapshot().warning, 0);
  now = 600000;
  assert.deepEqual(clock.snapshot(), { status: "paused", remaining: 1800000 - 129000, warning: 0 });
  clock.resume();
  now += 1000;
  assert.equal(clock.snapshot().remaining, 1800000 - 130000);
  clock.pause();
  now += 120000;
  assert.equal(clock.snapshot().remaining, 1800000 - 130000);
});

test("the selected duration expires without negative time when study remains active", () => {
  let now = 0;
  const clock = createClock(() => now);
  clock.start(15);
  for (now = 30000; now < 900000; now += 30000) clock.activity();
  assert.deepEqual(clock.snapshot(), { status: "done", remaining: 0, warning: 0 });
  clock.resume();
  assert.equal(clock.snapshot().status, "done");
  clock.start(60);
  assert.equal(clock.snapshot().remaining, 3600000);
  clock.reset();
  assert.equal(clock.snapshot().status, "off");
});
