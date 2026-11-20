# AGENTS.md

## Language

- All code, identifiers, comments, commit messages, documentation and file names are written in **English**.
- A chat reply may follow the language the user writes in; documentation and commit history stay English.

## What this project is

`opencode-handsfree` is an OpenCode Desktop plugin that adds bidirectional voice:

- dictation: microphone -> speech-to-text model (local or cloud) -> composer;
- playback: assistant text -> TTS (local or cloud) -> speakers;
- per-session switches, persisted through the plugin stores;
- a settings page under Settings > Voice.

## Commands

```powershell
npm install
npm run typecheck   # tsc --noEmit
npm run build       # vite build -> dist/gui-experimental.cjs
npm run watch       # rebuild the GUI bundle on change
```

Definition of done for any change: `npm run typecheck` and `npm run build` both pass.

## Commits

- Subject: capital first letter, short and specific. No `feat:`/`fix:` prefixes or similar tags.
- Then a blank line and a few bullets with the relevant changes.
- Describe behavior and intent, not a file-by-file or line-by-line log. Name a file only when the point is that specific.
- Only the points that matter: if the commit message needs every change listed, the commit is doing too much.

## Architecture rules

- **Quality over features.** Prefer clear, small, single-purpose modules over clever or dense code.
- **No monoliths.** A file with more than one responsibility must be split. Host wiring (`setup`, `main`) only composes modules; it does not implement behavior.
- **Factory functions over classes.** Export interfaces plus `createX(...)` functions. Use a class only when it owns identity and state that a closure cannot express.
- **Pure helpers stay pure.** Text cleanup, chunking, WAV encoding, script building and similar logic must not touch host APIs. Keep them in their own modules so they can be reasoned about (and tested) in isolation.
- **Dependency direction.** `main.ts` and `window.tsx` depend on domain modules, never the other way around. Domain modules receive what they need as parameters (`Secrets`, `Runner`, `Deliver`, `Speak`) instead of reaching into host context.
- **One i18n source.** Every user-facing string comes from `ctx.t(...)`. Add the key to `i18n/en.ts` and `i18n/es.ts` in the same change. English is the fallback; Spanish must be complete.
- **Secrets never leave the OS keychain.** API keys go through `safeStorage`. Never write them to `opencode.json`, logs, or the window store.

## Window / main split

The `./gui-experimental` bundle is evaluated in both the Electron main process and every window:

- `src/gui.tsx` exports `Plugin.define({ ...definition, setup, main })`.
- `setup` runs in each window: registries (commands, pill, settings page), DOM/microphone access, composer writes.
- `main` runs once in Electron main: child processes, `fetch` with API keys, audio playback, `safeStorage`, temp files.
- Never run process-specific work at module scope. Imports of `electron`, Node built-ins and DOM-only modules must be inert until a function runs.

## File map

```
src/index.ts                  Minimal server half: plugin id and the credential RPC.
src/rpc.ts                    RPC contract for OpenCode provider credentials.
src/gui.tsx                   GUI entry: composes setup and main.
src/gui/definition.ts         Stores and i18n declarations.
src/gui/i18n/                 English and Spanish catalogs.
src/gui/contract.ts           Typed Ipc between window and main.
src/gui/context.ts            Shared window context type.
src/gui/flags.ts              Per-session switches.
src/gui/status.ts             Whether each direction is configured.
src/gui/components/search-select.tsx  Searchable dialog picker for model and voice lists.
src/gui/text.ts               Markdown cleanup and sentence chunking.
src/gui/audio/wav.ts          Pure WAV encoding, resampling and base64.
src/gui/audio/meter.ts        Pure RMS mapping, level smoothing and the wave mask.
src/gui/audio/devices.ts      Microphone enumeration for the input device picker.
src/gui/recorder.ts           Microphone capture built on the audio helpers.
src/gui/window.tsx            Thin composition of the window modules.
src/gui/window/               Dictation, conversation, delivery, speech, player, replies, commands, pill, Escape, stop pill, header control, header icons, switch popover, settings page.
src/gui/settings.tsx          Settings page composition, with the tab switch.
src/gui/settings-route.ts     Settings tab id shared by the header and the page.
src/gui/settings/tabs.tsx     Pill tabs at the top of the settings page.
src/gui/settings/conversation-section.tsx  Experimental conversation settings.
src/gui/settings/rows.tsx     Reusable settings row components.
src/gui/settings/provider-row.tsx    OpenCode provider selector.
src/gui/settings/providers.ts        Providers OpenCode has connected, with their base URLs.
src/gui/settings/suggestion-row.tsx  Text field that becomes a select after loading models or voices.
src/gui/main.ts               Thin composition of the main modules.
src/gui/main/                 Secrets, credentials, process runner, transcription, speech, models, voices, temp files.
```

## Plugin API notes

- The GUI plugin API is experimental (`./gui-experimental`) and may change between releases.
- The GUI bundle must be one prebuilt CommonJS file. Only the modules the app provides may remain external: `effect`, `@opencode/plugin/gui`, `@opencode/plugin/gui/main`, `@opencode/plugin/rpc`, `@opencode/schema/rpc`, `@opencode/client`, `@opencode/client/effect`, `solid-js` and its submodules, `@opencode/client/solid`, plus `electron` and Node built-ins. Everything else is bundled.
- Desktop loads GUI parts from plugins in the **global** `opencode.json(c)`.
- Read session state where it is used (reactive getters); never capture a session object once in `setup`.
