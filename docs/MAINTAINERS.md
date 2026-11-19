# Maintainer notes

Why CI and deployment work the way they do. How to run the checks locally is in
[CONTRIBUTING.md](../CONTRIBUTING.md); this page does not repeat it.

## The principle: a safe system makes contributions easy

Outside pull requests should be easy to accept. That only works when a pull request cannot reach
anything that matters: the deployed site at https://s3onghyun.github.io/nvim-edu/ and the
repository itself. So the safety lives in the workflow and the review routine, not in trusting each
contributor, and a contributor never needs secrets or special access to get a green run.

## CI (`.github/workflows/deploy.yml`)

- **Triggers:** `push` to `main`, `pull_request` and `workflow_dispatch`. Never `pull_request_target`,
  which would run fork code with the base repository's token and secrets. The workflow uses no
  secrets, so a fork's run has nothing to leak.
- **Least privilege:** the workflow sets `permissions: contents: read`, and the repository's default
  workflow token is read-only too. Only the `deploy` job asks for `pages: write` and `id-token: write`.
- **Pull requests never deploy:** `upload-pages-artifact` runs only on a push to `main` (in the
  chromium leg), and `deploy` runs only on a push to `main`, after `test` and `nvim-diff` pass.
- **SHA-pinned actions:** every `uses:` is pinned to a full commit SHA with the version in a comment.
  Dependabot (`.github/dependabot.yml`) opens weekly updates for the pins and for npm packages.
- **Checks a pull request must pass before merge:** `test (chromium)`, `test (firefox)` and
  `test (webkit)` (each runs `npm test`, `npm run test:en` and `npm run test:zh` with
  `BROWSER` set), and `nvim-diff` (`npm run test:nvim` against Neovim 0.11.0). Cross-browser runs
  catch engine-specific input bugs; `nvim-diff` keeps the emulator honest against real Neovim.

## Approving a fork's CI run

Runs from outside contributors wait for a maintainer's approval. Before approving, read the diff:
the run executes the pull request's code (`npm ci` runs the `postinstall` script, and the tests run
whatever is in `tests/` and `package.json`). It gets only a read-only token and no secrets, but it
should still not be used to run something unrelated.

Look harder at changes to the paths that `.github/CODEOWNERS` marks as security-sensitive:
`.github/`, `package.json`, `package-lock.json`, `vite.config.js` and `patches/`. A level or
translation change should touch only `src/levels/vim-levels.json`, `src/levels.en.js`,
`src/levels.zh-CN.js` (or `src/levels.js` for tmux) and maybe a test.

## Dependency updates

Dependabot groups npm updates into one weekly pull request. Let CI run on all three browsers and
`nvim-diff` before merging: an update to `@replit/codemirror-vim` or its `-core` package can break
the patches in `patches/`, and `patch-package` then fails in `npm ci`.
