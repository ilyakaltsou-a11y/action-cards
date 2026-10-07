# Project Instructions

- After each completed code change, run the relevant tests and checks, then commit and push to the existing GitHub remote. The user has requested this as the default workflow.
- Never commit API keys, environment files, personal profiles, or generated private images. Audit staged files before pushing.
- Do not force-push or erase history. Keep checkpoints recoverable.
- GitHub saves source code; publishing to Cloudflare is a separate action. Do not claim that a GitHub push deployed the website.
- Keep the current UI and saved-data formats compatible during incremental refactoring.
- `public/` contains the canonical browser assets. `src/worker.js` contains the shared API used by Cloudflare and the local Node server.
- Local-only filesystem and HTTP adapters belong in `src/local/`. Do not duplicate AI prompts or API handlers in `server.js`.
- Generate the standalone Cloudflare file with `npm run build:worker`; never edit it by hand.
- Isolated browser logic belongs in `public/modules/`. Keep module scripts before `app.js` in the HTML and include them in offline-cache tests.
- Root browser files and `modules/` are compatibility copies generated with `npm run sync:browser` (also run by the Worker build). Edit the canonical files in `public/`, not their copies.
