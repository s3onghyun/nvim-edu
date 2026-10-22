# nvim-edu

**简体中文** · [English](README.md) · [한국어](README.ko.md)

> 💡 [Ideas / 문의 / 建议](https://github.com/s3onghyun/nvim-edu/discussions)

直接在浏览器里练 Vim / Neovim **和 tmux** 快捷键：不用安装，不用配置。
和 [LearnGitBranching](https://learngitbranching.js.org/) 一样，你能看到**目标状态**，再用键盘把差距补上。

**▶ https://s3onghyun.github.io/nvim-edu/**

![Boss 关卡：用 :g、:%s、dd、cw 和 . 落实 AI 代码评审](docs/level-en.png)

在终端里跑 AI 编程代理（Claude Code、Codex 等）时，剩下需要亲手做的编辑都发生在 Neovim 和 tmux 里。
这个网站就专门练这些按键，一直练到手指记住为止。

## 有什么

| 模式 | |
|------|------|
| **关卡**（41 个） | 移动 → 编辑 → 文本对象 → 可视模式与宏 → 实战清理（`:%s`、`:g`、落实 AI 代码评审）→ **tmux** → **大师组合技**（代码、日志、配置、文档：`*` `n` `.`、`:v`、`:sort u`、`:g`+`:norm`、正则分组、宏 + Ctrl-a）。每章在文件树和帮助面板里显示难度徽章（入门 → 中级 → 高级 → 大师）。按键数和标准键数（par）比较，得 ★1–3 |
| **逐步回放** | 通关后（或点“参考答案”），把你的按键和参考答案按 Vim 命令拆开再执行一遍：按键 → 含义 → 结果行，一眼看出多按的键花在了哪里 |
| **tmux 章节** | 只练代理运行时人还得亲手敲的键：会话、分屏、切换 pane、放大、用 copy mode 翻看和复制报错、窗口、detach/attach、切换会话 |
| **练习** | 连续 10 个随机任务（移动、删除、修改、tmux），保存最佳用时和按键数 |
| **每日挑战** | 按日期生成，当天所有人题目相同。记录 🔥 连续天数 |
| **自由练习** | 没有目标，随便练 |
| **真 Vim 模式**（beta） | 在浏览器里运行的真正 Vim 8.2（[vim.wasm](https://github.com/rhysd/vim.wasm)）里解同样的关卡，并按 Neovim 默认值配置（`nostartofline`、`nrformats=bin,hex`、`Y`=`y$` 等） |

Neovim 风格的界面：neo-tree 侧边栏、bufferline、lualine、cmdline 消息、相对行号、缓冲区末尾之后的 `~`、
`:colorscheme tokyonight | catppuccin | gruvbox | tokyonight-day`。

习惯训练：第 1 章（移动）和移动练习里禁用方向键，鼠标也被禁用；在 NORMAL 模式下用非拉丁输入法（中文、日文、韩文 IME）输入时会弹出提示。

语言：英语、韩语和简体中文。依次按 `?lang=en|ko|zh-CN`（也可以写 `zh`）、你保存过的选择、浏览器语言来决定（所有 `zh*` 语言环境，包括 `zh-TW`/`zh-HK`，都显示简体中文）。

## 隐私与统计

本站使用不依赖 Cookie 的 [GoatCounter](https://www.goatcounter.com/) 统计。只记录页面浏览和汇总的产品事件（完成关卡或练习、打开真 Vim 模式、切换韩语/英语/中文）；绝不会发送按键、解法或你输入的其他文本。开启 Do Not Track 或 Global Privacy Control 时不发送统计。

## 和真正的 Neovim 表现一致吗？

为了速度，关卡运行在 [@replit/codemirror-vim](https://github.com/replit/codemirror-vim) 模拟器上，而**以真正的 Neovim 为准**：

- `tests/nvim-diff.mjs` 把同样的按键（`:help` 里的常用命令加上每个关卡的答案，共 180 个用例）分别输入 `nvim --headless` 和网站的编辑器，再比较文本、光标和模式。CI 每次推送都用 Neovim 0.11.0 跑一遍。
- 一开始只有 130/169 一致。修过模拟器之后，现在是 **180/180**。修复都在 `patches/` 里（由 patch-package 应用）。

```bash
npm run test:nvim   # 需要 PATH 里有 nvim
```

## 开发

```bash
npm install
npm run dev       # http://localhost:5173
npm test          # 构建后在真正的 Chromium 里解完每个关卡和练习
npm run test:en   # 英文界面：每个关卡，外加检查没有残留韩文
npm run test:zh   # 简体中文界面：同上，外加检查没有 `undefined` 或原样的 data-* 文本
```

`npm test` 需要一个 Playwright 浏览器：`npx playwright-core install chromium`。用 `BROWSER=firefox` 或 `BROWSER=webkit` 可以换其他引擎。

## 项目结构

| 文件 | 用途 |
|------|------|
| `src/levels/vim-levels.json` | Vim 关卡数据（schema 见 `src/levels/schema.js`，由 `npm test` 检查）。`solution` 既是参考答案也是标准键数 |
| `src/levels.js` | 加载 Vim 关卡、tmux 关卡和章节 |
| `src/levels.en.js` | 关卡的英文文本（相同 id） |
| `src/levels.zh-CN.js` | 关卡的简体中文文本（相同 id，覆盖在英文文本之上） |
| `src/i18n.js` | 语言选择和语言菜单；行内文本用 `t('한국어', 'English', '中文')`（缺中文时回退到英文） |
| `src/drill.js` | 练习任务生成器 |
| `src/tmux.js` | tmux 模拟器（纯状态机：会话/窗口/pane 树、prefix 键、vi copy mode、一个迷你 shell） |
| `src/tmux-view.js` | tmux 状态 → HTML |
| `src/main.js` | 编辑器（[CodeMirror 6](https://codemirror.net/) + codemirror-vim）、计分、界面 |
| `src/analytics.js` | 不依赖 Cookie 的 GoatCounter 页面浏览和事件；Do Not Track / GPC 下跳过 |
| `src/real.js`、`real/index.html` | 真 Vim 模式。状态来自 Vim 的 `titlestring`（命令执行到一半时从 JS 注入命令会让 Vim 卡住） |
| `patches/` | 让模拟器和真正 Neovim 一致的修复 |
| `tests/` | `nvim-diff`（对比真正的 Neovim）、`regress`（实际使用中发现的 bug）、`levels`、`real`、`i18n`、`tmux`、`analytics`、`levels-schema`（关卡数据 schema）、`level-report`（易读的逐关失败信息） |

## 添加关卡

在 `src/levels/vim-levels.json` 里加一个对象（英文文本加到 `src/levels.en.js`，中文文本加到 `src/levels.zh-CN.js`）：

```json
{
  "id": "my-level", "chapter": "edit", "title": "제목",
  "desc": "Description (HTML)", "keys": ["dd"], "lang": "js",
  "start": "first\nsecond", "cursor": [0, 0],
  "goal": { "text": "first" },
  "solution": "jdd"
}
```

`goal` 是 `{ "text": ... }` 或 `{ "cursor": [line, col] }`；`solution` 使用 `<Esc> <CR> <C-a>` 记法，它的按键数就是标准键数。

`npm test` 会在模拟器和真 Vim 里检查答案确实能通关。分步说明和标准键数准则见 [CONTRIBUTING.md](CONTRIBUTING.md)。欢迎 PR！

## 已知限制

- Vim 行为来自模拟器；与真正 Neovim 的差异由 `tests/nvim-diff.mjs` 跟踪。
- tmux 模拟器只模仿默认按键绑定（没有 `C-b :` 命令提示符、鼠标和调整大小）。
- 真 Vim 模式需要 `SharedArrayBuffer`。GitHub Pages 发不了 COOP/COEP 头，所以由 [coi-serviceworker](https://github.com/gzuidhof/coi-serviceworker) 补上，但**在 Safari 里不太可靠**（会显示提示）。首次要下载约 0.8MB（压缩后）；构建时把 Vim 运行时裁剪到关卡用得到的文件。极快的输入（按键间隔 0 ms，比如自动化）可能被 vim.wasm 打乱顺序；人类打字速度（40 ms 以上）没有问题。
- 需要实体键盘（不支持触屏输入）。
- 进度只保存在你浏览器的 localStorage 里。

## 许可证

MIT
