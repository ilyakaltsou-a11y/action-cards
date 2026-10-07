(() => {
  const DAILY_GOAL_OPTIONS = {
    easy: { label: "Легкий", cards: 1 },
    medium: { label: "Средний", cards: 7 },
    hard: { label: "Сложный", cards: 15 },
  };
  const DEFAULT_DAILY_GOAL_MODE = "medium";
  const ACTIVITY_MILESTONES = [14, 30, 180, 365];
  const FREEZE_REVIEW_STEP = 30;

  function isGoalMode(mode) {
    return Object.hasOwn(DAILY_GOAL_OPTIONS, mode);
  }

  function normalizeActivity(activity = {}) {
    const days = {};
    if (activity?.days && typeof activity.days === "object") {
      Object.entries(activity.days).forEach(([date, count]) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
        const cleanCount = Math.max(0, Math.min(999, Number(count) || 0));
        if (cleanCount > 0) days[date] = cleanCount;
      });
    }

    const frozenDays = {};
    if (activity?.frozenDays && typeof activity.frozenDays === "object") {
      Object.entries(activity.frozenDays).forEach(([date, isFrozen]) => {
        if (/^\d{4}-\d{2}-\d{2}$/.test(date) && isFrozen) frozenDays[date] = true;
      });
    }

    return {
      days,
      frozenDays,
      freezes: Math.max(0, Math.min(999, Number(activity?.freezes) || 0)),
      totalReviews: Math.max(0, Number(activity?.totalReviews) || 0),
      goalMode: isGoalMode(activity?.goalMode) ? activity.goalMode : "",
      lastWeeklyFreeze: String(activity?.lastWeeklyFreeze || ""),
      updatedAt: Number.isFinite(activity?.updatedAt) ? activity.updatedAt : 0,
    };
  }

  function mergeActivity(serverActivity = {}, localActivity = {}) {
    const server = normalizeActivity(serverActivity);
    const local = normalizeActivity(localActivity);
    const days = { ...server.days };
    const frozenDays = { ...server.frozenDays, ...local.frozenDays };

    Object.entries(local.days).forEach(([date, count]) => {
      days[date] = Math.max(days[date] || 0, count);
    });

    return {
      days,
      frozenDays,
      freezes: Math.max(server.freezes || 0, local.freezes || 0),
      totalReviews: Math.max(server.totalReviews || 0, local.totalReviews || 0),
      goalMode: local.goalMode || server.goalMode || "",
      lastWeeklyFreeze: [server.lastWeeklyFreeze, local.lastWeeklyFreeze].sort().at(-1) || "",
      updatedAt: Math.max(server.updatedAt || 0, local.updatedAt || 0),
    };
  }

  function activitiesHaveSameSyncState(leftActivity = {}, rightActivity = {}) {
    const normalizeForCompare = (activity) => {
      const normalized = normalizeActivity(activity);
      return {
        days: Object.fromEntries(Object.entries(normalized.days).sort(([left], [right]) => left.localeCompare(right))),
        frozenDays: Object.fromEntries(Object.entries(normalized.frozenDays).sort(([left], [right]) => left.localeCompare(right))),
        freezes: normalized.freezes,
        totalReviews: normalized.totalReviews,
        goalMode: normalized.goalMode,
        lastWeeklyFreeze: normalized.lastWeeklyFreeze,
      };
    };
    return JSON.stringify(normalizeForCompare(leftActivity)) === JSON.stringify(normalizeForCompare(rightActivity));
  }

  function createActivityTracker({ getActivity, setActivity, persist, now = Date.now }) {
    function localDateKey(date = new Date(now())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }

    function dateFromKey(dateKey) {
      const [year, month, day] = dateKey.split("-").map(Number);
      return new Date(year, month - 1, day);
    }

    function shiftDateKey(dateKey, offsetDays) {
      const date = dateFromKey(dateKey);
      date.setDate(date.getDate() + offsetDays);
      return localDateKey(date);
    }

    function weekKey(date = new Date(now())) {
      const start = new Date(date.getFullYear(), 0, 1);
      const dayOffset = Math.floor((date - start) / 86400000);
      return `${date.getFullYear()}-w${String(Math.floor(dayOffset / 7) + 1).padStart(2, "0")}`;
    }

    function selectedGoalMode() {
      return isGoalMode(getActivity()?.goalMode) ? getActivity().goalMode : DEFAULT_DAILY_GOAL_MODE;
    }

    function dailyActivityGoal() {
      return DAILY_GOAL_OPTIONS[selectedGoalMode()].cards;
    }

    function dailyActivityGoalLabel() {
      return DAILY_GOAL_OPTIONS[selectedGoalMode()].label;
    }

    function hasChosenActivityGoal() {
      return isGoalMode(getActivity()?.goalMode);
    }

    function isCompletedActivityDate(dateKey) {
      return (getActivity().days?.[dateKey] || 0) >= dailyActivityGoal();
    }

    function isFrozenActivityDate(dateKey) {
      return Boolean(getActivity().frozenDays?.[dateKey]);
    }

    function completedActivityDates() {
      const dates = new Set();
      Object.entries(getActivity().days || {}).forEach(([date, count]) => {
        if (count >= dailyActivityGoal()) dates.add(date);
      });
      Object.keys(getActivity().frozenDays || {}).forEach((date) => dates.add(date));
      return dates;
    }

    function grantWeeklyFreeze() {
      const currentWeek = weekKey();
      if (getActivity().lastWeeklyFreeze === currentWeek) return false;
      getActivity().lastWeeklyFreeze = currentWeek;
      getActivity().freezes += 1;
      return true;
    }

    function applyAutomaticFreezes() {
      const today = localDateKey();
      const yesterday = shiftDateKey(today, -1);
      const activeDates = [...completedActivityDates()].filter((date) => date < today).sort();
      if (!activeDates.length) return false;

      let changed = false;
      let cursor = shiftDateKey(activeDates.at(-1), 1);
      while (cursor <= yesterday) {
        if (!isCompletedActivityDate(cursor) && !isFrozenActivityDate(cursor)) {
          if (getActivity().freezes <= 0) break;
          getActivity().frozenDays[cursor] = true;
          getActivity().freezes -= 1;
          changed = true;
        }
        cursor = shiftDateKey(cursor, 1);
      }

      return changed;
    }

    function prepareActivity() {
      setActivity(normalizeActivity(getActivity()));
      let changed = false;
      changed = grantWeeklyFreeze() || changed;
      changed = applyAutomaticFreezes() || changed;

      if (changed) {
        getActivity().updatedAt = now();
        persist();
      }
    }

    function calculateActivityStreak() {
      const completed = completedActivityDates();
      const today = localDateKey();
      const yesterday = shiftDateKey(today, -1);
      let cursor = completed.has(today) ? today : completed.has(yesterday) ? yesterday : "";
      let streak = 0;

      while (cursor && completed.has(cursor)) {
        streak += 1;
        cursor = shiftDateKey(cursor, -1);
      }

      return streak;
    }

    function milestoneLabel(days) {
      if (days === 30) return "1 месяц";
      if (days === 180) return "6 месяцев";
      if (days === 365) return "1 год";
      return `${days} дней`;
    }

    function flameLevel(todayCount, todayDone, streak) {
      if (!todayCount && !todayDone) return 0;
      if (todayCount < 3) return 1;
      if (!todayDone) return 2;
      if (streak >= 14) return 5;
      if (streak >= 7) return 4;
      return 3;
    }

    function recordStudyActivity() {
      prepareActivity();
      const today = localDateKey();
      const goal = dailyActivityGoal();
      const previousCount = Number(getActivity().days?.[today]) || 0;
      const wasComplete = hasChosenActivityGoal() && previousCount >= goal;
      const previousStreak = calculateActivityStreak();
      const previousReviewBucket = Math.floor((getActivity().totalReviews || 0) / FREEZE_REVIEW_STEP);

      setActivity(normalizeActivity(getActivity()));
      getActivity().days[today] = previousCount + 1;
      getActivity().totalReviews += 1;
      getActivity().updatedAt = now();

      const isComplete = hasChosenActivityGoal() && getActivity().days[today] >= goal;
      const streak = calculateActivityStreak();
      const reviewBucket = Math.floor(getActivity().totalReviews / FREEZE_REVIEW_STEP);
      const earnedFreezes = Math.max(0, reviewBucket - previousReviewBucket);
      if (earnedFreezes) getActivity().freezes += earnedFreezes;
      const messages = [];

      if (!wasComplete && isComplete) {
        const reachedMilestone = ACTIVITY_MILESTONES.find((days) => previousStreak < days && streak >= days);
        messages.push(reachedMilestone
          ? `Огонек зажегся. Цель достигнута: ${milestoneLabel(reachedMilestone)} подряд.`
          : "Огонек зажегся: день засчитан.");
      }

      if (earnedFreezes) messages.push(`Получена заморозка за ${FREEZE_REVIEW_STEP} карточек.`);
      return messages.join(" ");
    }

    function chooseGoal(mode) {
      if (!isGoalMode(mode)) return false;
      setActivity(normalizeActivity(getActivity()));
      getActivity().goalMode = mode;
      getActivity().updatedAt = now();
      persist();
      return true;
    }

    function summary() {
      prepareActivity();
      const todayCount = getActivity().days[localDateKey()] || 0;
      const goal = dailyActivityGoal();
      const todayDone = hasChosenActivityGoal() && todayCount >= goal;
      const streak = calculateActivityStreak();
      const nextMilestone = ACTIVITY_MILESTONES.find((days) => streak < days) || ACTIVITY_MILESTONES.at(-1);
      return {
        todayCount, goal, todayDone, streak, nextMilestone,
        daysToGoal: Math.max(0, nextMilestone - streak),
        progress: Math.min(100, Math.round((todayCount / goal) * 100)),
        flameLevel: flameLevel(todayCount, todayDone, streak),
        goalLabel: dailyActivityGoalLabel(),
      };
    }

    return { prepare: prepareActivity, recordStudy: recordStudyActivity, hasChosenGoal: hasChosenActivityGoal, chooseGoal, summary, milestoneLabel };

  }

  globalThis.ActionCardsActivity = Object.freeze({ normalizeActivity, mergeActivity, activitiesHaveSameSyncState, createActivityTracker });
})();
