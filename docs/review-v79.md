# v79: Review queue and spoken English

## Scheduling

- Long-term scheduling uses the pinned `ts-fsrs@5.4.2` (FSRS-6, 90% desired retention, deterministic intervals). Its unmodified UMD build and MIT license are copied by `scripts/vendor-fsrs.js` during browser sync/build. No CDN is needed offline.
- At most five active learners in the selected scope; overdue reviews precede unseen cards. Learning slots stay reserved while their delay runs. A large import cannot displace cards the user is struggling with.
- At most five new cards introduced per local calendar day across the profile, regardless of folder changes/reloads. Selecting a card does not consume a slot; rating it does.
- Short learning/relearning steps can return after four other ratings, or their FSRS time delay, whichever comes first. With fewer available cards, wait rather than immediately repeat the same item. This four-card gap is a product choice, not a scientifically universal optimum. Successful learning steps graduate to FSRS calendar intervals.
- Completed future reviews are not displayed early. A pause screen shows the next scheduled review and refreshes while visible or when returning to the app. The visible card never changes due to a clock tick while its answer is open.
- Flips, reveal, audio and the ungraded repeat button do not count as reviews or consume spacing. Existing activity rules and swipes are unchanged.
- Each card retains its old counters and adds versioned `review` memory, local introduction timestamp and remaining gap. These fields pass through profile sync/backups. Old cards bootstrap memory on their first new rating because historical counts cannot reconstruct actual review history. Existing future due dates remain respected. Merge freshness uses actual edit/review timestamps, never a future due date.

Sources: [Anki deck options](https://docs.ankiweb.net/deck-options.html), [pinned ts-fsrs source](https://github.com/open-spaced-repetition/ts-fsrs/tree/v5.4.2).

## Starter pack

`data/spoken-english.json` holds 39 user-supplied pairs and Russian translations. `scripts/add-spoken-english.js` reproducibly updates starter copies. Folder: **Стартовые / Разговорное произношение**. `spoken-english-v1` is additive once per profile and respects later deletions.

`standardPhrase` is the front, `phrase` is the spoken form on the back, and Russian translation is revealed separately. These text-only cards ignore global picture/Russian-first preferences without changing normal text-only question cards. Item 17's mixed standard/spoken halves are normalized. Browser speech remains a synthetic voice, not a recorded pronunciation lesson.

## Recovery and publication

The recoverable pre-change checkpoint is tag `v78`. v79 keeps profile/card IDs and all existing data fields. GitHub push saves code, not the production website. The standalone Cloudflare artifact is still generated with `npm run build:worker`; do not hand-edit it.
