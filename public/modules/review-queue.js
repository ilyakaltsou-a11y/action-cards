(function (root) {
  const engine = root.FSRS || (typeof require === "function" ? require("ts-fsrs") : null);
  const scheduler = engine.fsrs({ enable_fuzz: false, request_retention: 0.9 });
  const BATCH_SIZE = 5;
  const NEW_PER_DAY = 5;
  const NEW_REVIEW_GAP = 4;
  const REPEAT_GAPS = [1, 5, 15, 30, 60];
  const fields = ["stability", "difficulty", "elapsed_days", "scheduled_days", "reps", "lapses", "learning_steps", "state"];
  const dayKey = (timestamp) => {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  };
  const learning = (card) => [engine.State.Learning, engine.State.Relearning].includes(card.review?.memory.state);
  const repeating = (card) => card.review?.step != null || learning(card);
  function mixFolders(cards) {
    const groups = new Map();
    for (const card of cards) {
      const key = card.folderPath || "";
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(card);
    }
    const result = [];
    for (let index = 0; result.length < cards.length; index += 1) {
      for (const group of groups.values()) if (group[index]) result.push(group[index]);
    }
    return result;
  }

  function normalize(value) {
    if (value?.version !== 1 || !value.memory) return null;
    const memory = value.memory;
    if (!Number.isFinite(memory.due) || memory.due <= 0 || !fields.every((key) => Number.isFinite(memory[key]) && memory[key] >= 0)
      || ![0, 1, 2, 3].includes(memory.state) || memory.difficulty > 10
      || !Number.isFinite(memory.last_review) || memory.last_review <= 0) return null;
    const step = Number.isInteger(value.step) && value.step >= 0 && value.step < REPEAT_GAPS.length ? value.step : null;
    return {
      version: 1,
      memory: Object.fromEntries(["due", "last_review", ...fields].map((key) => [key, memory[key]])),
      introducedAt: Number.isFinite(value.introducedAt) ? Math.max(0, value.introducedAt) : 0,
      remaining: Math.min(step === null ? (memory.learning_steps ? NEW_REVIEW_GAP : REPEAT_GAPS[0]) : REPEAT_GAPS[step], Math.max(0, Math.floor(value.remaining) || 0)),
      ...(step === null ? {} : { step }),
    };
  }

  function create({ getAllCards, getProfile, now = Date.now }) {
    let scope = "";
    let order = [];
    let pinned = false;
    function deck(pool) {
      const time = now();
      const nextScope = JSON.stringify([getProfile(), pool.map((card) => card.id).sort()]);
      const byId = new Map(pool.map((card) => [card.id, card]));
      // Pin the visible card until it is rated: a clock tick must not replace a revealed answer.
      if (scope !== nextScope) order = [];
      else if (pinned && order.length) return order.map((id) => byId.get(id));
      scope = nextScope;
      const introduced = getAllCards().filter((card) => card.review?.introducedAt && dayKey(card.review.introducedAt) === dayKey(time)).length;
      const allowance = Math.max(0, NEW_PER_DAY - introduced);
      const oldest = (a, b) => (a.lastReviewedAt || 0) - (b.lastReviewedAt || 0);
      const repeats = pool.filter(repeating).sort(oldest);
      const due = pool.filter((card) => !repeating(card) && card.attempts > 0 && (card.nextReviewAt || 0) <= time)
        .sort((a, b) => Number(b.correct < b.attempts) - Number(a.correct < a.attempts) || (a.nextReviewAt || 0) - (b.nextReviewAt || 0));
      const queuedNew = order.map((id) => byId.get(id)).filter((card) => card && !card.attempts);
      const queuedIds = new Set(queuedNew.map((card) => card.id));
      const fresh = mixFolders(pool.filter((card) => !card.attempts && !queuedIds.has(card.id)));
      const ready = [...repeats.filter((card) => !card.review.remaining), ...due, ...[...queuedNew, ...fresh].slice(0, allowance)];
      // Use time only when the selected cards cannot fill the gap, so slow answers do not shorten it.
      if (!ready.length) ready.push(...repeats.filter((card) => card.nextReviewAt <= time));
      order = ready.slice(0, BATCH_SIZE).map((card) => card.id);
      pinned = Boolean(order.length);
      return order.map((id) => byId.get(id));
    }

    function rate(card, known) {
      const time = now();
      const prior = normalize(card.review);
      // Old profiles have totals, not a review history. Bootstrap memory without inventing past answers.
      const memory = prior ? { ...prior.memory, due: new Date(prior.memory.due), last_review: new Date(prior.memory.last_review) } : engine.createEmptyCard(new Date(time));
      const result = scheduler.next(memory, new Date(time), known ? engine.Rating.Good : engine.Rating.Again).card;
      const previousStep = prior?.step ?? (learning(card) && card.correct < card.attempts ? 0 : null);
      const step = !known ? 0 : previousStep !== null && previousStep + 1 < REPEAT_GAPS.length ? previousStep + 1 : null;
      const gap = step !== null ? REPEAT_GAPS[step] : [engine.State.Learning, engine.State.Relearning].includes(result.state) ? NEW_REVIEW_GAP : 0;
      for (const other of getAllCards()) {
        if (other.id !== card.id && other.review?.remaining > 0) {
          other.review.remaining -= 1;
          other.updatedAt = Math.max(time, (other.updatedAt || 0) + 1);
        }
      }
      card.review = {
        version: 1,
        memory: { ...Object.fromEntries(fields.map((key) => [key, result[key]])), due: result.due.getTime(), last_review: result.last_review.getTime() },
        introducedAt: prior?.introducedAt || (!card.attempts ? time : 0),
        remaining: gap,
        ...(step === null ? {} : { step }),
      };
      card.attempts = (card.attempts || 0) + 1;
      card.correct = (card.correct || 0) + Number(known);
      card.level = known ? Math.min(7, (card.level || 0) + 1) : Math.max(0, (card.level || 0) - 2);
      card.nextReviewAt = step === null ? result.due.getTime() : time + Math.min(gap, 10) * 60000;
      card.lastReviewedAt = time;
      card.updatedAt = Math.max(time, (card.updatedAt || 0) + 1);
      pinned = false;
    }

    function pause(pool) {
      const time = now();
      const newWaiting = pool.some((card) => !card.attempts);
      const newMessage = newWaiting ? "Новые карточки — завтра. " : "";
      const next = pool.filter((card) => card.attempts && card.nextReviewAt > time).map((card) => card.nextReviewAt).sort((a, b) => a - b)[0];
      if (next) {
        const minutes = Math.ceil((next - time) / 60000);
        if (minutes < 60) return `Следующее повторение через ${minutes} мин.`;
        const label = minutes < 1440 ? `через ${Math.ceil(minutes / 60)} ч` : new Date(next).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
        return `${newMessage}Следующее повторение: ${label}.`;
      }
      return newWaiting ? "Пять новых карточек на сегодня уже взяты. Продолжим завтра." : "Все повторения на сегодня пройдены.";
    }
    return { deck, rate, pause, reset: () => { scope = ""; order = []; pinned = false; } };
  }
  root.ActionCardsReview = { create, normalize, BATCH_SIZE, NEW_PER_DAY };
  if (typeof module !== "undefined") module.exports = root.ActionCardsReview;
})(globalThis);
