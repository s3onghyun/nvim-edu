// vendor/nvim-wasm 이 upstream 파일 그대로인지(README 의 SHA-256 표) + 배포하는 바이너리의 라이선스 고지가 빠지지 않았는지
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'

const read = (p) => readFileSync(new URL(p, import.meta.url))
const readme = read('../vendor/nvim-wasm/README.md').toString()
const table = [...readme.matchAll(/^\| `([^`]+)` \| `([0-9a-f]{64})` \|/gm)].map(([, file, sha]) => ({ file, sha }))

test('vendor/nvim-wasm: every file is listed in README.md with its SHA-256, and matches', () => {
  const files = readdirSync(new URL('../vendor/nvim-wasm/', import.meta.url)).filter((f) => f !== 'README.md').sort()
  assert.deepEqual(table.map((t) => t.file).sort(), files)
  for (const { file, sha } of table) {
    assert.equal(createHash('sha256').update(read(`../vendor/nvim-wasm/${file}`)).digest('hex'), sha, file)
  }
})

test('THIRD_PARTY_NOTICES.txt carries the nvim-wasm and Neovim licenses and every bundled library', () => {
  const notices = read('../THIRD_PARTY_NOTICES.txt').toString()
  assert.ok(notices.includes(read('../vendor/nvim-wasm/LICENSE').toString().trim()), 'nvim-wasm MIT license text')
  for (const text of [
    'Neovim is licensed under the terms of the Apache 2.0 license',
    'VIM LICENSE',
    'GNU LESSER GENERAL PUBLIC LICENSE',
    'GNU GENERAL PUBLIC LICENSE',
    'Copyright Joyent, Inc. and other Node contributors', // libuv
    'Copyright (C) 1994-2012 Lua.org, PUC-Rio.', // Lua 5.1
    'Copyright © 2007-2023 Lua.org, PUC-Rio.', // LPeg
    'utf8proc',
    'unibilium',
    'tree-sitter',
    'wasi-libc',
    'Mark Pulford', // lua-cjson
    'Attractive Chaos', // klib
    'Kepler Project', // coxpcall.lua
    'Enrique García Cota', // inspect.lua
    'browser_wasi_shim',
  ]) assert.ok(notices.includes(text), text)
})
