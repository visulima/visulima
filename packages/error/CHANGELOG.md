## @visulima/error [4.3.0](https://github.com/visulima/visulima/compare/@visulima/error@4.2.0...@visulima/error@4.3.0) (2024-07-02)

### Features

* **error:** added a prefix option to renderError ([e164d52](https://github.com/visulima/visulima/commit/e164d528dfef4195a7cbd9f8843f58148dfc5e08))
* **error:** added stackFilter to parseStacktrace, fixed parsing AggregateError stack, added filterStacktrace to renderError ([bb4b4f7](https://github.com/visulima/visulima/commit/bb4b4f72ab00c63bf0ac5e9e6a9a01110c102a1c))

### Bug Fixes

* **error:** renamed stackFilter to filter and changed interface for filterStacktrace ([b95dfb6](https://github.com/visulima/visulima/commit/b95dfb640b0d243122bff2ddf2e32a79101652e1))

### Miscellaneous Chores

* changed typescript version back to 5.4.5 ([55d28bb](https://github.com/visulima/visulima/commit/55d28bbdc103718d19f844034b38a0e8e5af798a))

## @visulima/error [4.2.0](https://github.com/visulima/visulima/compare/@visulima/error@4.1.0...@visulima/error@4.2.0) (2024-07-02)

### Features

* **error:** added renderError, added cause to visulima-error ([#449](https://github.com/visulima/visulima/issues/449)) ([4e78638](https://github.com/visulima/visulima/commit/4e7863890ccbc66a1427d4e6fd4c1879cf448b77))

### Miscellaneous Chores

* updated dev dependencies ([34df456](https://github.com/visulima/visulima/commit/34df4569f2fc074823a406c44a131c8fbae2b147))

## @visulima/error [4.1.0](https://github.com/visulima/visulima/compare/@visulima/error@4.0.0...@visulima/error@4.1.0) (2024-07-01)

### Features

* **error:** added new error serialize ([#443](https://github.com/visulima/visulima/issues/443)) ([b6f109b](https://github.com/visulima/visulima/commit/b6f109b108e608e310ec1bc95de7e249763ad095))

### Miscellaneous Chores

* updated dev dependencies ([c889486](https://github.com/visulima/visulima/commit/c889486f8980741f459b993648c1b6d0815e3d66))

## @visulima/error [4.0.0](https://github.com/visulima/visulima/compare/@visulima/error@3.2.11...@visulima/error@4.0.0) (2024-06-16)

### ⚠ BREAKING CHANGES

* **error:** moved source-map handling into a new package @visulima/source-map
Signed-off-by: prisis <d.bannert@anolilab.de>

Signed-off-by: prisis <d.bannert@anolilab.de>

### Features

* **error:** removed source-map handling ([716ef11](https://github.com/visulima/visulima/commit/716ef11a054fd9405f58ba448a868054b5368b50))
* **source-map:** new source-map package ([d4114c6](https://github.com/visulima/visulima/commit/d4114c6e7cd73bacf14ba7d8df509507d8daa3ee))

### Bug Fixes

* **error:** fixed new eval syntax on windows ([e50a816](https://github.com/visulima/visulima/commit/e50a8164d6b2f15818b77d67ac876bbe638bba8a))

### Miscellaneous Chores

* **error:** added missing @visulima/path as dev dep ([c83d103](https://github.com/visulima/visulima/commit/c83d1035209a9b0f4674ede207918b403efc5fbf))
* **source-map:** moved fixtures from error to source-map ([664b287](https://github.com/visulima/visulima/commit/664b2870d4405fb27b65f7dc264b89f1bf29306d))
* updated all dev deps ([ef143ce](https://github.com/visulima/visulima/commit/ef143ce2e15952a0910aa5c8bd78d25de9ebd7f3))

### Build System

* fixed found audit error, updated all dev package deps, updated deps in apps and examples ([4c51950](https://github.com/visulima/visulima/commit/4c519500dc5504579d35725572920658999885cb))

## @visulima/error [3.2.11](https://github.com/visulima/visulima/compare/@visulima/error@3.2.10...@visulima/error@3.2.11) (2024-06-06)


### Bug Fixes

* allow node v22 ([890d457](https://github.com/visulima/visulima/commit/890d4570f18428e2463944813c0c638b3f142803))



### Dependencies

* **@visulima/path:** upgraded to 1.0.2
* **@visulima/nextra-theme-docs:** upgraded to 4.0.26

## @visulima/error [3.2.10](https://github.com/visulima/visulima/compare/@visulima/error@3.2.9...@visulima/error@3.2.10) (2024-06-05)


### Miscellaneous Chores

* updated dev dependencies ([a2e0504](https://github.com/visulima/visulima/commit/a2e0504dc239049434c2482756ff15bdbaac9b54))



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.25

## @visulima/error [3.2.9](https://github.com/visulima/visulima/compare/@visulima/error@3.2.8...@visulima/error@3.2.9) (2024-05-24)


### Bug Fixes

* changed pathe to @visulima/path ([#410](https://github.com/visulima/visulima/issues/410)) ([bfe1287](https://github.com/visulima/visulima/commit/bfe1287aff6d28d5dca302fd4d58c1f6234ce0bb))


### Miscellaneous Chores

* changed semantic-release-npm to pnpm ([b6d100a](https://github.com/visulima/visulima/commit/b6d100a2bf3fd026577be48726a37754947f0973))



### Dependencies

* **@visulima/path:** upgraded to 1.0.1

## @visulima/error [3.2.8](https://github.com/visulima/visulima/compare/@visulima/error@3.2.7...@visulima/error@3.2.8) (2024-05-15)



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.24

## @visulima/error [3.2.7](https://github.com/visulima/visulima/compare/@visulima/error@3.2.6...@visulima/error@3.2.7) (2024-04-27)



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.23

## @visulima/error [3.2.6](https://github.com/visulima/visulima/compare/@visulima/error@3.2.5...@visulima/error@3.2.6) (2024-04-17)



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.22

## @visulima/error [3.2.5](https://github.com/visulima/visulima/compare/@visulima/error@3.2.4...@visulima/error@3.2.5) (2024-04-09)



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.21

## @visulima/error [3.2.4](https://github.com/visulima/visulima/compare/@visulima/error@3.2.3...@visulima/error@3.2.4) (2024-03-30)



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.20

## @visulima/error [3.2.3](https://github.com/visulima/visulima/compare/@visulima/error@3.2.2...@visulima/error@3.2.3) (2024-03-27)


### Bug Fixes

* added missing os key to package.json ([4ad1268](https://github.com/visulima/visulima/commit/4ad1268ed12cbdcf60aeb46d4c052ed1696bc150))

## @visulima/error [3.2.2](https://github.com/visulima/visulima/compare/@visulima/error@3.2.1...@visulima/error@3.2.2) (2024-03-22)



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.19

## @visulima/error [3.2.1](https://github.com/visulima/visulima/compare/@visulima/error@3.2.0...@visulima/error@3.2.1) (2024-03-16)



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.18

## @visulima/error [3.2.0](https://github.com/visulima/visulima/compare/@visulima/error@3.1.2...@visulima/error@3.2.0) (2024-03-11)


### Features

* added new index-to-line-column function ([c794be0](https://github.com/visulima/visulima/commit/c794be0867eae45ce66096bd15691d7437545a5d))

## @visulima/error [3.1.2](https://github.com/visulima/visulima/compare/@visulima/error@3.1.1...@visulima/error@3.1.2) (2024-03-10)



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.17

## @visulima/error [3.1.1](https://github.com/visulima/visulima/compare/@visulima/error@3.1.0...@visulima/error@3.1.1) (2024-03-09)


### Bug Fixes

* **error:** fixed color option override ([467f1dc](https://github.com/visulima/visulima/commit/467f1dc979b6d4bca102589d330be083fd44e43e))

## @visulima/error [3.1.0](https://github.com/visulima/visulima/compare/@visulima/error@3.0.7...@visulima/error@3.1.0) (2024-03-09)


### Features

* **error:** added new tabWidth option to disable the tab transformer ([a115918](https://github.com/visulima/visulima/commit/a11591825f841c9ab28ebadd85d20633c5cd9e50))

## @visulima/error [3.0.7](https://github.com/visulima/visulima/compare/@visulima/error@3.0.6...@visulima/error@3.0.7) (2024-03-09)


### Bug Fixes

* **error:** added missing CodeFrameLocation export ([d4144e0](https://github.com/visulima/visulima/commit/d4144e0bd579797c49c9fe5b867289ef89400293))

## @visulima/error [3.0.6](https://github.com/visulima/visulima/compare/@visulima/error@3.0.5...@visulima/error@3.0.6) (2024-03-06)



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.16

## @visulima/error [3.0.5](https://github.com/visulima/visulima/compare/@visulima/error@3.0.4...@visulima/error@3.0.5) (2024-03-04)


### Bug Fixes

* fixed all found type issues ([eaa40d1](https://github.com/visulima/visulima/commit/eaa40d11f3fc056dfddcc25404bf109587ef2862))
* minifyWhitespace on prod build, removed @tsconfig/* configs ([410cb73](https://github.com/visulima/visulima/commit/410cb737c44c445a0479bdd49b4100d5daf2d83d))
* updated @jridgewell/trace-mapping ([2955e4a](https://github.com/visulima/visulima/commit/2955e4adad7478947e4b224fad7bca9c8d5fe4d5))



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.15

## @visulima/error [3.0.4](https://github.com/visulima/visulima/compare/@visulima/error@3.0.3...@visulima/error@3.0.4) (2024-02-26)


### Bug Fixes

* updated @jridgewell/trace-mapping ([f2061d1](https://github.com/visulima/visulima/commit/f2061d11c0db0df18b1ae065118e6a2f33811eab))



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.14

## @visulima/error [3.0.3](https://github.com/visulima/visulima/compare/@visulima/error@3.0.2...@visulima/error@3.0.3) (2024-01-31)


### Bug Fixes

* update deps ([1b01d6f](https://github.com/visulima/visulima/commit/1b01d6f55435ac2ed67db48e6e2060f786f59e56))



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.13

## @visulima/error [3.0.2](https://github.com/visulima/visulima/compare/@visulima/error@3.0.1...@visulima/error@3.0.2) (2024-01-19)


### Bug Fixes

* updated all deps, updated test based on eslint errors ([909f8f3](https://github.com/visulima/visulima/commit/909f8f384804d7ef140354ab44f867532dbc9847))



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.12

## @visulima/error [3.0.1](https://github.com/visulima/visulima/compare/@visulima/error@3.0.0...@visulima/error@3.0.1) (2023-12-06)


### Bug Fixes

* fixed possible deep nesting of error cause in getErrorCauses ([350ddba](https://github.com/visulima/visulima/commit/350ddbaf2b8120a0815f1673fc1582ca7946847d))

## @visulima/error [3.0.0](https://github.com/visulima/visulima/compare/@visulima/error@2.0.0...@visulima/error@3.0.0) (2023-12-06)


### ⚠ BREAKING CHANGES

* removed ErrorWithMetadata, fixed wrong Trace on error namespace
Signed-off-by: prisis <d.bannert@anolilab.de>

### Features

* added new getErrorCauses helper ([e94d9ee](https://github.com/visulima/visulima/commit/e94d9ee34d6fa0f93d853a227e9b31bab4aacdab))



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.11

## @visulima/error [2.0.0](https://github.com/visulima/visulima/compare/@visulima/error@1.1.1...@visulima/error@2.0.0) (2023-12-04)


### ⚠ BREAKING CHANGES

* removed positionAt, changed public interface of code-frame
Signed-off-by: prisis <d.bannert@anolilab.de>

### Features

* changed public interface of code-frame, added multiline marker ([d9d60c0](https://github.com/visulima/visulima/commit/d9d60c06029f7564bc956a027d040331eddd0443))


### Bug Fixes

* fixed wrong export ([b3689cd](https://github.com/visulima/visulima/commit/b3689cd5f5479cf934d8d892ff7071feedd3b9ae))

## @visulima/error [1.1.1](https://github.com/visulima/visulima/compare/@visulima/error@1.1.0...@visulima/error@1.1.1) (2023-11-30)



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.10

## @visulima/error [1.1.0](https://github.com/visulima/visulima/compare/@visulima/error@1.0.2...@visulima/error@1.1.0) (2023-11-30)


### Features

* added a stacktrace parser and a sourcemap loader ([#250](https://github.com/visulima/visulima/issues/250)) ([4543e44](https://github.com/visulima/visulima/commit/4543e44becc85a54cdbe7701e2c3e6601b282985))

## @visulima/error [1.0.2](https://github.com/visulima/visulima/compare/@visulima/error@1.0.1...@visulima/error@1.0.2) (2023-11-30)


### Bug Fixes

* **deps:** updated package deps ([b4f4ede](https://github.com/visulima/visulima/commit/b4f4eded7bbded62b341ade0017ab357336f3af2))



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.9

## @visulima/error [1.0.1](https://github.com/visulima/visulima/compare/@visulima/error@1.0.0...@visulima/error@1.0.1) (2023-11-07)


### Bug Fixes

* fixed the homepage url of the package ([02075ce](https://github.com/visulima/visulima/commit/02075ce997d62c1caf79690b32dd2f931e64bebe))



### Dependencies

* **@visulima/nextra-theme-docs:** upgraded to 4.0.8

## @visulima/error 1.0.0 (2023-11-07)


### Features

* new error package ([#248](https://github.com/visulima/visulima/issues/248)) ([89b76f5](https://github.com/visulima/visulima/commit/89b76f5a455363bfc3852759d4e5f64d71b48925))
