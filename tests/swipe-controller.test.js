const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");
const { parseHTML } = require("linkedom");

function controller() {
  const { window, document } = parseHTML('<button id="card"><span>Card</span></button>');
  const element = document.getElementById("card");
  const sandbox = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname, "../public/modules/swipe.js"), "utf8"), sandbox);
  let pointerId = null;
  let time = 1000;
  let hasCard = true;
  const ratings = [];
  element.setPointerCapture = (id) => { pointerId = id; };
  element.hasPointerCapture = (id) => pointerId === id;
  element.releasePointerCapture = () => { pointerId = null; };
  const api = sandbox.ActionCardsSwipe.createSwipeController({
    element, eventTarget: window, hasCard: () => hasCard,
    onRate: (known) => ratings.push(known), now: () => time,
  });
  function pointer(type, x, y = 100) {
    const event = new window.Event(type, { bubbles: true, cancelable: true });
    Object.assign(event, { pointerId: 1, pointerType: "mouse", button: 0, isPrimary: true, clientX: x, clientY: y });
    (type === "pointermove" ? window : element).dispatchEvent(event);
    return event;
  }
  return { api, element, pointer, ratings, advance: (milliseconds) => { time += milliseconds; }, setHasCard: (value) => { hasCard = value; } };
}

test("swipe attachment is idempotent, and disposal removes handlers and releases capture", () => {
  const app = controller();
  app.api.attach();
  app.api.attach();
  app.pointer("pointerdown", 100);
  app.pointer("pointermove", 220);
  assert.equal(app.element.hasPointerCapture(1), true);
  app.api.dispose();
  assert.equal(app.element.hasPointerCapture(1), false);
  assert.equal(app.api.gesture, null);
  assert.equal(app.element.style.transform, "");
  app.pointer("pointerup", 220);
  app.pointer("pointerdown", 100);
  app.pointer("pointermove", 220);
  app.pointer("pointerup", 220);
  assert.deepEqual(app.ratings, []);
  app.api.attach();
  app.pointer("pointerdown", 100);
  app.pointer("pointermove", 220);
  app.pointer("pointerup", 220);
  assert.deepEqual(app.ratings, [true]);
  app.api.dispose();
});

test("gesture snapshots cannot mutate the controller and the click guard expires", () => {
  const app = controller();
  app.api.attach();
  app.pointer("pointerdown", 200);
  const snapshot = app.api.gesture;
  snapshot.startX = -500;
  assert.equal(app.api.gesture.startX, 200);
  app.pointer("pointermove", 80, 300);
  app.pointer("pointerup", 80, 300);
  assert.deepEqual(app.ratings, [false]);
  assert.equal(app.api.canFlip(), false);
  app.advance(450);
  assert.equal(app.api.canFlip(), true);
  app.api.dispose();
});

test("empty decks ignore gestures and cancelling a drag never rates a card", () => {
  const app = controller();
  app.api.attach();
  app.setHasCard(false);
  app.pointer("pointerdown", 100);
  assert.equal(app.api.gesture, null);
  app.setHasCard(true);
  app.pointer("pointerdown", 100);
  app.pointer("pointermove", 220);
  app.api.cancel();
  app.pointer("pointerup", 220);
  assert.equal(app.api.gesture, null);
  assert.deepEqual(app.ratings, []);
  app.api.dispose();
});
