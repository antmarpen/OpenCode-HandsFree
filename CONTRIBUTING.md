# Contributing

Thanks for taking the time to improve `opencode-handsfree`. This is a small plugin, so the bar is quality, not quantity: focused changes, small modules and clear behavior.

## Setup

```powershell
npm ci
npm run typecheck
npm run build
```

- `npm run watch` rebuilds `dist/gui-experimental.cjs` on every change.
- Desktop reloads the GUI part after each rebuild. When you add or change **Ipc methods**, restart OpenCode Desktop so the main process registers the new contract. The log line `voice: main ready { version }` tells you which bundle main loaded.

## Definition of done

- `npm run typecheck` and `npm run build` pass.
- New user-facing strings are added to **both** `src/gui/i18n/en.ts` and `src/gui/i18n/es.ts`.
- Behavior changes are described in the pull request, not just the diff.

There is no automated test suite yet. Pure helpers (`src/gui/text.ts`, `src/gui/audio/wav.ts`, `src/gui/audio/meter.ts`, `src/gui/main/urls.ts`) are kept free of host APIs so tests can be added around them.

## Code conventions

Read [`AGENTS.md`](./AGENTS.md). The short version:

- English for code, identifiers, comments, documentation, commit messages and file names.
- Factory functions over classes; one responsibility per module; host wiring only composes.
- Domain modules receive dependencies (`Secrets`, `Runner`, `Deliver`, `Speak`) instead of reaching into host context.
- Secrets go through `safeStorage`; never write API keys to `opencode.json`, logs or stores in plain text.

## Commits

- Subject: capital first letter, short and specific. No `feat:` / `fix:` prefixes.
- Blank line, then a few bullets with the behavior and intent. Name a file only when the point is that specific.

## Pull requests

- One concern per pull request.
- Say what changed and how you verified it; UI changes deserve a screenshot.
- New features are welcome if they stay within the plugin's scope: voice in, voice out, and the hands-free loop.

## Releasing

The published package ships the GUI bundle already built: `prepack` runs `npm run build`, and `files` includes `dist`.

```sh
npm version patch   # or minor / major
npm publish         # public unscoped package
```

After publishing, check that a clean install works with `opencode plugin add opencode-handsfree@<version>` before announcing it.

## Security

Do not paste API keys, tokens or personal paths in issues or pull requests. See [`SECURITY.md`](./SECURITY.md) for private reporting.
