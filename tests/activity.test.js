const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

const sandbox = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../public/modules/activity.js"), "utf8"), sandbox);
const { normalizeActivity, mergeActivity, activitiesHaveSameSyncState, createActivityTracker } = sandbox.ActionCardsActivity;
const plain = (value) => JSON.parse(JSON.stringify(value));

function tracker(initial = {}, date = new Date(2026, 9, 7, 12)) {
  let activity = initial;
  let time = date.getTime();
  let saves = 0;
  const api = createActivityTracker({
    getActivity: () => activity,
    setActivity: (value) => { activity = value; },
    persist: () => { saves += 1; },
    now: () => time,
  });
  return { api, state: () => activity, saves: () => saves, date: (next) => { time = next.getTime(); } };
}

test("activity normalization preserves legacy fields and accepts absent or null date maps", () => {
  for (const value of [undefined, null, {}, { days: null, frozenDays: null }]) {
    const normalized = normalizeActivity(value);
    assert.deepEqual(plain(normalized.days), {});
    assert.deepEqual(plain(normalized.frozenDays), {});
    assert.equal(normalized.goalMode, "");
  }
  const normalized = normalizeActivity({ days: { "2026-10-07": "7", invalid: 8, "2026-10-06": -3 }, frozenDays: { "2026-10-05": true }, freezes: 2, totalReviews: 35, goalMode: "medium", updatedAt: 123 });
  assert.deepEqual(plain(normalized.days), { "2026-10-07": 7 });
  assert.equal(normalized.freezes, 2);
  assert.equal(normalized.totalReviews, 35);
  assert.equal(normalized.updatedAt, 123);
});

test("a fresh activity stays grey and cannot complete a day until a goal is chosen", () => {
  const app = tracker();
  assert.equal(app.api.summary().flameLevel, 0);
  assert.equal(app.api.hasChosenGoal(), false);
  for (let index = 0; index < 7; index += 1) app.api.recordStudy();
  assert.equal(app.api.summary().todayDone, false);
  for (const mode of ["invalid", "toString", "constructor", "__proto__"]) {
    assert.equal(app.api.chooseGoal(mode), false);
    assert.equal(normalizeActivity({ goalMode: mode }).goalMode, "");
  }
});

for (const [mode, goal] of [["easy", 1], ["medium", 7], ["hard", 15]]) {
  test(`${mode}: the flame lights exactly at ${goal} reviewed cards`, () => {
    const app = tracker();
    assert.equal(app.api.chooseGoal(mode), true);
    for (let index = 0; index < goal - 1; index += 1) {
      app.api.recordStudy();
      assert.equal(app.api.summary().todayDone, false);
    }
    assert.match(app.api.recordStudy(), /день засчитан/);
    const summary = app.api.summary();
    assert.equal(summary.goal, goal);
    assert.equal(summary.todayCount, goal);
    assert.equal(summary.todayDone, true);
    assert.equal(summary.progress, 100);
    assert.equal(summary.streak, 1);
    assert.equal(app.api.recordStudy(), "");
  });
}

test("weekly freezes are granted once per week and accumulate", () => {
  const app = tracker();
  app.api.prepare();
  const saves = app.saves();
  assert.equal(app.state().freezes, 1);
  app.api.prepare();
  app.api.summary();
  assert.equal(app.saves(), saves);
  assert.equal(app.state().freezes, 1);
  app.date(new Date(2026, 9, 15, 12));
  app.api.prepare();
  assert.equal(app.state().freezes, 2);
});

test("a missed day automatically consumes one freeze and preserves the streak", () => {
  const app = tracker({ goalMode: "medium", days: { "2026-10-01": 7 } }, new Date(2026, 9, 1, 12));
  app.api.prepare();
  app.date(new Date(2026, 9, 3, 12));
  const summary = app.api.summary();
  assert.equal(app.state().freezes, 0);
  assert.equal(app.state().frozenDays["2026-10-02"], true);
  assert.equal(summary.streak, 2);
  assert.equal(summary.flameLevel, 0);
  assert.equal(summary.todayDone, false);
  app.api.summary();
  assert.equal(app.state().freezes, 0);
});

test("an uncovered gap resets the current streak without deleting activity history", () => {
  const app = tracker({ goalMode: "medium", days: { "2026-10-01": 7 } }, new Date(2026, 9, 1, 12));
  app.api.prepare();
  app.state().freezes = 0;
  app.date(new Date(2026, 9, 4, 12));
  assert.equal(app.api.summary().streak, 0);
  assert.equal(app.state().days["2026-10-01"], 7);
});

test("every 30 reviews earn one extra freeze, never repeatedly for the same total", () => {
  const app = tracker({ goalMode: "medium", totalReviews: 29 });
  app.api.prepare();
  assert.match(app.api.recordStudy(), /заморозка за 30 карточек/);
  assert.equal(app.state().freezes, 2);
  assert.equal(app.api.recordStudy(), "");
  assert.equal(app.state().freezes, 2);
});

test("the 14-day milestone is awarded once and stronger flame levels follow the streak", () => {
  const days = {};
  for (let day = 1; day <= 13; day += 1) days[`2026-10-${String(day).padStart(2, "0")}`] = 7;
  const app = tracker({ goalMode: "medium", days }, new Date(2026, 9, 14, 12));
  assert.equal(app.api.summary().streak, 13);
  for (let index = 0; index < 6; index += 1) app.api.recordStudy();
  assert.match(app.api.recordStudy(), /14 дней подряд/);
  assert.equal(app.api.summary().flameLevel, 5);
  assert.equal(app.api.summary().nextMilestone, 30);
  assert.equal(app.api.recordStudy(), "");
});

test("changing a goal preserves saved counts and updates the same activity object format", () => {
  const app = tracker({ goalMode: "hard", days: { "2026-10-07": 7 }, totalReviews: 7 });
  assert.equal(app.api.summary().todayDone, false);
  const saves = app.saves();
  app.api.chooseGoal("medium");
  assert.equal(app.saves(), saves + 1);
  assert.equal(app.api.summary().todayDone, true);
  assert.equal(app.state().days["2026-10-07"], 7);
  assert.equal(app.state().totalReviews, 7);
});

test("activity merging and sync comparisons preserve counts and ignore map ordering", () => {
  const server = { days: { "2026-10-01": 7, "2026-10-02": 4 }, goalMode: "hard", totalReviews: 11 };
  const local = { days: { "2026-10-02": 7 }, goalMode: "medium", totalReviews: 14, frozenDays: { "2026-10-03": true } };
  const merged = mergeActivity(server, local);
  assert.deepEqual(plain(merged.days), { "2026-10-01": 7, "2026-10-02": 7 });
  assert.equal(merged.goalMode, "medium");
  assert.equal(merged.totalReviews, 14);
  assert.equal(merged.frozenDays["2026-10-03"], true);
  assert.equal(activitiesHaveSameSyncState(merged, { ...merged, days: { "2026-10-02": 7, "2026-10-01": 7 }, updatedAt: 999 }), true);
  assert.deepEqual(server.days, { "2026-10-01": 7, "2026-10-02": 4 });
});
