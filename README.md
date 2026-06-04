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

By default the app opens on `http://127.0.0.1:5177`. You can change the port in `.env`.

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
