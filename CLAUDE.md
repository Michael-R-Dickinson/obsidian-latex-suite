# Obsidian LaTeX Suite (fork)

Obsidian plugin for fast LaTeX typing (snippets, conceal, matrix shortcuts, …). User docs: `README.md` (features), `DOCS.md` (details).

## Commands
- `npm run build` / `npm run lint` — type-check + bundle to `main.js` / tsc + eslint
- `npm run test:formatter` — formatter unit tests (plain Node)
- `npm test` — integration suites; need a test build and a live Obsidian via CDP, won't run headless
- After `npm install <pkg>` run `npm run generator:latex` (npm skips the repo's `postinstall` then)
- Lockfile: regenerate with `npx npm@11` (matches upstream CI, Node 24) to keep diffs vs upstream small; lockfileVersion 2, tab-indented

## Modules
- `src/features/latex_formatter/` — `$$` block formatter (fork addition). Read its [CLAUDE.md](src/features/latex_formatter/CLAUDE.md) before changing formatting rules.
- Settings: defaults in `src/settings/settings.ts`, UI in `settings_tab.ts` (legacy) **and** `settings_tab2.ts` — add new settings to both; strings in `src/i18n/locales/en/settings.json`.
- Settings load as `{...DEFAULT_SETTINGS, ...data.json}`: new settings get defaults, existing user values survive.
