import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gunzipSync, gzipSync } from 'node:zlib'

const require = createRequire(import.meta.url)
const vimWasmDir = dirname(require.resolve('vim-wasm/package.json'))
const coiDir = dirname(require.resolve('coi-serviceworker/package.json'))

// vim.data 는 Vim 런타임(문법 강조·들여쓰기 등 1000여 개 파일, 5.9MB)을 통째로 묶은 것.
// 레벨 파일 형식(src/real.js 의 ext: js·py·yaml·txt)에 필요한 것만 남기고 vim.js 의 파일 목록도 맞춰 고친다
const LANGS = ['javascript', 'python', 'yaml', 'text']
const KEEP = new RegExp(`/(syntax/(syntax|synload|syncolor|nosyntax|manual)|(syntax|indent|ftplugin)/(${LANGS.join('|')})|autoload/dist/ft)\\.vim$`)
function slimVimPackage() {
  const js = readFileSync(join(vimWasmDir, 'vim.js'), 'utf8')
  const data = readFileSync(join(vimWasmDir, 'vim.data'))
  const re = /loadPackage\(\{files:(\[.*?\]),remote_package_size:(\d+),/
  const m = js.match(re)
  if (!m || Number(m[2]) !== data.length) throw new Error('vim-wasm 패키지 형식이 바뀜: vite.config.js 의 slimVimPackage 확인')
  const chunks = []
  let at = 0
  const files = []
  for (const f of new Function(`return ${m[1]}`)()) {
    if (/\/(syntax|indent|ftplugin|autoload)\//.test(f.filename) && !KEEP.test(f.filename)) continue
    if (f.filename.startsWith('/tutor/')) continue
    chunks.push(data.subarray(f.start, f.end))
    files.push({ ...f, start: at, end: (at += f.end - f.start) })
  }
  if (files.filter((f) => KEEP.test(f.filename)).length < LANGS.length * 2) throw new Error('vim 런타임 파일을 찾지 못함')
  return {
    js: js.replace(re, `loadPackage({files:${JSON.stringify(files)},remote_package_size:${at},`),
    data: Buffer.concat(chunks),
  }
}
const slim = slimVimPackage()

// 진짜 Neovim(nvim-wasm) 모드. vendor/nvim-wasm 은 upstream 파일 그대로라 sha256 이 다르면 빌드를 멈춤 (출처: vendor/nvim-wasm/README.md)
const nvimDir = fileURLToPath(new URL('./vendor/nvim-wasm/', import.meta.url))
const NVIM_SHA256 = {
  'nvim-asyncify.wasm': '0c002380cfe2510ee07948353a017015fb0b369faa86dc7251a192fa0b132012',
  'nvim-runtime.tar.gz': '3a4e21bd812b0e1b3f9e623427dfee5a2e379e9511b9cc8d3dc35ed2387a77af',
}
function readVendored(name) {
  const buf = readFileSync(join(nvimDir, name))
  const sha = createHash('sha256').update(buf).digest('hex')
  if (sha !== NVIM_SHA256[name]) throw new Error(`vendor/nvim-wasm/${name} 의 sha256 이 다름 (${sha}): vendor/nvim-wasm/README.md 확인`)
  return buf
}
// 런타임 tar(5.6MB, 2000여 개 파일)에서 실제로 쓰이는 것만 남김: Lua 런타임 · 문법 강조(레벨 파일 형식) · 파일 형식 감지.
// nvim-wasm 은 디렉터리를 못 읽어서(uv_fs_scandir = ENOSYS) glob 으로 찾는 plugin/ · pack/ · colors/ 는 어차피 못 불러옴 → 뺌.
// 문서(:help) · 맞춤법 사전 · 튜터 · LuaLS 타입 정의(_meta) · 다른 언어 파일도 뺌. 남긴 파일은 바이트 그대로 (THIRD_PARTY_NOTICES.txt)
const NVIM_KEEP = new RegExp(`^(nvim_version\\.lua|runtime/(filetype\\.lua|(ftplugin|ftplugof|indent|indoff|ftoff)\\.vim|lua/(?!uv/|.*/_meta/).*|autoload/dist/.*|syntax/(syntax|synload|syncolor|nosyntax|manual|${LANGS.join('|')})\\.vim))$`)
function slimNvimRuntime() {
  const tar = gunzipSync(readVendored('nvim-runtime.tar.gz'))
  const out = []
  let kept = 0
  for (let at = 0; at + 512 <= tar.length;) {
    const header = tar.subarray(at, at + 512)
    if (header.every((b) => b === 0)) break
    const field = (from, len) => header.subarray(from, from + len).toString('latin1').replace(/\0.*$/s, '')
    const name = [field(345, 155), field(0, 100)].filter(Boolean).join('/').replace(/^\.\//, '')
    const type = String.fromCharCode(header[156] || 48)
    if (type !== '0' && type !== '5') throw new Error(`nvim-runtime.tar.gz 형식이 바뀜 (${type} ${name}): vite.config.js 의 slimNvimRuntime 확인`)
    const end = at + 512 + Math.ceil(parseInt(field(124, 12).trim() || '0', 8) / 512) * 512
    // 디렉터리는 모두 남김 (빈 디렉터리는 몇 바이트)
    if (type === '5' || NVIM_KEEP.test(name)) {
      out.push(tar.subarray(at, end))
      if (type === '0') kept++
    }
    at = end
  }
  if (kept < 100) throw new Error(`nvim 런타임 파일을 찾지 못함 (${kept}개)`)
  out.push(Buffer.alloc(1024))
  return gzipSync(Buffer.concat(out), { level: 9 })
}

// 진짜 Vim(WASM) 모드에 필요한 정적 파일. 워커가 자기 위치 기준으로 vim.wasm/vim.data 를 불러와서 같은 폴더에 둔다
const STATIC = {
  'real/vim-wasm/vim.js': slim.js,
  'real/vim-wasm/vim.wasm': readFileSync(join(vimWasmDir, 'vim.wasm')),
  'real/vim-wasm/vim.data': slim.data,
  // GitHub Pages 는 COOP/COEP 헤더를 못 붙여서, 이 서비스 워커가 /real/ 아래에서만 헤더를 대신 붙임
  'real/coi-serviceworker.js': readFileSync(join(coiDir, 'coi-serviceworker.min.js')),
  // 진짜 Neovim: 워커가 nvim/ 페이지 기준으로 불러옴
  'nvim/nvim-wasm/nvim.wasm': readVendored('nvim-asyncify.wasm'),
  'nvim/nvim-wasm/runtime.tar.gz': slimNvimRuntime(),
  // 배포하는 바이너리(nvim-wasm · Neovim 과 그 의존성)의 라이선스 전문
  'THIRD_PARTY_NOTICES.txt': readFileSync(fileURLToPath(new URL('./THIRD_PARTY_NOTICES.txt', import.meta.url))),
}
const TYPES = { '.js': 'text/javascript', '.wasm': 'application/wasm', '.data': 'application/octet-stream', '.gz': 'application/gzip', '.txt': 'text/plain; charset=utf-8' }

const vimWasmFiles = {
  name: 'vim-wasm-files',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const path = req.url.split('?')[0].replace(/^\//, '')
      if (!STATIC[path]) return next()
      res.setHeader('Content-Type', TYPES[path.slice(path.lastIndexOf('.'))])
      res.end(STATIC[path])
    })
  },
  generateBundle() {
    for (const [fileName, src] of Object.entries(STATIC)) this.emitFile({ type: 'asset', fileName, source: src })
  },
}

// 상대 경로: GitHub Pages(/nvim-edu/) 어디에 올려도 동작
export default defineConfig({
  base: './',
  plugins: [vimWasmFiles],
  build: { rollupOptions: { input: { main: 'index.html', real: 'real/index.html', nvim: 'nvim/index.html' } } },
})
