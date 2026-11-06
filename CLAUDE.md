# Notes for Claude

The README describes the project, its layout and its conventions. These rules hold in every session:

## Branches

- Work happens on `main` unless the owner asks for a branch.

## Changelog

- A change that players can see goes into `CHANGELOG.md`, under `## [Unreleased]`, in the section it belongs to (`### Added`, `### Changed`, `### Fixed` or `### Removed`). Write it for players, in English.
- Changes only developers notice (tests, tooling, refactoring) need no entry.
- A new version is made only when asked: see "Changelog and versions" in the README.

## Code

- Use pnpm, never npm or yarn. Run `pnpm check` before every push.
- `src/core` holds the game rules as pure TypeScript: no DOM, no three.js, no Preact and no imports from other `src/` folders.
- three.js is imported as `three` and its add-ons as `three/addons/...`. The 3D view loads on demand, so `src/ui` imports `src/view` only through `import()`.
- No asset files: every model, texture, sound and piece of music is made in code.
- Every text players see goes through `t()` from `src/i18n`, with an English and a German version.
