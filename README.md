# nvim-edu

**English** · [简体中文](README.zh-CN.md) · [한국어](README.ko.md)

Learn Vim / Neovim **and tmux** keys right in your browser — no install, no config.
Like [LearnGitBranching](https://learngitbranching.js.org/), you see the **goal state** and close the gap with your keyboard.

> 💡 [Ideas / 문의 / 建议](https://github.com/s3onghyun/nvim-edu/discussions)

**▶ https://s3onghyun.github.io/nvim-edu/**

![A boss level: apply an AI code review with :g, :%s, dd, cw and .](docs/level-en.png)

When you run AI coding agents (Claude Code, Codex, …) in a terminal, the editing you still do by hand happens in Neovim and tmux.
This site trains exactly those keys until your fingers remember them.

## What's inside

| Mode | |
|------|------|
| **Levels** (41) | Motions → editing → text objects → visual & macros → real-world cleanup (`:%s`, `:g`, applying an AI code review) → **tmux** → **guru combos** (code, logs, config, docs: `*` `n` `.`, `:v`, `:sort u`, `:g`+`:norm`, regex groups, macro + Ctrl-a). Each chapter shows a difficulty badge (Beginner → Intermediate → Advanced → Guru) in the file tree and help panel. ★1–3 based on keystrokes vs. par |
| **Step-by-step replay** | After clearing a level (or from "Solution"), your keys and the reference solution are split into Vim commands and replayed: key → meaning → resulting line, so you can see where the extra keys went |
| **tmux chapter** | Only the keys a human still types while an agent runs: sessions, splits, pane moves, zoom, copy mode to scroll and copy errors, windows, detach/attach, switching sessions |
| **Drills** | 10 random tasks in a row (motion, delete, change, tmux). Best time and keystrokes are saved |
| **Daily challenge** | Date-seeded, so everyone gets the same tasks that day. Keeps a 🔥 streak |
| **Free practice** | No goal, just practice |
| **Real Vim mode** (beta) | Solve the same levels in an actual Vim 8.2 running in the browser ([vim.wasm](https://github.com/rhysd/vim.wasm)), configured with Neovim defaults (`nostartofline`, `nrformats=bin,hex`, `Y`=`y$`, …) |
| **Real Neovim mode** (beta) | Solve the same levels in an actual Neovim (0.12-dev, WebAssembly) running in the browser with its own defaults, thanks to [nvim-wasm](https://github.com/MuNeNiCK/nvim-wasm). Downloaded only when you open it (about 2.9MB compressed the first time); works in Chrome, Firefox, Edge and Safari. Small touch screens get a notice first and can stay on the emulator |

Neovim-style UI: neo-tree sidebar, bufferline, lualine, cmdline messages, relative line numbers, `~` past the end of the buffer,
`:colorscheme tokyonight | catppuccin | gruvbox | tokyonight-day`.

Habit training: arrow keys are blocked in chapter 1 (motions) and the motion drill, the mouse is blocked; typing with a non-Latin input method (Korean, Japanese, Chinese IME) in NORMAL mode shows a hint.

Languages: English, Korean and Simplified Chinese. Picked from `?lang=en|ko|zh-CN` (`zh` also works), then your saved choice, then the browser language (any `zh*` locale, including `zh-TW`/`zh-HK`, gets Simplified Chinese).

## Privacy and analytics

This site uses cookie-free [GoatCounter](https://www.goatcounter.com/) analytics. It records page views and only aggregate product events (a level or drill finished, opening real Vim or real Neovim mode, and a Korean/English/Chinese language change); it never sends keystrokes, solutions, or other text you enter. Analytics is disabled when Do Not Track or Global Privacy Control is enabled. Separately, the main page loads its fonts (JetBrains Mono and Nanum Gothic Coding) from Google Fonts, so Google receives your IP address and browser details on each visit, whatever your Do Not Track or Global Privacy Control setting; the real Vim and real Neovim pages do not load them.

## Does it behave like real Neovim?

Levels run on the [@replit/codemirror-vim](https://github.com/replit/codemirror-vim) emulator for speed, and **real Neovim is the reference**:

- `tests/nvim-diff.mjs` feeds the same keys (common commands from `:help` plus every level solution, 180 cases) into `nvim --headless` and into the site's editor, then compares text, cursor and mode. CI runs it on every push with Neovim 0.11.0.
- It started at 130/169 matching. After fixing the emulator, it is **180/180**. The fixes live in `patches/` (applied by patch-package).
- `tests/nvim.e2e.mjs` also solves every Vim level, with exactly the par keystrokes, in the real Neovim of the Real Neovim mode, in Chromium, Firefox and WebKit.

```bash
npm run test:nvim   # needs nvim on PATH
```

## Development

```bash
npm ci                                # Node.js 22, same as CI
npx playwright-core install chromium  # one-time browser download for the tests
npm run dev       # http://localhost:5173
npm test          # build, then solve every level and drill in a real Chromium
npm run test:en   # English UI: every level, plus a scan that no Korean text is left
npm run test:zh   # Simplified Chinese UI: the same, plus no `undefined` or raw data-* text
```

`npm test` needs the Playwright browser downloaded above (on Linux, `npx playwright-core install --with-deps chromium` also installs the system libraries). Run with `BROWSER=firefox` or `BROWSER=webkit` for other engines.

## Project layout

| File | Purpose |
|------|------|
| `src/levels/vim-levels.json` | Vim level data (schema in `src/levels/schema.js`, checked by `npm test`). `solution` is both the reference answer and the par |
| `src/levels.js` | Loads the Vim levels, tmux levels, chapters |
| `src/levels.en.js` | English text for levels (same ids) |
| `src/levels.zh-CN.js` | Simplified Chinese text for levels (same ids, applied on top of the English text) |
| `src/i18n.js` | Language selection and the language menu; `t('한국어', 'English', '中文')` for inline strings (missing Chinese falls back to English) |
| `src/drill.js` | Drill task generators |
| `src/tmux.js` | tmux simulator (pure state machine: session/window/pane tree, prefix keys, vi copy mode, a tiny shell) |
| `src/tmux-view.js` | tmux state → HTML |
| `src/main.js` | Editor ([CodeMirror 6](https://codemirror.net/) + codemirror-vim), scoring, UI |
| `src/analytics.js` | Cookie-free GoatCounter page views and events; skipped under Do Not Track / GPC |
| `src/real.js`, `real/index.html` | Real Vim mode. State comes from Vim's `titlestring` (injecting commands from JS mid-command freezes Vim) |
| `src/nvim.js`, `nvim/index.html` | Real Neovim mode: a UI client attached over msgpack-RPC. State comes from Neovim (`SafeState`/`ModeChanged` → `rpcnotify`) |
| `src/nvim-worker.js`, `src/nvim-grid.js` | Runs nvim-wasm in a Web Worker (WASI, adapted from nvim-wasm's Asyncify demo); draws Neovim's UI grid |
| `src/real-level.js` | Level screen shared by the real Vim and real Neovim pages (goal, keystrokes, clear check) |
| `vendor/nvim-wasm/` | Pinned, unmodified nvim-wasm files; source commit and SHA-256 in its README |
| `patches/` | Emulator fixes to match real Neovim |
| `tests/` | `nvim-diff` (vs. real Neovim), `regress` (bugs found in real use), `levels`, `real`, `nvim` (lazy loading, fallback, every level in real Neovim), `vendor` (hashes and license notices), `i18n`, `tmux`, `analytics`, `levels-schema` (level data schema), `level-report` (readable per-level failure messages) |

## Adding a level

Add one object to `src/levels/vim-levels.json` (its English text to `src/levels.en.js` and its Chinese text to `src/levels.zh-CN.js`):

```json
{
  "id": "my-level", "chapter": "edit", "title": "제목",
  "desc": "Description (HTML)", "keys": ["dd"], "lang": "js",
  "start": "first\nsecond", "cursor": [0, 0],
  "goal": { "text": "first" },
  "solution": "jdd"
}
```

`goal` is `{ "text": ... }` or `{ "cursor": [line, col] }`; `solution` uses `<Esc> <CR> <C-a>` notation and its key count is the par.

`npm test` checks that the solution really clears the level, in the emulator, in real Vim and in real Neovim. See [CONTRIBUTING.md](CONTRIBUTING.md) for step-by-step instructions and par guidelines. PRs welcome!

## Contributing

New contributors are welcome. Pick a [`good first issue`](https://github.com/s3onghyun/nvim-edu/issues?q=is%3Aopen+label%3A%22good+first+issue%22) (each lists the files, commands and done criteria), comment to claim it, and a maintainer assigns it to you. CI runs on every pull request, including from forks (read-only, no secrets, never deploys). Setup, tests and level rules: [CONTRIBUTING.md](CONTRIBUTING.md).

## Known limitations

- Vim behavior comes from an emulator; differences against real Neovim are tracked by `tests/nvim-diff.mjs`.
- The tmux simulator mimics the default key bindings only (no `C-b :` command prompt, mouse or resizing).
- Real Vim mode needs `SharedArrayBuffer`. GitHub Pages cannot send COOP/COEP headers, so [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) adds them, which **does not work reliably in Safari** (a notice is shown). It downloads about 0.8MB (compressed) the first time; the Vim runtime is trimmed to the files the levels need at build time. Extremely fast input (0 ms between keys, as in automation) can be reordered by vim.wasm; human typing speed (40 ms+) was fine.
- Real Neovim mode uses nvim-wasm's Asyncify build, so it needs no `SharedArrayBuffer` and no COOP/COEP headers. To keep the download small, the build drops Neovim's documentation (`:help` is not available), spell files and syntax files for languages the levels do not use. Filetype plugins and indent scripts are off, as on the real Vim page, so levels behave as in `tests/nvim-diff`. nvim-wasm cannot list directories, so anything Neovim finds by globbing does not load (built-in plugins such as matchparen, `:colorscheme`, `:packadd`); the build leaves those files out, and `src/nvim.js` loads Lua modules and syntax files by exact path. There is no system clipboard (`"+`) or tree-sitter parser. It needs WebAssembly exception handling (recent Chrome, Firefox, Edge, Safari).
- A physical keyboard is required (no touch input).
- Progress is stored only in your browser's localStorage.

## License

MIT. The Real Neovim mode redistributes [nvim-wasm](https://github.com/MuNeNiCK/nvim-wasm) (MIT, © MuNeNiCK, who kindly allowed embedding it) and [Neovim](https://neovim.io/) (Apache-2.0, with parts under the Vim license) together with the libraries bundled in it; see [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt).
