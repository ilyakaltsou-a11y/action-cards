# Cloudflare deploy notes

This project can run as a single Cloudflare Worker with static assets.

Resources needed:

- Worker name: `action-cards`
- KV namespace binding: `CARDS_KV`
- Secret: `OPENAI_API_KEY`
- Secret: `DEEPSEEK_API_KEY` (optional, for AI song identification)

The Worker serves:

- static app assets from `public/`
- `/api/status`
- `/api/create-card`
- `/api/cards`
- `/images/<file>.png`

Cards and generated images are both stored in the `CARDS_KV` namespace.

The OpenAI key must be set as a Worker secret, not placed in browser files.

Before the temporary API upload path, rebuild the standalone Worker with:

```sh
node scripts/build-standalone.js
```

For normal long-term deployment, prefer `wrangler deploy` with `src/worker.js` and the `public/` assets binding from `wrangler.jsonc`.
