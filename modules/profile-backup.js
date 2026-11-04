(function (root) {
  const FORMAT = "action-cards-backup";
  const LIMIT = 64 * 1024 * 1024;
  const fields = ["cards", "folders", "starterPacks", "studySettings", "activity", "englishTrainer", "polish", "workspace"];
  const key = (profile) => `action-cards:snapshot:v1:${profile}`;
  const historyKey = (profile) => `action-cards:backups:v1:${profile}`;

  function create(profile, source, now = Date.now()) {
    const data = Object.fromEntries(fields.map((field) => [field, source[field]]));
    return JSON.parse(JSON.stringify({ format: FORMAT, version: 1, profile, createdAt: new Date(now).toISOString(), data }));
  }

  function parse(text) {
    if (typeof text !== "string" || text.length > LIMIT) throw new Error("Файл копии слишком большой.");
    let copy;
    try { copy = JSON.parse(text); } catch { throw new Error("Не удалось прочитать файл копии."); }
    const data = copy?.data;
    if (copy?.format !== FORMAT || copy.version !== 1 || !data || !Array.isArray(data.cards) ||
      !Number.isFinite(Date.parse(copy.createdAt)) || !Array.isArray(data.folders) || !data.folders.every((item) => typeof item === "string") ||
      !data.cards.every((card) => card && typeof card.id === "string" && typeof card.phrase === "string" &&
        (card.translation == null || typeof card.translation === "string") &&
        (card.imageUrl == null || (typeof card.imageUrl === "string" && /^(?:https?:\/\/|data:image\/(?:png|jpeg|webp);base64,|\/?(?:images|assets)\/|$)/i.test(card.imageUrl))))) {
      throw new Error("Это не резервная копия приложения.");
    }
    for (const field of ["studySettings", "activity", "englishTrainer", "polish", "workspace"]) {
      if (data[field] != null && (typeof data[field] !== "object" || Array.isArray(data[field]))) throw new Error("Повреждён файл копии.");
    }
    for (const field of ["englishTrainer", "polish"]) {
      if (data[field]?.words != null && !Array.isArray(data[field].words)) throw new Error("Повреждён словарь в копии.");
      for (const list of ["words", "exercises", "preparedExercises"]) {
        const items = data[field]?.[list];
        if (items != null && (!Array.isArray(items) || items.some((item) => !item || typeof item !== "object" || Array.isArray(item)))) throw new Error("Повреждён словарь в копии.");
      }
    }
    return create(copy.profile, data, Date.parse(copy.createdAt));
  }

  function read(storage, profile) {
    try { return parse(storage.getItem(key(profile))); } catch { return null; }
  }

  function history(storage, profile) {
    try {
      const items = JSON.parse(storage.getItem(historyKey(profile)) || "[]");
      return Array.isArray(items) ? items.map((item) => parse(JSON.stringify(item))) : [];
    } catch { return []; }
  }

  function checkpoint(storage, profile, snapshot, force = false) {
    if (!snapshot) return;
    const items = history(storage, profile);
    if (!force && items.some((item) => item.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10))) return;
    storage.setItem(historyKey(profile), JSON.stringify([snapshot, ...items].slice(0, 7)));
  }

  function write(storage, profile, snapshot) {
    const previous = read(storage, profile);
    const value = JSON.stringify(snapshot);
    let copies = history(storage, profile);
    for (;;) {
      try { storage.setItem(key(profile), value); break; }
      catch (error) {
        if (!copies.length) throw error;
        copies = copies.slice(0, -1);
        storage.setItem(historyKey(profile), JSON.stringify(copies));
      }
    }
    try { checkpoint(storage, profile, previous); } catch { /* The live profile takes priority over optional history. */ }
  }

  async function portable(snapshot, fetchImage, readBlob) {
    const copy = parse(JSON.stringify(snapshot));
    const images = new Map();
    for (const card of copy.data.cards) {
      const url = card.imageUrl || "";
      if (!/^(?:\/?images\/|\/?assets\/ai\/)/.test(url)) continue;
      if (!images.has(url)) {
        const response = await fetchImage(url);
        if (!response.ok) throw new Error("Не удалось сохранить картинку. Попробуй скачать копию ещё раз.");
        const blob = await response.blob();
        if (!/^image\/(?:png|jpeg|webp)$/.test(blob.type)) throw new Error("Не удалось прочитать картинку.");
        const embedded = await readBlob(blob);
        if (embedded.length > 8 * 1024 * 1024) throw new Error("Картинка в копии превышает 8 МБ.");
        images.set(url, embedded);
      }
      card.imageUrl = images.get(url);
      if (JSON.stringify(copy).length > LIMIT) throw new Error("Копия с картинками превышает 64 МБ.");
    }
    return copy;
  }

  root.ProfileBackup = { create, parse, read, write, history, checkpoint, portable, LIMIT };
})(globalThis);
