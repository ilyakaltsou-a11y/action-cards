(function (root) {
  const MAX_LINES = 50;
  const key = (value) => String(value || "").toLowerCase().replace(/[’`´]/g, "'")
    .replace(/[^a-z0-9а-яё]+/gi, " ").trim().replace(/\s+/g, " ");

  // These object-independent keys cover the starter actions. Unknown phrases stay distinct.
  function actionKey(phrase) {
    const text = key(phrase).replace(/^be careful\s+/, "");
    const rules = [
      ["hold-by-handle", /^hold\b.*\bby (?:the |its )?handle\b/],
      ["keep-steady", /^keep\b.*\b(?:steady|still|motionless)\b/],
      ["keep-upright", /^keep\b.*\bupright\b/],
      ["prevent-spill", /^(?:don t|do not) spill\b/],
      ["prevent-drop", /^(?:don t|do not) drop\b/],
      ["pick-up", /^pick up\b/],
      ["lift-up", /^lift\b/],
      ["put-down", /^(?:put|set)\b.*\bdown\b/],
      ["put-in", /^put\b.*\bin(?:to)?\b/],
      ["take-out", /^take\b.*\bout\b/],
      ["turn-upside-down", /^turn\b.*\bupside down\b/],
      ["turn-around", /^turn\b.*\baround\b/],
      ["move-aside", /^move\b.*\baside\b/],
      ["move-over", /^move\b.*\bover here\b/],
      ["move-farther-away", /^move\b.*\b(?:farther|further) away\b/],
      ["bring-to-lips", /^bring\b.*\bto (?:your |the )?lips\b/],
      ["bring-closer", /^bring\b.*\bcloser\b/],
      ["give", /^give\b(?!.*\b(?:shake|up|in|away)\b)/],
      ["shake", /^(?:shake\b|give\b.*\bshake\b)/],
      ["lower", /^lower\b/],
      ["tilt", /^tilt\b/],
      ["carry", /^carry\b(?!\s+out\b)/],
      ["look-at", /^look at\b/],
      ["check-clean", /^check\b.*\bclean\b/],
      ["pour-in", /^pour\b.*\bin(?:to)?\b/],
      ["add", /^add\b(?!\s+up\b)/],
      ["stir", /^stir\b/],
      ["take-sip", /^take\b.*\bsip\b/],
      ["hot-warning", /^(?:be careful\b.*|it s|it is)\b.*\bhot\b/],
      ["drink", /^drink\b/],
      ["finish-drink", /^finish\b.*\bdrink\b/],
      ["wash", /^wash\b(?!\s+(?:away|down|out|off)\b)/],
      ["leave-up", /^leave\b.*\bup\b/],
      ["leave", /^leave\b.*\b(?:there|here|on|in)\b/],
    ];
    return rules.find(([, pattern]) => pattern.test(text))?.[0] || "";
  }

  function parse(text) {
    const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    if (!lines.length) throw new Error("Вставьте слова или фразы.");
    if (lines.length > MAX_LINES) throw new Error(`За один раз можно добавить до ${MAX_LINES} строк.`);
    return lines.map((line, index) => {
      const clean = line.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, "").replace(/\*\*/g, "");
      const parts = clean.split(/\s+[—–-]\s+|\t+/);
      const phrase = parts.shift().trim();
      const translation = parts.join(" — ").trim();
      if (!/[a-z]/i.test(phrase) || /[а-яё]/i.test(phrase) || phrase.length > 400 || translation.length > 400) {
        throw new Error(`Проверьте английскую фразу в строке ${index + 1}.`);
      }
      const action = actionKey(phrase), words = phrase.split(/\s+/).length;
      const isExpression = !/[.!?]$/.test(phrase) && words <= 3 && (!action || words <= 2);
      return { index, phrase, translation, actionKey: action, isExpression };
    });
  }

  function deduplicate(cards, existing = []) {
    const phrases = new Map();
    const actions = new Map();
    const remember = (card) => {
      phrases.set(key(card.phrase), card.phrase);
      const action = card.actionKey || actionKey(card.phrase);
      if (action && !actions.has(action)) actions.set(action, card.phrase);
    };
    existing.forEach(remember);
    const unique = [], skipped = [];
    for (const card of cards) {
      const action = card.actionKey || actionKey(card.phrase);
      const duplicateOf = phrases.get(key(card.phrase)) || (action && actions.get(action));
      if (duplicateOf) skipped.push({ ...card, duplicateOf });
      else { const entry = { ...card, actionKey: action }; unique.push(entry); remember(entry); }
    }
    return { cards: unique, skipped };
  }

  async function runQueue(items, options) {
    let next = 0, completed = 0;
    const failures = [];
    await Promise.all(Array.from({ length: Math.min(items.length, options.concurrency || 3) }, async () => {
      while (next < items.length && !options.shouldStop?.()) {
        const item = items[next++];
        try {
          const card = await options.generate(item);
          if (options.shouldStop?.()) break;
          if (await options.save(card) !== false) completed += 1;
        } catch (error) { failures.push({ item, error: error.message }); }
        options.onProgress?.({ completed, failed: failures.length, total: items.length });
      }
    }));
    return { completed, failures };
  }

  function createController(options) {
    const { dialog, input, folder, prepare, generate, stop, preview, duplicates, status, source } = options;
    let drafts = [], busy = false, stopped = false;
    const selectedInputs = () => [...preview.querySelectorAll("input")].filter((item) => item.checked);
    function message(text, tone = "neutral") { status.textContent = text; status.dataset.tone = tone; }
    function controls(loading) {
      busy = loading;
      input.disabled = folder.disabled = prepare.disabled = preview.disabled = loading;
      generate.disabled = loading || !selectedInputs().length;
      stop.hidden = !loading;
    }
    function render() {
      preview.replaceChildren();
      drafts.forEach((draft, index) => {
        const label = document.createElement("label");
        label.className = "practice-card-choice";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox"; checkbox.value = String(index); checkbox.checked = true;
        const text = document.createElement("span"), translation = document.createElement("small");
        text.textContent = draft.phrase; translation.textContent = draft.translation;
        text.append(translation); label.append(checkbox, text); preview.append(label);
      });
      preview.hidden = !drafts.length;
      generate.hidden = !drafts.length;
      controls(false);
    }
    input.addEventListener("input", () => { drafts = []; duplicates.hidden = true; render(); message(""); });
    preview.addEventListener("change", () => { generate.disabled = !selectedInputs().length; });
    prepare.addEventListener("click", async () => {
      if (busy) return;
      try { parse(input.value); } catch (error) { message(error.message, "warn"); return; }
      const profile = options.getProfile();
      drafts = []; render(); duplicates.hidden = true;
      stopped = false; stop.disabled = false; controls(true); message("Проверяю действия и повторы…", "work");
      try {
        const data = await options.request("/api/import-cards/prepare", {
          profile, text: input.value,
          existingCards: options.getCards().map(({ phrase, actionKey }) => ({ phrase, actionKey })),
        }, 70000);
        if (stopped || options.getProfile() !== profile) return;
        drafts = data.cards || [];
        source.open = !drafts.length;
        render(); duplicates.replaceChildren();
        const skipped = data.skipped || [];
        duplicates.hidden = !skipped.length;
        const summary = document.createElement("summary"); summary.textContent = `Пропущено повторов: ${skipped.length}`;
        duplicates.append(summary);
        skipped.forEach((card) => {
          const row = document.createElement("p"); row.textContent = `${card.phrase} → ${card.duplicateOf}`; duplicates.append(row);
        });
        message(drafts.length ? `Новых карточек: ${drafts.length}. Повторов: ${skipped.length}.` : "Все действия уже есть в базе.", "ok");
      } catch (error) { message(options.formatError(error.message), "error"); }
      finally { controls(false); }
    });
    generate.addEventListener("click", async () => {
      if (busy) return;
      const selected = selectedInputs().map((checkbox) => drafts[Number(checkbox.value)]);
      if (!selected.length) return;
      const profile = options.getProfile(), folderPath = folder.value;
      stopped = false; stop.disabled = false; controls(true); message(`Создаю картинки: 0 из ${selected.length}…`, "work");
      try {
        const result = await runQueue(selected, {
          concurrency: 3,
          shouldStop: () => stopped || options.getProfile() !== profile,
          generate: async (draft) => ({ ...draft, folderPath, ...(await options.request("/api/import-cards/image", {
            word: draft.word, scene: draft.scene,
          }, 145000)) }),
          save: (card) => {
            if (!card.imageUrl) throw new Error("Картинка не создана.");
            options.onCard(card);
            const index = drafts.indexOf(selected.find((draft) => draft.index === card.index));
            const checkbox = [...preview.querySelectorAll("input")].find((item) => item.value === String(index));
            if (checkbox) checkbox.checked = false;
          },
          onProgress: ({ completed, failed, total }) => message(`Сохранено: ${completed} из ${total}${failed ? ` · Ошибок: ${failed}` : ""}.`, "work"),
        });
        if (options.getProfile() !== profile) return;
        message(`${stopped ? "Остановлено. " : ""}Сохранено карточек: ${result.completed}.${result.failures.length ? ` Не получилось: ${result.failures.length}. Можно повторить для оставшихся. ${options.formatError(result.failures[0].error)}` : ""}`, result.failures.length ? "warn" : "ok");
      } catch (error) { message(options.formatError(error.message), "error"); }
      finally { controls(false); }
    });
    stop.addEventListener("click", () => { stopped = true; stop.disabled = true; message("Останавливаю. Уже сохранённые карточки останутся в базе.", "work"); });
    return { open() {
      if (!busy) {
        stop.disabled = false;
        const current = folder.value || options.defaultFolder();
        folder.replaceChildren();
        [...new Set([options.defaultFolder(), ...options.getFolders()])].filter(Boolean).forEach((path) => {
          const option = document.createElement("option"); option.value = option.textContent = path; folder.append(option);
        });
        folder.value = [...folder.querySelectorAll("option")].some((item) => item.value === current) ? current : options.defaultFolder();
      }
      dialog.showModal();
    } };
  }

  root.CardImport = { MAX_LINES, key, actionKey, parse, deduplicate, runQueue, createController };
})(globalThis);
