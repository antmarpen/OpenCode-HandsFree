# Security policy

## Supported versions

Only the latest `0.1.x` release receives security fixes. The plugin targets the experimental OpenCode Desktop GUI API, so keep Desktop and the plugin updated together.

## Reporting a vulnerability

Use GitHub's private vulnerability reporting: **Security → Advisories → Report a vulnerability** on
<https://github.com/antmarpen/OpenCode-HandsFree/security/advisories/new>.

Do not open a public issue for a security problem, and never include API keys, tokens, audio recordings or personal paths in a report.

## How the plugin handles secrets

- API keys entered in **Settings > Voice** are encrypted with Electron's `safeStorage` (DPAPI on Windows) before they are stored. They are never written to `opencode.json` or to the logs.
- If the OS keychain is unavailable, the key is stored as plain text and the desktop log records a warning. Treat that machine as compromised for that key and prefer a service account with a scoped key.
- OpenCode provider credentials are resolved by the server half on demand; the plugin does not copy them into its own storage.
- Dictation clips and synthesized replies are written to the OS temporary directory only while a request runs and are deleted afterwards.

## Scope

In scope: the plugin source in `src/`, the built bundle behavior, and the documentation in this repository.

Out of scope: OpenCode Desktop itself, `whisper.cpp`, the operating system speech synthesizer, and third-party OpenAI-compatible providers. Report those to their own maintainers.
