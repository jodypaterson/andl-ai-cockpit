# ANDL AI Cockpit (VS Code Extension)

Unified AI Configuration Hub for ANDL. This extension provides a single panel to configure AI providers, register tools, and edit memory settings — all validated against the canonical ANDL config schema.

## Features

- Provider Setup Wizard
	- Add a provider (OpenAI, Azure OpenAI, Anthropic, Gemini, GitHub Models)
	- Test credentials via host handler `provider:test`
	- Persist API keys to VS Code SecretStorage; write non‑secret config to `andl.ai.*` settings
	- Live rehydrate of the webview config after save

- Toolkit Registration Wizard
	- Enumerate tools from one or more selected providers (e.g., OpenAPI sources)
	- Resolve duplicates (skip/replace/rename)
	- Register selected tools via host handler `toolkit:register` and update the local catalog

- Memory Settings Editor
	- Edit STM/LTM/RAG memory settings using a schema‑driven modal
	- Validate with Ajv v8 (Draft‑07 + ajv‑formats)
	- Persist via `config:apply` and rehydrate the UI

## Tech Stack

- TypeScript, React 18 webview
- @rjsf/core dynamic forms, Ajv v8 validation (+ ajv‑formats)
- esbuild bundling: CommonJS host `dist/extension.js`, IIFE webview `dist/webview.js`
- Persistence: VS Code SecretStorage for secrets; settings under `andl.ai.*`

## Requirements

- VS Code >= 1.85.0
- Node.js 18+
- pnpm 10+

## Scripts

- Build: `pnpm compile`
- Test: `pnpm test`
- Package: `pnpm run package` (or `pnpm exec vsce package --no-dependencies --allow-missing-repository`)

Note: Packaging uses the prebundled dist output; dependencies are not required at runtime, so `--no-dependencies` is recommended.

## Running the extension (Dev)

1. Install deps: `pnpm install`
2. Build once: `pnpm compile`
3. Launch a VS Code Extension Development Host (F5 in VS Code) and run the command: "ANDL: Open AI Configuration"

## Manual E2E Checklist

1) Provider setup
- Open the cockpit and click "Add Provider"
- Choose a provider, enter credentials, click "Test" → expect success message
- Click "Save" → provider appears in the list, and settings update

2) Toolkit registration
- Click "Register Tools"
- Select one or more providers, click "Enumerate" → tools list appears
- Select tools, resolve any duplicates, click "Register" → expect confirmation and local catalog update

3) Memory editor
- Click "Edit Memory Settings"
- Modify STM/LTM/RAG fields; save → expect `config:apply` sent, persistence to settings, and UI rehydration

4) Validation
- No console errors in DevTools
- Reopening the cockpit shows saved state (providers, tools, memory)

## Packaging

1. Build: `pnpm compile`
2. Package: `pnpm exec vsce package --no-dependencies --allow-missing-repository`
3. The VSIX will be created in the project root (e.g., `andl-ai-cockpit-0.1.0.vsix`)

## Troubleshooting

- If `vsce package` reports npm dependency issues under pnpm, use `--no-dependencies` (the extension ships prebundled `dist/` only).
- If a repository warning appears, add a `repository` field to `package.json` or pass `--allow-missing-repository` when packaging.

## License

MIT License. See `LICENSE`.
