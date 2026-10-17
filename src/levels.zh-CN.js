// Simplified Chinese text for levels. Same ids and shape as src/levels.en.js; it is applied on top of EN,
// so a field missing here (practice text start/goal, untranslated keys) stays English.
// checks: labels only, in the same order as levels.js. Key names, commands and <kbd>/<code>/<b> markup stay as in EN.

export const ZH_CN = {
  chapters: {
    move: '1. 移动',
    edit: '2. 编辑',
    object: '3. 文本对象',
    power: '4. 可视模式 · 宏',
    real: '5. 实战：打磨 AI 写的代码',
    tmux: '6. tmux：AI 终端必备按键',
    guru: '7. 大师：实战组合技',
  },
  levels: {
    hjkl: {
      title: '用 hjkl 移动',
      desc: '用 <b>h</b>(←) <b>j</b>(↓) <b>k</b>(↑) <b>l</b>(→) 代替方向键。前面加数字可以重复移动（<b>4l</b> = 向右 4 格）。移到高亮的格子。',
      keys: ['h', 'j', 'k', 'l', '数字 + 移动'],
    },
    word: {
      title: '按单词跳：w b e',
      desc: '<b>w</b> 下一个单词开头，<b>b</b> 上一个单词开头，<b>e</b> 单词结尾。比一个字符一个字符地挪快多了。移到 <code>getUser</code>。',
    },
    'line-ends': {
      title: '行首与行尾：0 ^ $',
      desc: '<b>0</b> 行的最开头，<b>^</b> 第一个非空白字符，<b>$</b> 行尾。移到这一行的末尾。',
    },
    'file-jump': {
      title: '文件内跳转：gg G',
      desc: '<b>gg</b> 文件顶部，<b>G</b> 文件底部，<b>9G</b> 第 9 行。跳到第 9 行。',
    },
    'find-char': {
      title: '查找字符：f t',
      desc: '<b>f(</b> 跳到本行下一个 <code>(</code>，<b>t(</b> 停在它前一格。<b>;</b> 重复，<b>2f(</b> 跳到第二个。移到 <code>isAdmin(</code> 的括号上。',
    },
    match: {
      title: '配对括号：%',
      desc: '<b>%</b> 跳到与之配对的括号。移到函数块的结尾。',
    },
    search: {
      title: '搜索：/ n',
      desc: '<b>/关键词</b> 再按 <b>Enter</b> 搜索，<b>n</b> 下一个匹配，<b>N</b> 上一个匹配。移到 <code>TODO</code>。',
    },
    x: {
      title: '删除字符：x',
      desc: '<b>x</b> 删除光标下的字符。修好这两个拼写错误。',
    },
    insert: {
      title: '插入模式：i a A o',
      desc: '<b>i</b> 在光标前，<b>a</b> 在光标后，<b>A</b> 在行尾，<b>o</b> 在下方新开一行。<b>Esc</b> 回到 NORMAL 模式。补上分号，再在下面加一行日志。',
    },
    dd: {
      title: '删除整行：dd',
      desc: '<b>dd</b> 删除一整行。删掉这两行调试日志。',
    },
    'cw-dot': {
      title: '用 cw 改单词，用 . 重复',
      desc: '<b>cw</b> 删除单词并进入插入模式。<b>.</b> 原样重复上一次修改。把两处 <code>lenght</code> 拼写错误都改掉。',
    },
    yank: {
      title: '复制 yy · 粘贴 p · Ctrl-a',
      desc: '<b>yy</b> 复制（yank）当前行，<b>p</b> 粘贴到下方。<b>Ctrl-a</b> 把光标处或光标之后的数字加一。',
    },
    'ci-quote': {
      title: '修改引号里的内容：ci"',
      desc: '<b>c</b>（change）+ <b>i"</b>（引号内部）。光标在同一行引号前面也照样管用。把字符串改成 <code>Hello Vim</code>。',
    },
    'di-paren': {
      title: '删除括号里的内容：di(',
      desc: '<b>di(</b> 删除括号里的全部内容。先用 <b>f(</b> 跳过去。',
    },
    df: {
      title: '删除到某处：df dt',
      desc: '<b>df.</b> 删到下一个 <code>.</code>（连它一起）；<b>dt.</b> 停在它前面。动词 + 移动 = 命令：这就是 Vim 语法的核心。',
    },
    dap: {
      title: '删除段落：dap',
      desc: '<b>ap</b> 的意思是“一个段落（连同空行）”。用 <b>dap</b> 删掉中间那一节。',
    },
    'visual-indent': {
      title: '按行选择 V，缩进 >',
      desc: '用 <b>V</b> 选中行，用 <b>></b> 缩进。把 YAML 的缩进修好。',
    },
    'block-insert': {
      title: '用 Ctrl-v 一次注释多行',
      desc: '<b>Ctrl-v</b> 选中一个竖直的块。按 <b>I</b> 输入，再按 <b>Esc</b>，每一行都会出现同样的文字。',
    },
    macro: {
      title: '宏：qa … q, @a',
      desc: '<b>qa</b> 开始录制，<b>q</b> 停止。<b>@a</b> 回放，<b>2@a</b> 回放两次。诀窍：录制时改好一行，然后移到下一行。',
    },
    substitute: {
      title: '全文替换：:%s',
      desc: '<b>:%s/old/new/g</b> 在整个文件里替换。把 AI 写的过时 <code>var</code> 改成 <code>const</code>。',
    },
    'global-delete': {
      title: '删除匹配的行：:g',
      desc: '<b>:g/pattern/d</b> 删除所有匹配的行。清理 AI 到处留下的 <code>console.log</code>。',
    },
    boss: {
      title: 'Boss：落实 AI 代码评审',
      desc: '评审意见：① 删掉 DEBUG 打印 ② 把 <code>tot</code> 重命名为 <code>total</code>。学过的招数随便用。',
    },

    'tmux-new': {
      title: '创建会话：tmux new',
      desc: 'AI 代理一跑就是很久。把它放进 <b>tmux 会话</b>里运行，终端窗口关了它也还活着。输入 <code>tmux new -s agent</code> 然后按 Enter。',
      keys: ['tmux new -s 名称', 'tmux ls'],
      checks: ['进入 <code>agent</code> 会话'],
    },
    'tmux-split': {
      title: '分屏：C-b % 和 C-b "',
      desc: 'tmux 的按键都要先按 <b>prefix</b> <kbd>Ctrl-b</kbd>，松开后再按下一个键。<b>C-b %</b> 左右分屏，<b>C-b "</b> 上下分屏。左边放代理，右边放上下两个 shell。',
      checks: ['布局：代理 | 上下两个 shell'],
    },
    'tmux-nav': {
      title: '切换 pane：C-b + 方向键',
      desc: '<b>C-b ←↑↓→</b> 移到相邻的 pane。<b>C-b o</b> 下一个 pane，<b>C-b ;</b> 上一个用过的 pane，<b>C-b q</b> 显示编号，按数字就能跳过去。移到代理所在的 pane。',
      checks: ['代理 pane 处于活动状态'],
    },
    'tmux-zoom': {
      title: '放大：C-b z',
      desc: '窄 pane 里代理的输出看不清时，<b>C-b z</b> 让这个 pane 占满整个屏幕。再按一次恢复原样。移到代理 pane 并放大。',
      checks: ['代理 pane 处于活动状态', '已放大（状态栏有 Z）'],
    },
    'tmux-scroll': {
      title: '向上翻看输出：C-b [',
      desc: 'tmux 里默认不能用鼠标滚轮翻页。<b>C-b [</b> 进入 <b>copy mode</b>，就能用 vim 键浏览输出：<b>k j</b>、<b>C-u C-d</b>、<b>g</b> 顶部、<b>G</b> 底部、<b>q</b> 退出。移到代理输出的最顶部。',
      checks: ['在代理 pane 的 copy mode 中，光标位于第一行'],
    },
    'tmux-copy': {
      title: '复制报错，粘贴到旁边的 shell',
      desc: '想亲自搜一下代理吐出的报错，就得先复制。<b>C-b [</b> → <b>?Error</b> Enter（向上搜索）→ <b>Space</b> 开始选择 → <b>$</b> 到行尾 → <b>Enter</b> 复制。再移到右边的 shell，用 <b>C-b ]</b> 粘贴。（<code>v</code>/<code>y</code> 也可以，这是很常见的 .tmux.conf 配置。）',
      checks: ["右边 shell 的输入行里有 <code>Cannot find module 'zod'</code>"],
    },
    'tmux-window': {
      title: '窗口就是标签页：C-b c, C-b ,',
      desc: 'pane 太多时就加一个 <b>窗口</b>（标签页）。<b>C-b c</b> 新建窗口，<b>C-b ,</b> 重命名（用 <b>C-u</b> 清掉旧名字）。新建一个名为 <code>test</code> 的窗口。',
      checks: ['2 个窗口', '当前窗口名为 <code>test</code>'],
    },
    'tmux-window-jump': {
      title: '按编号跳窗口：C-b 0–9',
      desc: '状态栏里 <code>0:claude 1:nvim 2:test</code> 的数字就是窗口编号。<b>C-b 0</b> 直接跳过去。回到代理所在的 0 号窗口。',
      checks: ['0 号窗口'],
    },
    'tmux-detach': {
      title: 'detach 之后再连回来',
      desc: '按 <b>C-b d</b> 离开（detach）后，会话里的代理照样继续干活，SSH 断了也一样。用 <code>tmux a</code>（或 <code>tmux a -t agent</code>）连回来。',
      checks: ['detach', '重新 attach 到 <code>agent</code>'],
    },
    'tmux-session': {
      title: '切换会话：C-b s · C-b ( )',
      desc: '每个项目一个会话，就能并排跑好几个代理。用 <b>C-b s</b> 从列表里选，或者 <b>C-b )</b> 下一个 · <b>C-b (</b> 上一个会话。切到 <code>blog</code> 会话。',
      checks: ['<code>blog</code> 会话'],
    },
    'tmux-kill': {
      title: '关闭 pane：C-b x',
      desc: '用完的 pane 按 <b>C-b x</b> 再按 <b>y</b> 关掉（在 shell 里输入 <code>exit</code> 也行）。关掉右下角的 pane。',
      checks: ['2 个 pane', '代理 pane 还活着'],
    },
    'tmux-boss': {
      title: 'Boss：搭好代理工作台',
      desc: '从零开始全靠自己：创建 <code>work</code> 会话，在里面启动代理（<code>claude</code>），然后在右边开一个 shell pane，把光标留在那里。',
      checks: ['<code>work</code> 会话', '左边 pane 正在运行代理', '右边 shell pane 处于活动状态'],
    },
    'guru-rename': {
      title: '[代码] 只重命名完整单词：* n .',
      desc: '把 <code>user</code> 改名为 <code>member</code>，但 <code>getUser</code> 和 <code>username</code> 不能动。<b>*</b> 按<em>完整单词</em>搜索光标下的词。先用 <b>ciw</b> 改一个，再用 <b>n</b> 跳到下一个、<b>.</b> 重复。',
    },
    'guru-log': {
      title: '[日志] 只保留错误行：:v',
      desc: '<b>:v/pattern/d</b> 和 <b>:g</b> 正好相反：删除<em>不</em>匹配的行。这份代理日志只留下 <code>ERROR</code> 行。',
    },
    'guru-sort': {
      title: '[配置] 排序并去重：:sort u',
      desc: '<b>:sort</b> 给行排序；加上 <b>u</b> 顺便去掉重复。清理一下被反复追加过的 <code>.gitignore</code>。',
    },
    'guru-norm': {
      title: '[配置] 编辑匹配的行：:g + :norm',
      desc: '<b>:g/pattern/norm 按键</b> 在每个匹配的行上执行 NORMAL 模式按键。注释和空行别动，只给带 <code>=</code> 的行加上 <code>export </code>。',
    },
    'guru-capture': {
      title: '[代码] 用正则分组重组：\\( \\) \\1',
      desc: '<b>\\(…\\)</b> 捕获的内容可以在替换里用 <b>\\1</b> <b>\\2</b> 引用。把老式的 <code>assertEqual(a, b)</code> 测试迁移成 <code>expect(a).toBe(b)</code>。',
    },
    'guru-counter': {
      title: '[文档] 自动编号列表：宏 + Ctrl-a',
      desc: '把 <b>yyp</b>（复制一行）和 <b>Ctrl-a</b>（数字加一）录成宏，回放几次，编号就自己填好了。做一个 5 步的列表。',
    },
    'guru-boss': {
      title: 'Boss：一口气修好提交信息',
      desc: '一条代理写的提交信息：① 拼写错误 <code>hanlde</code> → <code>handle</code>（<b>xp</b> 交换两个字符）② issue 编号 <code>#41</code> → <code>#42</code> ③ 把 <code>Closes</code> 那行移到最后（<b>ddp</b> 交换两行）。按键越少越好。',
    },
  },
}
