# Changelog

All notable changes to this project will be documented in this file.

## 0.1.0 - 2025-10-30

- Initial marketplace-ready preview of ANDL AI Cockpit.
- Provider Setup Wizard: add/test/save providers, SecretStorage for API keys, settings rehydrate.
- Toolkit Registration Wizard: enumerate tools from providers, handle duplicates, register into catalog.
- Memory Settings Editor: schema-driven editor for STM/LTM/RAG; apply via `config:apply`.
- Ajv v8 validation (Draft-07 + formats) for `ConfigSchema.json`.
- esbuild bundles for host (`dist/extension.js`) and webview (`dist/webview.js`).
- Tests: webview flows (provider, toolkit, memory) passing.
- Packaging: `vsce package` prebundled (use `--no-dependencies`).
