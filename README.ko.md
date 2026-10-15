# nvim-edu

[English](README.md) · **한국어**

브라우저에서 바로 하는 Vim / Neovim 단축키 연습장.
[LearnGitBranching](https://learngitbranching.js.org/) 처럼 **목표 상태를 보고 그 차이를 키보드로 메우는** 방식입니다.

**▶ https://s3onghyun.github.io/nvim-edu/**

![보스 레벨: AI 코드 리뷰를 :g, :%s, dd, cw, . 로 반영하기](docs/level-ko.png)

AI 에이전트(Claude Code, Codex …)를 tmux · 터미널에서 돌리다 보면 결국 손이 가는 건 Neovim입니다.
설치나 설정 없이 손가락에 모션을 익히는 게 목표입니다.

## 무엇을 할 수 있나

| 모드 | 내용 |
|------|------|
| **레벨** (41개) | 이동 → 편집 → 텍스트 오브젝트 → 비주얼·매크로 → 실전(`:%s`, `:g`, AI 코드 리뷰 반영) → **tmux** → **구루 콤보**(코드·로그·설정·문서: `*` `n` `.`, `:v`, `:sort u`, `:g`+`:norm`, 정규식 그룹, 매크로+Ctrl-a). 챕터마다 파일 트리와 도움말에 난이도 배지(초보 → 중급 → 고급 → 구루) 표시. 모범 답안 타수(par) 대비 ★1~3 |
| **풀이 해설** | 클리어 후(또는 "모범 답안"에서) 내 키와 모범 답안을 Vim 명령 단위로 끊어 다시 실행: 키 → 뜻 → 결과 줄. 어디서 타수를 더 썼는지 바로 보임 |
| **tmux 챕터** | AI 에이전트를 터미널에서 돌릴 때 사람이 직접 쳐야 하는 키만: 세션 생성, 화면 분할, pane 이동, zoom, copy mode 로 출력 스크롤·에러 복사, 윈도우, detach/attach, 세션 전환 |
| **미션** | 이동·삭제·변경·tmux 과제를 랜덤으로 10라운드 연속. 시간·타수 최고 기록 |
| **오늘의 미션** | 날짜 시드라 모두 같은 문제. 연속 일수(🔥) 기록 |
| **자유 연습장** | 목표 없이 아무거나 |
| **진짜 Vim 모드** (beta) | 브라우저 안에서 실제 Vim 8.2([vim.wasm](https://github.com/rhysd/vim.wasm))로 같은 레벨을 풂. Neovim 기본값(`nostartofline`, `nrformats=bin,hex`, `Y`=`y$` …)으로 맞춤 |

Neovim 같은 화면: neo-tree 사이드바, bufferline, lualine, cmdline 메시지, 상대 줄 번호, `~`,
`:colorscheme tokyonight | catppuccin | gruvbox | tokyonight-day`.

습관 교정: 1장(이동)·이동 미션에선 방향키 차단, 마우스 차단, NORMAL 모드에서 한글 IME 로 입력하면 "한/영 전환" 안내.

## 개인정보·분석

이 사이트는 쿠키 없는 [GoatCounter](https://www.goatcounter.com/) 분석을 사용합니다. 페이지 조회와 레벨·미션 완료, 진짜 Vim 모드 열기, 한국어/영어 언어 변경 같은 집계 이벤트만 기록하며, 입력한 키·풀이·그 밖의 텍스트는 전송하지 않습니다. Do Not Track 또는 Global Privacy Control을 켜면 분석을 보내지 않습니다.

## 개발

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # 빌드 후 모든 레벨/미션을 실제 Chromium 으로 풀어서 검증
npm run test:en  # 영어 화면: 모든 레벨 + 화면에 한글이 남지 않았는지
```

`npm test` 는 Playwright 브라우저가 필요합니다: `npx playwright-core install chromium`
(이미 받아 둔 Chrome 이 있으면 `CHROME_PATH=/path/to/chrome npm test`).

## 실제 Neovim 과 같은가?

빠른 레벨은 [@replit/codemirror-vim](https://github.com/replit/codemirror-vim) 에뮬레이터로 돌고, 차이는 **실제 Neovim 을 정답지로** 잡아 냅니다.

- `tests/nvim-diff.mjs` 가 같은 키 입력(`:help` 의 자주 쓰는 명령 + 모든 레벨 답안, 180개)을 `nvim --headless` 와 사이트 에디터에 넣고 텍스트·커서·모드를 비교합니다. CI 에서 Neovim 0.11.0 으로 매번 실행합니다.
- 처음엔 169개 중 39개가 달랐고, 에뮬레이터를 고쳐 지금은 **180/180 일치**합니다. 수정 내용은 `patches/` (patch-package) 에 있습니다.

```bash
npm run test:nvim   # nvim 이 PATH 에 있어야 함
```

## 구조

| 파일 | 역할 |
|------|------|
| `src/i18n.js`, `src/levels.en.js` | 한국어/영어. `?lang=en` 또는 브라우저 언어(한국어가 아니면 영어) |
| `src/levels/vim-levels.json` | Vim 레벨 데이터 (스키마는 `src/levels/schema.js`, `npm test` 가 검사). `solution` 이 모범 답안이자 par(기준 타수) |
| `src/levels.js` | Vim 레벨 불러오기, tmux 레벨, 챕터 |
| `src/tmux.js` | tmux 시뮬레이터 (순수 상태 머신: 세션/윈도우/pane 트리, prefix 키, vi copy mode, 미니 쉘) |
| `src/tmux-view.js` | tmux 상태 → 화면 |
| `src/drill.js` | 미션 라운드 생성기 (이동/줄 삭제/단어 삭제/단어 변경/괄호·따옴표 안 비우기) |
| `src/analytics.js` | 쿠키 없는 GoatCounter 페이지 조회·이벤트 집계 (Do Not Track / GPC 면 보내지 않음) |
| `src/real.js`, `real/index.html` | 진짜 Vim 모드. 상태는 Vim 의 `titlestring` 으로 받음 (명령 도중 JS 가 끼어들면 Vim 이 멈춤) |
| `patches/` | 에뮬레이터 수정 (실제 Neovim 과 맞추기) |
| `src/main.js` | 에디터([CodeMirror 6](https://codemirror.net/) + [@replit/codemirror-vim](https://github.com/replit/codemirror-vim)), 채점, UI |
| `src/style.css` | 컬러스킴 토큰 + nvim 스타일 레이아웃 |
| `tests/levels-schema.test.mjs`, `tests/level-report.test.mjs` | 레벨 데이터 스키마 검사, 레벨별 실패 메시지가 읽기 쉬운지 확인 (`node --test`) |
| `tests/tmux.test.mjs` | tmux 상태 머신 단위 테스트 + 모든 tmux 레벨 답안 검증 (`node --test`) |
| `tests/nvim-diff.mjs` | 실제 Neovim 과 비교 |
| `tests/regress.e2e.mjs` | 실사용에서 나온 버그 재발 방지 (undo, 한글 IME 등) |
| `tests/real.e2e.mjs` | 진짜 Vim 모드로 모든 레벨을 풀어 봄 |
| `tests/levels.e2e.mjs` | 모든 레벨 답안·미션 150라운드를 실제 키 입력으로 검증 |
| `tests/analytics.e2e.mjs` | 분석 이벤트 호출 위치와 Do Not Track 시 미전송 확인 |

## 레벨 추가하기

`src/levels/vim-levels.json` 에 객체 하나를 추가하면 됩니다 (영어 문구는 `src/levels.en.js`).

```json
{
  "id": "my-level", "chapter": "edit", "title": "제목",
  "desc": "설명 (HTML 가능)", "keys": ["dd"], "lang": "js",
  "start": "첫 줄\n둘째 줄", "cursor": [0, 0],
  "goal": { "text": "첫 줄" },
  "solution": "jdd"
}
```

`goal` 은 `{ "text": ... }` 또는 `{ "cursor": [줄, 칸] }`, `solution` 은 `<Esc> <CR> <C-a>` 표기이고 키 수가 곧 par 입니다.

`npm test` 가 그 답안으로 실제로 클리어되는지 확인해 줍니다. 자세한 단계 및 par 가이드는 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요. PR 환영합니다.

## 알려진 한계

- Vim 동작은 `@replit/codemirror-vim` 에뮬레이션이라 실제 Neovim 과 일부 다를 수 있습니다.
- tmux 는 기본 키 바인딩만 흉내 낸 시뮬레이터입니다 (`C-b :` 명령 프롬프트, 마우스, 리사이즈 미지원).
- 진짜 Vim 모드는 키를 아주 빠르게(키 사이 0ms, 자동 입력 수준) 넣으면 순서가 섞이는 경우가 있습니다. 사람 속도(40ms 이상)에서는 문제없었습니다.
- 진짜 Vim 모드는 `SharedArrayBuffer` 가 필요합니다. GitHub Pages 는 COOP/COEP 헤더를 못 붙여서 [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) 로 우회하는데, **Safari 에서는 이 우회가 안정적으로 동작하지 않아** 안내 문구가 뜹니다 (헤더를 붙일 수 있는 호스팅으로 옮기면 해결). 첫 로딩에 약 0.8MB(압축 기준)를 받습니다. 빌드할 때 Vim 런타임에서 레벨에 필요한 파일만 남깁니다.
- 물리 키보드가 필요합니다 (모바일 터치 입력 미지원).
- 진행 상황은 브라우저 localStorage 에만 저장됩니다.

## License

MIT
