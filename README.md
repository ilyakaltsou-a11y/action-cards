# Action Cards

Action Cards is a browser-based English flashcard app. It helps learners study without native-language prompts on the front of the card: each card shows an image first, then an English sentence, optional Russian help, pronunciation, and review swipes.

## Features

- AI-generated English flashcards from a word or phrase
- AI-generated images for each card
- Optional Russian translation hidden behind blur
- Swipe review: unknown cards appear sooner, known cards appear later
- Folders and nested folders for topics
- Song-inspired card creation without storing or displaying full copyrighted lyrics
- Activity streaks and freeze days
- Local profile support plus Cloudflare Worker deployment

## Local Development

Requires Node.js 20 or newer.

1. Create a local env file from the example:

```sh
cp .env.example .env
```

2. Add your own keys to `.env`:

```sh
OPENAI_API_KEY=...
DEEPSEEK_API_KEY=...
```

3. Start the local server:

```sh
node server.js
```

By default the app opens on `http://127.0.0.1:5176`. You can change the port with `PORT` in `.env` (the example uses 5177).

The local server listens only on this computer by default. Set `HOST=0.0.0.0` only when intentionally allowing access from your local network. Profiles are selected by code, not protected by a password.

## Code Structure

- `public/`: canonical browser interface, styles, starter cards, and assets.
- `src/worker.js`: one API implementation for both Cloudflare and local development, including AI prompts.
- `server.js`: Node HTTP adapter that starts the shared API locally.
- `src/local/`: local environment loading, filesystem storage, and public asset serving.
- `tests/`: UI regressions, shared API tests, and local HTTP/storage integration tests. Tests mock AI calls and do not spend API credits.

Local profiles keep their existing `data/profiles/` format. Generated images remain in `assets/ai/`; both old image links and new `/images/` links work locally. Older digit-stripped profile filenames are read as a fallback, while future saves use the full profile code. Writes replace files atomically rather than overwriting them in place.

Only `public/` and the generated-image directory are served to the browser, never the repository root or environment files. Root-level browser copies are retained for compatibility with existing workflows; edit `public/` first.

## Checks

```sh
node --check app.js
node --check public/app.js
node --check server.js
node --input-type=module --check < src/worker.js
```

## Cloudflare

The production version can run as a Cloudflare Worker. Required Worker secrets:

- `OPENAI_API_KEY`
- `DEEPSEEK_API_KEY`

For manual Worker copy-paste deployment, build:

```sh
npm run build:worker
```

Then copy `src/worker-standalone.js` into Cloudflare. This generated file is intentionally ignored by Git.

## Privacy

Secret keys, local profile data, generated images, and Cloudflare build artifacts are excluded from GitHub by `.gitignore`.

## Сохранения И Возврат Версии

Репозиторий: [action-cards](https://github.com/ilyakaltsou-a11y/action-cards).

- Контрольная точка `v65` сохраняет код приложения перед дальнейшей очисткой и переработкой.
- История сохранений доступна в разделе **Commits**, отмеченные версии находятся в **Tags**.
- Для нового сохранения можно попросить: «Сохрани текущую версию в GitHub».
- Для возврата можно попросить: «Восстанови приложение из версии v65». Возврат следует сохранять новым коммитом, не стирая последующую историю.

Сохранение в GitHub не происходит автоматически и само по себе не обновляет сайт в Cloudflare. Это копия кода, а не резервная копия личных карточек, профилей или API-ключей. Репозиторий публичный: ключи и личные данные нельзя добавлять даже во временный коммит.
