# Contributing to nvim-edu / 기여 가이드

[한국어](#한국어) | [English](#english)

---

## 한국어

`nvim-edu`에 새로운 연습 레벨이나 기능을 제안하고 기여해주셔서 감사합니다!

질문과 아이디어는 [Discussions](https://github.com/s3onghyun/nvim-edu/discussions), 버그는 이슈로 남겨 주세요.
보안 문제는 공개 이슈 대신 [SECURITY.md](SECURITY.md) 를 따라 비공개로 알려 주세요.
참여하는 모든 분은 [행동 강령](CODE_OF_CONDUCT.md)을 지켜 주세요.

### 로컬 개발과 테스트

1. Node.js 22 (CI 와 같은 버전) 에서 `npm ci` 를 실행합니다. `postinstall` 이 `patches/` 의 에뮬레이터 수정을 patch-package 로 적용합니다.
2. `npm run dev` 로 개발 서버를 띄웁니다 (http://localhost:5173).
3. 테스트는 `playwright-core` 로 진짜 브라우저를 띄웁니다. `playwright-core` 는 설치할 때 브라우저를 받지 않으므로 한 번 받아 둡니다:
   ```sh
   npx playwright-core install chromium          # firefox webkit 도 같은 방식
   npx playwright-core install --with-deps webkit # Linux 에서 시스템 라이브러리까지 (sudo 필요)
   ```
   브라우저는 저장소가 아니라 사용자 캐시에 저장됩니다 (Linux `~/.cache/ms-playwright`, macOS `~/Library/Caches/ms-playwright`).
4. 검사 명령:
   ```sh
   npm test                  # 단위 테스트 + 빌드 + 모든 레벨·드릴을 브라우저에서 풀이 (기본 chromium)
   npm run test:en           # 영어 화면
   npm run test:zh           # 간체 중국어 화면
   BROWSER=firefox npm test  # BROWSER=chromium|firefox|webkit
   npm run test:nvim         # 실제 Neovim 과 비교 (Neovim 0.11 이 PATH 에 있어야 함, CI 는 0.11.0)
   ```

PR 마다 CI 가 `test (chromium)`, `test (firefox)`, `test (webkit)` (각각 `npm test`, `test:en`, `test:zh`) 와
`nvim-diff` (`test:nvim`) 를 실행합니다. 메인테이너는 diff 를 읽고 네 검사가 모두 초록이 된 뒤 머지합니다. 처음 기여하는 분의 PR 은
메인테이너가 변경 내용을 확인한 뒤 CI 실행을 승인합니다. CI 구성의 이유는 [docs/MAINTAINERS.md](docs/MAINTAINERS.md) 에 있습니다.

### 새로운 레벨 추가하기

Vim 레벨은 코드가 아니라 데이터 파일 **`src/levels/vim-levels.json`** 에 있습니다. 필드 규칙(스키마)은 **`src/levels/schema.js`** 맨 위 주석에 있고, `npm test` 가 이 스키마로 모든 레벨을 검사합니다.

1. **레벨 정의 (`src/levels/vim-levels.json`):**
   배열에 객체 하나를 추가합니다. 배열 순서가 곧 챕터 안에서 게임에 나오는 순서입니다.
   ```json
   {
     "id": "unique-level-id",
     "chapter": "edit",
     "title": "레벨 제목",
     "desc": "설명 문구 (HTML 태그 <b>, <code> 사용 가능)",
     "keys": ["ciw", "C"],
     "lang": "js",
     "start": "const old = \"value\";",
     "cursor": [0, 6],
     "goal": { "text": "const new = \"value\";" },
     "solution": "ciwnew<Esc>"
   }
   ```

   | 필드 | 필수 | 설명 |
   |------|------|------|
   | `id` | ✓ | 소문자·숫자·하이픈. 전체에서 유일 (URL `#id`, `levels.en.js` 키) |
   | `chapter` | ✓ | `move` \| `edit` \| `object` \| `power` \| `real` \| `guru` |
   | `title`, `desc` | ✓ | 한국어 제목·설명. `desc` 는 HTML 허용 |
   | `keys` | ✓ | 이 레벨에서 배우는 키 목록 (문자열 배열) |
   | `lang` | | `js` \| `py` \| `yaml` (구문 강조). 없으면 생략 |
   | `start` | ✓ | 시작 버퍼. 줄바꿈은 `\n` |
   | `cursor` | ✓ | 시작 커서 `[줄, 칸]` (0부터, `start` 안) |
   | `goal` | ✓ | `{ "text": "목표 버퍼" }` (텍스트가 같고 NORMAL 모드면 클리어) 또는 `{ "cursor": [줄, 칸] }` (커서가 그 칸에 오면 클리어) |
   | `solution` | ✓ | 모범 답안 키 시퀀스 (`<Esc>`, `<CR>`, `<C-a>` 표기) |

   > **참고 (tmux 레벨):** `tmux` 챕터 레벨은 Vim 버퍼 대신 터미널 시뮬레이터를 사용하므로 데이터 파일이 아니라 `src/levels.js` 의 `tmuxLevels` 에 `kind: 'tmux'`, `init()`, `checks` 형태로 정의합니다 (`tmux-new` 참조).

2. **영어 번역 추가 (`src/levels.en.js`):**
   `EN.levels` 객체에 동일한 `id`로 영문 텍스트를 등록합니다:
   ```javascript
   'unique-level-id': {
     title: 'Level title in English',
     desc: 'Description in English',
   }
   ```
   간체 중국어도 `src/levels.zh-CN.js` 의 `ZH_CN.levels` 에 같은 `id` 로 `title`, `desc` 를 등록합니다
   (`npm test` 의 `tests/i18n.test.mjs` 가 영어 항목마다 중국어 항목이 있는지 검사). 중국어를 쓰기 어렵다면 PR 에 적어 주세요.

3. **Par(기준 타수) 규칙:**
   - 레벨의 기준 타수(`par`)는 모범 답안 `solution`의 키 수로 자동 계산됩니다.
   - 불필요한 이동이나 잉여 키 입력 없이 Neovim 0.11 및 Vim에서 가장 간결하고 정확한 키 시퀀스를 작성해야 합니다.

4. **검증 및 테스트:**
   - 로컬 개발 서버: `npm run dev`
   - 스키마 + 브라우저 E2E 검증: `npm test`
   - Neovim 실제 실행 검증: `npm run test:nvim` (Neovim 0.11 이 PATH 에 있어야 함)

### 레벨이 틀렸을 때 CI 메시지

모든 메시지에 레벨 `id` 와 실패한 검사가 나옵니다.

| 검사 | 메시지 예 | 고칠 곳 |
|------|------|------|
| 스키마 (`tests/levels-schema.test.mjs`) | `레벨 my-level: cursor [5,0] 가 start 버퍼 밖입니다` | 해당 필드 |
| 에뮬레이터 / 진짜 Vim 풀이 (`levels.e2e`, `real.e2e`) | `FAIL 레벨 my-level [에뮬레이터 풀이]` 다음에 `solution`, `기대 버퍼`/`실제 버퍼`, `기대 커서`/`실제 커서`, 모드 | `solution` 또는 `goal` |
| par/별 | `par/별: 클리어 타수 2 ≠ par 3 (solution 키 수)` | 답안 끝의 남는 키 제거 (중간에 이미 클리어됨) |
| 실제 Neovim 비교 (`nvim-diff`) | `DIFF 레벨:my-level [실제 Neovim 비교]` 다음에 기대(Neovim)/실제(사이트) 버퍼·커서 | 답안이 에뮬레이터에서만 동작함 → 다른 키로 |

### AI 도구를 사용한 기여

AI 도구는 보조 수단으로 써도 됩니다. PR 하나는 한 가지 문제에 집중하고, 제출하는 모든 변경을 직접
검토하고 이해하고 테스트하고 이후에도 책임져 주세요. 코드·테스트·문서·레벨 작성에 AI가 실질적으로
도움을 줬다면 PR 템플릿에 밝혀 주세요.

대량 자동 생성되었거나 검토하지 않은 변경, 라이선스를 알 수 없는 복사 자료, 동작을 설명할 수 없는
변경은 제출하지 마세요. 기여를 제출하면 이 저장소의 MIT 라이선스로 그 기여를 제공할 권리가 있음을
확인하는 것입니다. 유지보수자는 더 작은 PR, 재현 방법, 테스트, 출처를 요청할 수 있습니다.

---

## English

Thank you for contributing new levels and improvements to `nvim-edu`!

Questions and ideas go to [Discussions](https://github.com/s3onghyun/nvim-edu/discussions), bugs to issues.
Report security problems privately as described in [SECURITY.md](SECURITY.md), not in a public issue.
Everyone taking part is expected to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

### Local development and tests

1. Use Node.js 22 (the version CI uses) and run `npm ci`. Its `postinstall` step applies the emulator fixes in `patches/` with patch-package.
2. `npm run dev` starts the dev server at http://localhost:5173.
3. The tests drive real browsers through `playwright-core`, which does not download browsers on install. Fetch them once:
   ```sh
   npx playwright-core install chromium          # same for firefox and webkit
   npx playwright-core install --with-deps webkit # on Linux, also the system libraries (needs sudo)
   ```
   Browsers go to your user cache, not the repository (`~/.cache/ms-playwright` on Linux, `~/Library/Caches/ms-playwright` on macOS).
4. Checks:
   ```sh
   npm test                  # unit tests + build + solve every level and drill in a browser (chromium by default)
   npm run test:en           # English UI
   npm run test:zh           # Simplified Chinese UI
   BROWSER=firefox npm test  # BROWSER=chromium|firefox|webkit
   npm run test:nvim         # compare with real Neovim (Neovim 0.11 on your PATH; CI uses 0.11.0)
   ```

On every pull request CI runs `test (chromium)`, `test (firefox)` and `test (webkit)` (each runs `npm test`,
`test:en` and `test:zh`) plus `nvim-diff` (`test:nvim`); the maintainer merges after reading the diff and seeing all four green. For a
first-time contributor, a maintainer approves the CI run after looking at the diff. Why CI is set up this way:
[docs/MAINTAINERS.md](docs/MAINTAINERS.md).

### Adding a New Level

Vim levels live in a data file, **`src/levels/vim-levels.json`**, not in code. The field rules (schema) are documented at the top of **`src/levels/schema.js`**, and `npm test` validates every level against it.

1. **Add the level to `src/levels/vim-levels.json`:**
   Append one object (same shape as the Korean example above). Array order is the order the levels appear within a chapter.

   | Field | Required | Meaning |
   |------|------|------|
   | `id` | ✓ | lowercase letters, digits, hyphens; unique (URL `#id`, key in `levels.en.js`) |
   | `chapter` | ✓ | `move` \| `edit` \| `object` \| `power` \| `real` \| `guru` |
   | `title`, `desc` | ✓ | Korean title and description; `desc` may contain HTML |
   | `keys` | ✓ | keys taught by the level (array of strings) |
   | `lang` | | `js` \| `py` \| `yaml` for syntax highlighting; omit otherwise |
   | `start` | ✓ | starting buffer, `\n` between lines |
   | `cursor` | ✓ | starting cursor `[line, col]`, 0-based, inside `start` |
   | `goal` | ✓ | `{ "text": "..." }` (clears when the text matches in NORMAL mode) or `{ "cursor": [line, col] }` (clears when the cursor reaches it) |
   | `solution` | ✓ | reference key sequence (`<Esc>`, `<CR>`, `<C-a>` notation) |

   > **Note on tmux levels:** Levels in the `tmux` chapter use a terminal simulator rather than a Vim buffer, so they stay in `src/levels.js` (`tmuxLevels`) with `kind: 'tmux'`, `init()`, and `checks: [...]` (see `tmux-new`).
2. **Add English translation in `src/levels.en.js`:**
   Add the matching `id` under `EN.levels` with English `title` and `desc`, and the same under `ZH_CN.levels` in
   `src/levels.zh-CN.js` in Simplified Chinese (`tests/i18n.test.mjs` in `npm test` checks every English entry has one).
   If you cannot write Chinese, say so in the pull request.
3. **Par rules:**
   The level's par is the number of keys in `solution`. Make it the canonical, optimal key sequence for Neovim 0.11 and Vim.
4. **Automated Verification:**
   Run `npm test` (schema + browser solve checks) and `npm run test:nvim` (real Neovim 0.11 on your PATH).

### CI messages when a level is wrong

Every message names the level `id` and the check that failed.

| Check | Example | Fix |
|------|------|------|
| Schema (`tests/levels-schema.test.mjs`) | `레벨 my-level: cursor [5,0] 가 start 버퍼 밖입니다` (cursor outside `start`) | the named field |
| Emulator / real Vim solve (`levels.e2e`, `real.e2e`) | `FAIL 레벨 my-level [에뮬레이터 풀이]` followed by `solution`, expected/actual buffer (`기대 버퍼`/`실제 버퍼`), cursor, and mode | `solution` or `goal` |
| Par / stars | `par/별: 클리어 타수 2 ≠ par 3` (cleared after 2 keys, par is 3) | drop trailing keys; the level clears early |
| Real Neovim diff (`nvim-diff`) | `DIFF 레벨:my-level [실제 Neovim 비교]` followed by expected (Neovim) vs actual (site) buffer and cursor | the solution only works in the emulator; use other keys |

### AI-assisted contributions

AI tools may be used as an aid. Please keep each pull request focused and review,
understand, test, and maintain every change you submit. If AI materially helped write
code, tests, documentation, or a level, disclose that in the pull-request template.

Do not submit bulk-generated or unreviewed changes, copied material with an unknown
license, or a change whose behavior you cannot explain. By submitting a contribution,
you confirm that you have the right to contribute it under this repository's MIT
license. Maintainers may ask for a smaller PR, reproduction, tests, or provenance.
