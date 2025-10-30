# Changelog

All notable changes to this project will be documented in this file.

## Unreleased

- feat(ui): Extract initial polished UI components from andl-ai-client into cockpit UI library (AT-P2.M4-09).
- build(ui): Add UI library bundle `dist/ui/index.js` with react/react-dom externalized; emit type declarations to `dist/ui`.
- docs: Declare `react` and `react-dom` as peerDependencies for UI consumers.

## 0.1.1 - 2025-10-30

- BREAKING: Complete webview refactor to polished UI library components (replaced rjsf-based wizards)
- Fixed CSP to support React inline styles via `'unsafe-inline'` in style-src
- Removed legacy components: ProviderSetupWizard, ToolkitRegistrationWizard, MemoryEditor
- Removed @rjsf dependencies (core/utils/validator-ajv8); pruned extraneous node_modules
- Added minimal Toolkit and Memory editors using UI library building blocks
- Aligned host/webview message protocol with UI library (provider creds, models list/refresh/exclude)
- Tests: skipped legacy wizard tests pending new coverage; remaining suites pass

## 0.1.0 - 2025-10-30

- Initial marketplace-ready preview of ANDL AI Cockpit.
- Provider Setup Wizard: add/test/save providers, SecretStorage for API keys, settings rehydrate.
- Toolkit Registration Wizard: enumerate tools from providers, handle duplicates, register into catalog.
- Memory Settings Editor: schema-driven editor for STM/LTM/RAG; apply via `config:apply`.
- Ajv v8 validation (Draft-07 + formats) for `ConfigSchema.json`.
- esbuild bundles for host (`dist/extension.js`) and webview (`dist/webview.js`).
- Tests: webview flows (provider, toolkit, memory) passing.
- Packaging: `vsce package` prebundled (use `--no-dependencies`).
