## What and why

<!-- What does this change, and why? Link an issue it closes, as "Closes #123". -->

## How to see it

<!-- Where to look in the game: the screen, the settings, the device. For anything players see,
a screenshot or a short video. -->

## Tried on

<!-- Browsers, phones or the Android app it was tried on. For frames, graphics or crashes, attach
a debug log: Settings → Export debug log. -->

## Checklist

- [ ] `pnpm check` passes (types, Biome, unit tests), and `pnpm test:coverage` as CI runs it
- [ ] `pnpm test:e2e` passes where the change touches the game in the browser
- [ ] A fixed bug has a test that would catch it again; a new feature has a test that plays it through
- [ ] Changes players can notice are in `CHANGELOG.md` under `## [Unreleased]`, in the section they belong to (Added, Changed, Fixed or Removed), written for players, in English
- [ ] Every text players see goes through `t()` from `src/i18n`, in English and German
- [ ] `src/core` stays pure TypeScript: no DOM, three.js, Preact or imports from other `src/` folders
- [ ] No asset files: models, textures, sounds and music are made in code
- [ ] The README still says how things work
