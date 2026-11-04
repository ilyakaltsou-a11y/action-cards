# Mountain Design: v73

## Recovery Checkpoints

- Stable source checkpoint: tag `pre-design-v73` at commit `0dd5c75` (v72.1).
- Design work: branch `codex/mountain-redesign`. The stable `main` branch is unchanged.
- Review or run the stable checkpoint in a separate Git worktree. Do not reset the current branch or discard profile data.
- A later production rollback should use a new revert commit or Cloudflare's previous deployment, never a force-push.
- A code rollback does not roll back profiles. Download a private profile backup before production migration.

## Canonical Files

- `public/mountain.css`: dark landscape design layer and responsive layouts.
- `public/modules/workspace.js`: home, themes, favorites, progress, Notes and offline packs.
- `public/assets/themes/`: nine original public JPEG wallpapers generated with the built-in image tool, not the user's API key.
- `data/design-themes.json`: shared generation constraints and individual scene briefs.
- `public/index.html`: navigation and screen structure.
- `src/worker.js`: backwards-compatible profile API, including merged workspace records.

Existing AI generation, folders, study gestures and sentence trainers remain in place.
Root browser files are generated compatibility copies; edit `public/` only.
Run `npm run build:worker` to regenerate the standalone file and copies.

## Saved Data

The optional `workspace` profile field stores the selected theme, Notes and bookmarked card IDs.
Individual records carry update timestamps; deleted notes and removed bookmarks retain tombstones.
Older clients may omit `workspace` without erasing it on the server.
Local atomic snapshots and downloadable profile backups include these fields.
Notes save locally on each edit and queue server sync after a short debounce.

## Offline Behavior

The first successful online profile load downloads up to 20 basic-action starter cards.
The Offline screen can download additional folders and start practice using only downloaded card IDs.
Downloads are isolated by profile in Cache Storage. Removing downloads does not remove the library.
Shell updates retain downloaded image caches. Missing cached images are checked on online startup.
Private images are cached only through the download workflow, not simply by browsing them.

Initial installation and downloads require a secure online origin (localhost also works).
The browser can evict site storage; downloaded cards are not a replacement for a private backup.
AI generation, answer checking, cloud sync and network speech voices still require a connection.
Existing cards and Notes remain usable offline; pending saves retry when the app is online again.

## Verification

- `npm run check`
- `npm test`
- `npm run build:worker`
- Browser checks at mobile and desktop sizes, including server-off reload, downloaded image display and card flip.
- Automated coverage for legacy profiles, Notes, themes, favorites, offline partial failures, cache upgrades and standalone assets.

## Publishing

A GitHub push saves source but does not publish this preview.
Do not attach the design branch to production KV for automatic preview deployments.
Use the existing Wrangler assets deployment after design approval, retaining the existing `CARDS_KV` binding and secrets.
The generated single-file Worker embeds all images and is much larger; the assets deployment avoids embedding wallpapers in JavaScript.

## v74 Follow-Up

- Notes stays a free-form notebook. The coffee conversation is a test-profile example, not a required lesson or a global starter note.
- "Task from words" selects one to five dictionary entries (English or Polish), preserves phrases whole, and opens the existing translation trainer with hidden hints. Only selected vocabulary is sent; the request requires all selected entries. Existing trainer count and difficulty settings apply.
- "Practice text" opens the existing own-text dialog with the editor selection, or the whole open note. The user can edit the Russian prompt before requesting AI hints. Notes are not deleted or replaced.
- Language, practice-mode and time-period switches now share a pill-shaped segmented style.
- Offline folders are no longer silently preselected. Three bounded download workers show progress and retain successful images after a partial failure.
- Legacy pictures on the existing production host download via `/api/offline-image`. This is an allowlisted bridge, not an open proxy: HTTPS, exact host, `/images/` filenames, no redirects or forwarded credentials, image MIME validation, 8 MB streamed limit and a 30-second timeout.
- Explicitly downloaded image responses are cached under their original image URL and served cache-first, including cross-origin image requests. API requests are still never stored in the shell cache.
- Git tag `v73` preserves the version before this follow-up. GitHub source push is still separate from production deployment.

## v75 Selected-Word Repair

- Notes word generation uses a dedicated shared English/Polish DeepSeek flow. Ordinary trainer prompts remain unchanged.
- Every selected expression is required, but a five-expression exercise may use two or three short sentences. The word count is a soft target here, not a reason to omit vocabulary.
- The model returns verbatim answer evidence for each base form. This supports inflected Polish words and English phrasal verbs with an intervening object instead of relying on a potentially incomplete `usedWords` list.
- Missing evidence, incomplete texts and exact recent repeats trigger automatic repair with concrete feedback. At most three DeepSeek calls are made, each with a 30-second timeout; validation rejection returns HTTP 422 and is not automatically resubmitted by the browser.
- Exhausted repair keeps the selection and previous exercise intact. No image generation or OpenAI fallback is used by this flow.
- Git tag `v74` remains the previous rollback point.
