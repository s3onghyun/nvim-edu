# vendor/nvim-wasm

Prebuilt [nvim-wasm](https://github.com/MuNeNiCK/nvim-wasm) files for the Real Neovim mode (`nvim/`).
They are copied byte for byte from upstream; do not edit them. `vite.config.js` checks the SHA-256 of the
two binaries on every build, and `tests/vendor.test.mjs` checks every file listed here.

- Source: https://github.com/MuNeNiCK/nvim-wasm, directory `examples/demo-asyncify/` (and `LICENSE` at the root)
- Pinned commit: `19e393b62e280a9abfa24f51ed6a21359408cb1a` (2026-11-22, "add: MIT license"). The binaries were last changed in `84b1b1d4f3fd602c7f43e510be56727ecf232ec6` ("fix: asyncify build").
- Neovim: submodule `neovim/` at `c40cb2a4cf324812d46479480f6065e2c28bcb80` (0.12.0-dev, API level 14)
- Permission: the nvim-wasm author allowed embedding in nvim-edu in https://github.com/MuNeNiCK/nvim-wasm/issues/1

| File | SHA-256 | License |
|------|---------|---------|
| `nvim-asyncify.wasm` | `0c002380cfe2510ee07948353a017015fb0b369faa86dc7251a192fa0b132012` | Neovim (Apache-2.0, parts Vim license) and its bundled libraries |
| `nvim-runtime.tar.gz` | `3a4e21bd812b0e1b3f9e623427dfee5a2e379e9511b9cc8d3dc35ed2387a77af` | Neovim runtime files (Apache-2.0 / Vim license, some files with their own notices) |
| `msgpack.js` | `0eb86ec4bcdf5f45c3f21977dbd2f6d5b1f73b4f49a8adfe8ea3bc5646b32301` | MIT (nvim-wasm) |
| `LICENSE` | `f9ebaf34db84f3b4a25da55ce70ee85f5f1b0b626893ab0807a33c395cb00b78` | nvim-wasm's MIT license |

Why the Asyncify build: GitHub Pages cannot send COOP/COEP headers, so `SharedArrayBuffer` is not available
without a service-worker workaround (that is what `real/` does, and it fails in Safari). The Asyncify build
needs neither.

At build time the runtime tarball is reduced to the files that can actually load (`slimNvimRuntime` in
`vite.config.js`): this build cannot list directories (libuv's `uv_fs_scandir` is a stub), so plugins,
packages and color schemes, which Neovim finds by globbing, are left out together with the docs. Every
kept file is unchanged. All third-party licenses: [`THIRD_PARTY_NOTICES.txt`](../../THIRD_PARTY_NOTICES.txt).

To update: copy the new files from a newer nvim-wasm commit, update the hashes here and in `vite.config.js`,
check the runtime file list and `THIRD_PARTY_NOTICES.txt` (bundled library versions come from
`neovim/cmake.deps/deps.txt` and nvim-wasm's `Makefile`), then run `npm test`.
