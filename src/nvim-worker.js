// 진짜 Neovim(nvim-wasm) 워커: WASI 로 Neovim 을 돌리고 stdin/stdout(msgpack-rpc)을 메인 스레드와 이어 준다.
// Asyncify 빌드라 SharedArrayBuffer · COOP/COEP 없이 동작 (GitHub Pages 는 헤더를 못 붙임)
//
// Adapted from nvim-wasm examples/demo-asyncify/nvim-worker.js
// https://github.com/MuNeNiCK/nvim-wasm (commit 19e393b62e280a9abfa24f51ed6a21359408cb1a)
// MIT License, Copyright (c) 2025 MuNeNiCK. See THIRD_PARTY_NOTICES.txt.
// Changes: browser_wasi_shim from npm instead of a CDN, gzip via DecompressionStream instead of fflate,
// the grid/UI state moved to the main thread (this worker only forwards decoded RPC messages),
// level files written into the virtual file system, streaming wasm compile.
import { WASI, wasi, WASIProcExit, Directory, File, PreopenDirectory, Fd } from '@bjorn3/browser_wasi_shim'
import { Decoder } from '../vendor/nvim-wasm/msgpack.js'

let stdinFd = null
let wasmExports = null
let asyncifyDataPtr = 0
let asyncifyStackStart = 0
let asyncifyStackEnd = 0
let pendingAsync = null
let pendingPollOneoff = null
let stdinWaitPromise = null

self.onmessage = (event) => {
  const data = event.data ?? {}
  if (data.type === 'start') {
    startNvim(data).catch((err) => {
      postMessage({ type: 'fatal', message: err?.message || String(err) })
      postMessage({ type: 'exit', code: 1 })
    })
  } else if (data.type === 'stdin') {
    stdinFd?.push(data.chunk)
  }
}

// stdin: 메인 스레드가 보낸 msgpack 바이트를 쌓아 두고 Neovim 이 읽어 감 (비어 있으면 EAGAIN)
class MessageInputFd extends Fd {
  constructor() {
    super()
    this.chunks = []
    this.total = 0
    this.waiters = []
  }

  fd_fdstat_get() {
    const fdstat = new wasi.Fdstat(wasi.FILETYPE_REGULAR_FILE, 0)
    fdstat.fs_rights_base = BigInt(wasi.RIGHTS_FD_READ | wasi.RIGHTS_FD_WRITE)
    return { ret: wasi.ERRNO_SUCCESS, fdstat }
  }

  fd_close() { return wasi.ERRNO_SUCCESS }

  push(chunk) {
    const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk ?? [])
    if (!bytes.byteLength) return
    this.chunks.push(bytes)
    this.total += bytes.byteLength
    const waiters = this.waiters
    this.waiters = []
    for (const w of waiters) w()
  }

  waitForData() {
    if (this.total > 0) return Promise.resolve()
    return new Promise((resolve) => this.waiters.push(resolve))
  }

  fd_read(size) {
    const max = Math.min(Number(size) || 0, this.total)
    if (max <= 0) return { ret: wasi.ERRNO_AGAIN, data: new Uint8Array() }
    const out = new Uint8Array(max)
    let written = 0
    while (written < max && this.chunks.length) {
      const first = this.chunks[0]
      const take = Math.min(first.byteLength, max - written)
      out.set(first.subarray(0, take), written)
      written += take
      if (take === first.byteLength) this.chunks.shift()
      else this.chunks[0] = first.subarray(take)
    }
    this.total -= written
    return { ret: wasi.ERRNO_SUCCESS, data: out }
  }
}

class SinkFd extends Fd {
  constructor(onWrite) {
    super()
    this.onWrite = onWrite
  }

  fd_fdstat_get() {
    const fdstat = new wasi.Fdstat(wasi.FILETYPE_REGULAR_FILE, 0)
    fdstat.fs_rights_base = BigInt(wasi.RIGHTS_FD_WRITE)
    return { ret: wasi.ERRNO_SUCCESS, fdstat }
  }

  fd_write(data) {
    this.onWrite(new Uint8Array(data))
    return { ret: wasi.ERRNO_SUCCESS, nwritten: data.byteLength }
  }

  fd_close() { return wasi.ERRNO_SUCCESS }
}

