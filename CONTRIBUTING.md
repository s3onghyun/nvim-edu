# Contributing to nvim-edu / 기여 가이드

[한국어](#한국어) | [English](#english)

---

## 한국어

`nvim-edu`에 새로운 연습 레벨이나 기능을 제안하고 기여해주셔서 감사합니다!

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

---

## English

Thank you for contributing new levels and improvements to `nvim-edu`!

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
   Add the matching `id` under `EN.levels` with English `title` and `desc`.
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
