# AGENTS.md

## Scope

`nvim-edu` is a Vite browser app for Vim/Neovim and tmux practice. Read
`CONTRIBUTING.md` before proposing a level; it is the source of truth for level
fields and par rules.

## Setup and verification

```sh
npm ci
npm test
npm run test:en
# Requires Neovim 0.11 on PATH locally:
npm run test:nvim
```

Run the narrowest relevant check while iterating, then run all applicable commands
above before opening a pull request. Do not claim a command passed if it was not run;
say why and include the failure if an environment prerequisite is missing.

## Level changes

- Vim levels are data: add the Korean definition to `src/levels/vim-levels.json`
  (field rules at the top of `src/levels/schema.js`) and the English text under the
  same `id` in `EN.levels` in `src/levels.en.js` and the Simplified Chinese text in
  `ZH_CN.levels` in `src/levels.zh-CN.js`. tmux levels stay in `src/levels.js`
  (`tmuxLevels`).
- Keep ids unique, lowercase kebab-case, and translations paired. Preserve the
  existing object shape and the canonical, minimal `solution` notation.
- Verify behavior in the browser. For a Vim/real-mode change, also run the
  Neovim comparison test and add or update a focused regression test when useful.

## Project conventions

- Match the surrounding JavaScript style: ES modules, single quotes, no semicolons.
- Keep a PR small and explain user-visible behavior. Do not reformat unrelated files.
- Do not add dependencies, telemetry, remote requests, build artifacts, or generated
  binaries without a maintainer-approved issue and a separate explanation.
- Treat `.github/workflows/`, `package.json`, `package-lock.json`, `vite.config.js`,
  and `patches/` as security-sensitive. Do not change them incidentally.
- Never add secrets, tokens, private data, or a workflow trigger such as
  `pull_request_target`. A pull request must never deploy GitHub Pages.

## AI-assisted work

AI assistance is welcome for focused, reviewed work. The human submitting the pull
request is responsible for every line, test result, license/copyright implication,
and follow-up. Disclose material AI assistance in the PR template; do not submit
unreviewed bulk-generated changes or claim tests you did not run.
