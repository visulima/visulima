## @visulima/secret-scanner [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/secret-scanner@1.0.0-alpha.2...@visulima/secret-scanner@1.0.0-alpha.3) (2026-05-14)

### Bug Fixes

* **release:** patch NAPI version-check string and ship fresh loader on release ([0676e33](https://github.com/visulima/visulima/commit/0676e336f453c9ae38c9f3a5fbbb675f9bff7ea0))

### Miscellaneous Chores

* ignore the data ruleset ([c9a2dda](https://github.com/visulima/visulima/commit/c9a2ddadca09bb978ea6a356942f7b870926c3fe))
* **tooling:** apply prettier and eslint formatting sweep ([c2c641d](https://github.com/visulima/visulima/commit/c2c641d40242e99030cb990fa01039db5e267667))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.22

## @visulima/secret-scanner [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/secret-scanner@1.0.0-alpha.1...@visulima/secret-scanner@1.0.0-alpha.2) (2026-05-11)

### Features

* **secret-scanner:** add exposed-files preset and path-only allowlist eval ([8e5372d](https://github.com/visulima/visulima/commit/8e5372dfb9db9da9d49d26b8d31ba7b0ef23399c))

### Bug Fixes

* **secret-scanner:** scope path-only allowlist eval to rule-level only ([3a4475e](https://github.com/visulima/visulima/commit/3a4475ee15d190b304da17d7cb318ee503418b0f))

### Miscellaneous Chores

* **deps:** bump rust crates to current majors ([3a1d9bb](https://github.com/visulima/visulima/commit/3a1d9bb7f6e2c6b2d3862e212ae62707d60815cc))
* re-enable antfu/if-newline in vis and secret-scanner ([bcd84de](https://github.com/visulima/visulima/commit/bcd84de019b60f6bc474852e7ae6b7da822a9185))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **secret-scanner:** bump devDependencies for cloud SDKs and TOML parser ([fec96dc](https://github.com/visulima/visulima/commit/fec96dc1449dc54ac6c5bb95e795ec7cdd4d00a7))
* **secret-scanner:** housekeeping cleanup ([274305a](https://github.com/visulima/visulima/commit/274305aa286658d9526b0d10cc3ec680eb2583b5))
* **secret-scanner:** sort native package.json keys ([7be87af](https://github.com/visulima/visulima/commit/7be87af3229d903808d9a2f59f275496173a3200))
* **secret-scanner:** upgrade packem to 2.0.0-alpha.76 and refresh ruleset ([21c6796](https://github.com/visulima/visulima/commit/21c67964de2aa6c094969d0aa28f32280bbef69e))

### Continuous Integration

* integrate codspeed for benchmark tracking ([e758f3d](https://github.com/visulima/visulima/commit/e758f3da491cc00d3f8bbf10d7ba3fdf8deb5325))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.20

## @visulima/secret-scanner 1.0.0-alpha.1 (2026-04-22)

### Features

* **secret-scanner:** integrate Kingfisher ruleset + HTTP/transport validators ([00e9c06](https://github.com/visulima/visulima/commit/00e9c061529dd863ba99836ffcf2d061e82c9b2e))
* **secret-scanner:** pragma suppression, heuristics, yaml transformer ([e5bc308](https://github.com/visulima/visulima/commit/e5bc308597695e943ecd8bb97986147e0ec9af75))
* **secret-scanner:** regroup ScanOptions, add weak-passwords preset, polish SARIF ([1ddbfac](https://github.com/visulima/visulima/commit/1ddbfac6781408d750856003b5b5f53408afa5b3))
* **secret-scanner:** rust-native secret scanner with vis integration ([926a583](https://github.com/visulima/visulima/commit/926a5830efca68d9956f053496b0a5efb359eccd))

### Bug Fixes

* addded ruleset.json back ([65ba6b1](https://github.com/visulima/visulima/commit/65ba6b168ba4b87975de833acae46b5cc54d3d06))
* **ci:** publish native addons via local semantic-release plugin ([974beb2](https://github.com/visulima/visulima/commit/974beb2d021e7b2afc86b958bd2137be88d2f464))
* **error, secret-scanner:** fix build and test failures ([c2c438f](https://github.com/visulima/visulima/commit/c2c438fc442ea2d3052a86e7b35b0e2327475ebf))
* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))
* **secret-scanner:** resolve symlinked paths in scanFiles filter ([e650829](https://github.com/visulima/visulima/commit/e6508297a442462110b9242df15f87cf3c2e30e0))

### Documentation

* **secret-scanner:** reposition README beyond gitleaks port ([7a15883](https://github.com/visulima/visulima/commit/7a15883b99eaee970076e8878ddd90f1ef7d2042))

### Miscellaneous Chores

* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* docs update ([cfa0a55](https://github.com/visulima/visulima/commit/cfa0a55d10c812cb33959e4ba064594d08131b86))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* **secret-scanner:** apply formatter and lint fixes ([45d812f](https://github.com/visulima/visulima/commit/45d812f927be224c248388855cef3b81d4e09f9f))
* **secret-scanner:** apply formatter and lint fixes ([b596936](https://github.com/visulima/visulima/commit/b596936cdc3654a909c376afb590267101dc98ca))
* **secret-scanner:** enforce curly braces and apply lint fixes ([c7d8e5a](https://github.com/visulima/visulima/commit/c7d8e5a3a740622ff5288555ecb93cf49a2ac02f))

### Tests

* **secret-scanner:** add per-file JIT warmup and extended timeouts ([3255e63](https://github.com/visulima/visulima/commit/3255e636cb554e3bfb40e8c4cafd6108034f9acf))
* **secret-scanner:** remove native binding guards from all tests ([1fdc28a](https://github.com/visulima/visulima/commit/1fdc28a8b3af2486c1dc895e6f3a5fd58000c091))

### Build System

* **secret-scanner:** build fs/path before native binding test ([9c6d5de](https://github.com/visulima/visulima/commit/9c6d5de8181914d631ea36141f69a24daf4dd7ab))
* **secret-scanner:** drop [@visulima](https://github.com/visulima) script deps + minify ruleset on prod ([5c265af](https://github.com/visulima/visulima/commit/5c265aff714449511c968d91ba1f8ecc87070b64))