// 절대 경로(/nvim/...)를 preopen 기준 상대 경로로
class RootedPreopenDirectory extends PreopenDirectory {
  #strip(path) { return path.replace(/^\/+/, '') }
  path_open(dirflags, path, ...rest) { return super.path_open(dirflags, this.#strip(path), ...rest) }
  path_filestat_get(flags, path) { return super.path_filestat_get(flags, this.#strip(path)) }
  path_create_directory(path) { return super.path_create_directory(this.#strip(path)) }
  path_unlink_file(path) { return super.path_unlink_file(this.#strip(path)) }
  path_remove_directory(path) { return super.path_remove_directory(this.#strip(path)) }
  path_link(path, inode, allowDir) { return super.path_link(this.#strip(path), inode, allowDir) }
  path_readlink(path) { return super.path_readlink(this.#strip(path)) }
  path_symlink(oldPath, newPath) { return super.path_symlink(this.#strip(oldPath), this.#strip(newPath)) }
}

async function compileWasm(url) {
  try {
    return await WebAssembly.compileStreaming(fetch(url))
  } catch {
    // 서버가 application/wasm 을 안 붙이는 등 스트리밍 컴파일이 안 되면 통째로 받아서
    return WebAssembly.compile(await fetchBytes(url))
  }
}

async function fetchBytes(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${url} failed (${res.status})`)
  return new Uint8Array(await res.arrayBuffer())
}

// 서버가 .gz 에 Content-Encoding: gzip 을 붙이면(vite preview 등) 브라우저가 이미 풀어서 줌 → gzip 매직 바이트(1f 8b)일 때만 직접 품
async function fetchGunzip(url) {
  const bytes = await fetchBytes(url)
  if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) return bytes
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())
}

async function startNvim({ wasmUrl, runtimeUrl, args, files }) {
  const [module, tarBytes] = await Promise.all([compileWasm(wasmUrl), fetchGunzip(runtimeUrl)])
  postMessage({ type: 'loaded' })
  const root = buildFs(untar(tarBytes))
  for (const [path, text] of Object.entries(files ?? {})) writeFile(root, path, new TextEncoder().encode(text))

  stdinFd = new MessageInputFd()
  const decoder = new Decoder((msg) => postMessage({ type: 'rpc', msg }))
  const stdoutFd = new SinkFd((chunk) => decoder.push(chunk))
  const stderrFd = new SinkFd(() => {})
  const preopen = new RootedPreopenDirectory('nvim', root.contents)
  const preopenTmp = new RootedPreopenDirectory('tmp', root.contents.get('tmp').contents)
  const env = [
    'VIMRUNTIME=/nvim/runtime',
    'HOME=/nvim/home',
    'PWD=/nvim',
    'XDG_CONFIG_HOME=/nvim/home/.config',
    'XDG_DATA_HOME=/nvim/home/.local/share',
    'XDG_STATE_HOME=/nvim/home/.local/state',
    'PATH=/usr/bin:/bin',
    'TMPDIR=/nvim/tmp',
  ]
  const activeWasi = new WASI(['nvim', ...args], env, [stdinFd, stdoutFd, stderrFd, preopen, preopenTmp], { debug: false })

  const imports = { ...activeWasi.wasiImport }
  // fd_read 는 non-blocking(EAGAIN) 그대로 두고 poll_oneoff 만 Asyncify 로 잠재움
  imports.poll_oneoff = pollOneoff

  let exitCode = 0
  try {
    const instance = await WebAssembly.instantiate(module, {
      wasi_snapshot_preview1: imports,
      env: makeEnv(() => activeWasi.wasiImport.proc_exit(1)),
    })
    wasmExports = instance.exports
    initAsyncify(wasmExports)
    activeWasi.inst = instance
    postMessage({ type: 'ready' })
    exitCode = await runAsyncifiedStart(wasmExports)
  } catch (err) {
    if (err instanceof WASIProcExit) exitCode = err.code
    else if (typeof err?.code === 'number') exitCode = err.code
    else {
      postMessage({ type: 'fatal', message: err?.message || String(err) })
      exitCode = 1
    }
  }
  postMessage({ type: 'exit', code: exitCode })
}

function pollOneoff(inPtr, outPtr, nsubscriptions, neventsPtr) {
  if (!wasmExports?.memory) return wasi.ERRNO_FAULT
  const ns = Number(nsubscriptions) >>> 0
  if (ns === 0) return wasi.ERRNO_INVAL

  const state = wasmExports.asyncify_get_state?.() ?? 0
  if (state === 0 && pendingPollOneoff) pendingPollOneoff = null
  const buffer = new DataView(wasmExports.memory.buffer)
  const subSize = 48
  const eventSize = 32
  const nowNs = () => BigInt(Math.round(performance.now() * 1e6))
  const nowRealNs = () => BigInt(Date.now()) * 1000000n

  let needStdin = false
  let nextDeltaNs = null
  const ready = []
  const clockDeadlines = new Array(ns).fill(null)
  const usePending = state === 2 && pendingPollOneoff?.inPtr === (inPtr >>> 0) && pendingPollOneoff.nsubscriptions === ns

  for (let i = 0; i < ns; i++) {
    const base = (inPtr + i * subSize) >>> 0
    const userdata = buffer.getBigUint64(base, true)
    const eventtype = buffer.getUint8(base + 8)

    if (eventtype === wasi.EVENTTYPE_FD_READ || eventtype === wasi.EVENTTYPE_FD_WRITE) {
      const fd = buffer.getUint32(base + 16, true)
      if (eventtype === wasi.EVENTTYPE_FD_READ && fd === 0) {
        if (stdinFd.total > 0) ready.push({ userdata, eventtype })
        else needStdin = true
      } else {
        // stdin 이외의 fd 는 항상 준비됨으로 (libuv 내부 핸들. NOTSUP 을 돌려주면 루프가 멈춤)
        ready.push({ userdata, eventtype })
      }
      continue
    }

    if (eventtype === wasi.EVENTTYPE_CLOCK) {
      const clockid = buffer.getUint32(base + 16, true)
      const timeout = buffer.getBigUint64(base + 24, true)
      const flags = buffer.getUint16(base + 36, true)
      const getNow = clockid === wasi.CLOCKID_MONOTONIC ? nowNs : clockid === wasi.CLOCKID_REALTIME ? nowRealNs : null
      if (!getNow) return wasi.ERRNO_INVAL
      const now = getNow()
      const isAbs = (flags & wasi.SUBCLOCKFLAGS_SUBSCRIPTION_CLOCK_ABSTIME) !== 0
      const pending = usePending ? pendingPollOneoff.clockDeadlines[i] : null
      const endTime = pending ?? (isAbs ? timeout : now + timeout)
      clockDeadlines[i] = endTime
      if (endTime <= now) ready.push({ userdata, eventtype })
      else if (nextDeltaNs === null || endTime - now < nextDeltaNs) nextDeltaNs = endTime - now
      continue
    }

    return wasi.ERRNO_NOTSUP
  }

  if (ready.length > 0) {
    if (state === 2) stopRewindIfNeeded()
    pendingPollOneoff = null
    const out = new DataView(wasmExports.memory.buffer)
    const count = Math.min(ready.length, ns)
    for (let i = 0; i < count; i++) {
      new wasi.Event(ready[i].userdata, wasi.ERRNO_SUCCESS, ready[i].eventtype).write_bytes(out, (outPtr + i * eventSize) >>> 0)
    }
    out.setUint32(neventsPtr, count, true)
    return wasi.ERRNO_SUCCESS
  }

  // 준비된 이벤트가 없으면 다음 타이머(최대 50ms)나 stdin 입력까지 잠듦
  const waits = []
  if (needStdin || stdinFd.total === 0) waits.push(getStdinWaitPromise())
  if (nextDeltaNs !== null) {
    const ms = Number(nextDeltaNs / 1000000n)
    waits.push(new Promise((r) => setTimeout(r, Math.min(Number.isFinite(ms) && ms > 0 ? ms : 0, 50))))
  }
  if (!waits.length) {
    new DataView(wasmExports.memory.buffer).setUint32(neventsPtr, 0, true)
    return wasi.ERRNO_SUCCESS
  }

  if (state === 2) stopRewindIfNeeded()
  pendingPollOneoff = { inPtr: inPtr >>> 0, nsubscriptions: ns, clockDeadlines }
  startUnwind(waits.length === 1 ? waits[0] : Promise.race(waits))
  new DataView(wasmExports.memory.buffer).setUint32(neventsPtr, 0, true)
  return wasi.ERRNO_SUCCESS
}

function getStdinWaitPromise() {
  if (stdinFd.total > 0) return Promise.resolve()
  stdinWaitPromise ??= stdinFd.waitForData().finally(() => { stdinWaitPromise = null })
  return stdinWaitPromise
}

// Asyncify 데이터 영역은 wasm 안에 예약된 것을 씀 (힙이 덮어쓰지 못하게)
function initAsyncify(exports) {
  if (typeof exports.asyncify_start_unwind !== 'function' || typeof exports.nvim_asyncify_get_data_ptr !== 'function') {
    throw new Error('asyncify: missing exports (nvim-asyncify.wasm expected)')
  }
  asyncifyDataPtr = exports.nvim_asyncify_get_data_ptr() >>> 0
  asyncifyStackStart = exports.nvim_asyncify_get_stack_start() >>> 0
  asyncifyStackEnd = exports.nvim_asyncify_get_stack_end() >>> 0
  resetAsyncifyData()
}

function resetAsyncifyData() {
  const view = new DataView(wasmExports.memory.buffer)
  view.setInt32(asyncifyDataPtr, asyncifyStackStart, true)
  view.setInt32(asyncifyDataPtr + 4, asyncifyStackEnd, true)
}

function startUnwind(promise) {
  if (pendingAsync) throw new Error('asyncify: overlapping async operation')
  resetAsyncifyData()
  pendingAsync = promise
  wasmExports.asyncify_start_unwind(asyncifyDataPtr)
}

function stopRewindIfNeeded() {
  if (wasmExports.asyncify_get_state() === 2) {
    wasmExports.asyncify_stop_rewind()
    resetAsyncifyData()
  }
}

async function runAsyncifiedStart(exports) {
  while (true) {
    try {
      exports._start()
    } catch (err) {
      if (err instanceof WASIProcExit) return err.code
      throw err
    }
    const state = exports.asyncify_get_state()
    if (state === 0) return 0
    if (state === 2) {
      exports.asyncify_stop_rewind()
      resetAsyncifyData()
      continue
    }
    if (state !== 1) throw new Error(`asyncify: unexpected state ${state}`)
    exports.asyncify_stop_unwind()
    const wait = pendingAsync
    pendingAsync = null
    await wait
    exports.asyncify_start_rewind(asyncifyDataPtr)
  }
}

// ── 가상 파일 시스템 (런타임 tar + 레벨 파일) ──
function untar(data) {
  const files = []
  const decoder = new TextDecoder()
  const str = (start, length) => {
    let end = start
    while (end < start + length && data[end] !== 0) end++
    return decoder.decode(data.subarray(start, end)).trim()
  }
  let offset = 0
  while (offset + 512 <= data.length) {
    const name = str(offset, 100)
    const prefix = str(offset + 345, 155)
    if (!name && !prefix) break
    const size = parseInt(str(offset + 124, 12) || '0', 8) || 0
    const body = offset + 512
    files.push({ name: prefix ? `${prefix}/${name}` : name, dir: data[offset + 156] === 53, data: data.slice(body, body + size) })
    offset = body + Math.ceil(size / 512) * 512
  }
  return files
}

function ensureDir(root, parts) {
  let dir = root
  for (const part of parts) {
    if (!dir.contents.has(part)) dir.contents.set(part, new Directory(new Map()))
    dir = dir.contents.get(part)
  }
  return dir
}

function writeFile(root, path, bytes, readonly = false) {
  const parts = path.replace(/^\.?\//, '').split('/').filter(Boolean)
  if (!parts.length) return
  ensureDir(root, parts.slice(0, -1)).contents.set(parts.at(-1), new File(bytes, { readonly }))
}

function buildFs(entries) {
  const root = new Directory(new Map())
  for (const entry of entries) {
    if (entry.dir) ensureDir(root, entry.name.replace(/^\.?\//, '').split('/').filter(Boolean))
    else writeFile(root, entry.name, entry.data, true)
  }
  for (const p of ['home/.config', 'home/.local/share', 'home/.local/state', 'tmp', 'work']) ensureDir(root, p.split('/'))
  return root
}

// wasm 이 env 에서 가져가는 함수들 (WASI 에 없는 것들의 스텁)
function makeEnv(procExit) {
  const cLongjmp = new WebAssembly.Tag({ parameters: ['i32'], results: [] })
  return {
    flock: () => 0,
    getpid: () => 1,
    uv_random: () => -38,
    uv_wtf8_to_utf16: () => {},
    uv_utf16_length_as_wtf8: () => 0,
    uv_utf16_to_wtf8: () => -38,
    uv_wtf8_length_as_utf16: () => 0,
    __wasm_longjmp: (ptr) => {
      procExit()
      throw new WebAssembly.Exception(cLongjmp, [ptr ?? 0])
    },
    __wasm_setjmp: () => 0,
    __wasm_setjmp_test: () => 0,
    tmpfile: () => 0,
    clock: () => 0n,
    system: () => -1,
    tmpnam: () => 0,
    __c_longjmp: cLongjmp,
  }
}
