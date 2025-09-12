## @visulima/fs [3.1.7](https://github.com/visulima/visulima/compare/@visulima/fs@3.1.6...@visulima/fs@3.1.7) (2025-09-12)

### Miscellaneous Chores

* update dependencies and fix linting issues ([0e802fe](https://github.com/visulima/visulima/commit/0e802fe02bb9ed791659cb5f3c77605ae5b42ec8))


### Dependencies

* **@visulima/error:** upgraded to 4.6.0

## @visulima/fs [3.1.6](https://github.com/visulima/visulima/compare/@visulima/fs@3.1.5...@visulima/fs@3.1.6) (2025-09-07)


### Dependencies

* **@visulima/error:** upgraded to 4.5.0

## @visulima/fs [3.1.5](https://github.com/visulima/visulima/compare/@visulima/fs@3.1.4...@visulima/fs@3.1.5) (2025-06-04)

### Miscellaneous Chores

* **fs:** clear up ([e30b80d](https://github.com/visulima/visulima/commit/e30b80d7fc39b0d8db5bf234dd1840b63c4b8b7d))


### Dependencies

* **@visulima/path:** upgraded to 1.4.0
* **@visulima/error:** upgraded to 4.4.18

## @visulima/fs [3.1.4](https://github.com/visulima/visulima/compare/@visulima/fs@3.1.3...@visulima/fs@3.1.4) (2025-06-03)

### Bug Fixes

* **fs:** enhance file system utilities with detailed documentation updates ([678fb90](https://github.com/visulima/visulima/commit/678fb90a7799ceb78729414054be1ff499cc008b))
* **fs:** enhance file system utilities with new documentation updates ([926a4fe](https://github.com/visulima/visulima/commit/926a4fe993cd82a6e40abbc54a301ba9ed05b227))

### Miscellaneous Chores

* **fs:** formatting utilities with documentation updates ([cc473c2](https://github.com/visulima/visulima/commit/cc473c21e707f7a425742f83137d10934465c6d1))

## @visulima/fs [3.1.3](https://github.com/visulima/visulima/compare/@visulima/fs@3.1.2...@visulima/fs@3.1.3) (2025-05-30)

### Bug Fixes

* **fs:** update dependencies ([3a35af3](https://github.com/visulima/visulima/commit/3a35af359d55461ca158061020508668cc397d55))

### Styles

* cs fixes ([6570d56](https://github.com/visulima/visulima/commit/6570d568a80bd3fd4bfd73c824dc78f7e3a372f8))

### Miscellaneous Chores

* **fs-bench:** update devDependencies ([a7ec775](https://github.com/visulima/visulima/commit/a7ec775fe1a918a7724f3edc9cc8139cd7233b0e))
* **fs:** add benchmarking for file operations and find-up functionality ([d9ab1ee](https://github.com/visulima/visulima/commit/d9ab1eedff8a0ea1960c6c4549bf791c52780d26))
* updated dev dependencies ([2433ed5](https://github.com/visulima/visulima/commit/2433ed5fb662e0303c37edee8ddc21b46c21263f))


### Dependencies

* **@visulima/path:** upgraded to 1.3.6
* **@visulima/error:** upgraded to 4.4.17

## @visulima/fs [3.1.2](https://github.com/visulima/visulima/compare/@visulima/fs@3.1.1...@visulima/fs@3.1.2) (2025-03-07)

### Bug Fixes

* updated @visulima/packem and other dev deps, for better bundling size ([e940581](https://github.com/visulima/visulima/commit/e9405812201594e54dd81d17ddb74177df5f3c24))


### Dependencies

* **@visulima/path:** upgraded to 1.3.5
* **@visulima/error:** upgraded to 4.4.16

## @visulima/fs [3.1.1](https://github.com/visulima/visulima/compare/@visulima/fs@3.1.0...@visulima/fs@3.1.1) (2025-03-03)

### Bug Fixes

* **fs:** update entry methods to use function calls for isFile, isDirectory, and isSymbolicLink to not directly call the stat fn ([8efc158](https://github.com/visulima/visulima/commit/8efc158e8358bd5becfd263879837701b26d16d4))

### Miscellaneous Chores

* updated dev dependencies ([487a976](https://github.com/visulima/visulima/commit/487a976932dc7c39edfc19ffd3968960ff338066))

## @visulima/fs [3.1.0](https://github.com/visulima/visulima/compare/@visulima/fs@3.0.1...@visulima/fs@3.1.0) (2025-01-29)

### Features

* **fs:** adding size helper ([#488](https://github.com/visulima/visulima/issues/488)) ([3276bd7](https://github.com/visulima/visulima/commit/3276bd79b678e39b82d9ba8bc3d56e3af6f65746))

### Code Refactoring

* **fs:** moved some files into different folders ([80733b2](https://github.com/visulima/visulima/commit/80733b29737ec19389947056012cd33c8fefeea4))

## @visulima/fs [3.0.1](https://github.com/visulima/visulima/compare/@visulima/fs@3.0.0...@visulima/fs@3.0.1) (2025-01-25)

### Bug Fixes

* fixed wrong node version range in package.json ([4ae2929](https://github.com/visulima/visulima/commit/4ae292984681c71a770e4d4560432f7b7c5a141a))

### Miscellaneous Chores

* fixed typescript url ([fe65a8c](https://github.com/visulima/visulima/commit/fe65a8c0296ece7ee26474c70d065b06d4d0da89))


### Dependencies

* **@visulima/path:** upgraded to 1.3.4
* **@visulima/error:** upgraded to 4.4.15

## @visulima/fs [3.0.0](https://github.com/visulima/visulima/compare/@visulima/fs@2.3.8...@visulima/fs@3.0.0) (2025-01-25)

### ⚠ BREAKING CHANGES

* **fs:** The yaml dep is not more include out of the box, you need to install it your self, all yaml function can now be found on @visulima/fs/yaml
Signed-off-by: prisis <d.bannert@anolilab.de>

### Features

* **fs:** moved all yaml functions out of the main exports into `/yaml`, to reduce the bundle size ([b3766a0](https://github.com/visulima/visulima/commit/b3766a002bd53ce6ec8ef63e7da22c5e4d03becc))

### Miscellaneous Chores

* updated all dev dependencies ([37fb298](https://github.com/visulima/visulima/commit/37fb298b2af7c63be64252024e54bb3af6ddabec))

## @visulima/fs [2.3.8](https://github.com/visulima/visulima/compare/@visulima/fs@2.3.7...@visulima/fs@2.3.8) (2025-01-22)

### Styles

* cs fixes ([f615a6a](https://github.com/visulima/visulima/commit/f615a6af4c0d4fb9ec054565fe5c93e88df487e9))

### Miscellaneous Chores

* **fs:** changed wrong name in test, moved parameter out of the try ([09c73c8](https://github.com/visulima/visulima/commit/09c73c815df2a1cb9ab3a7c3500c69d347c40368))
* updated all dev dependencies and all dependencies in the app folder ([87f4ccb](https://github.com/visulima/visulima/commit/87f4ccbf9f7900ec5b56f3c1477bc4a0ef571bcf))


### Dependencies

* **@visulima/error:** upgraded to 4.4.14

## @visulima/fs [2.3.7](https://github.com/visulima/visulima/compare/@visulima/fs@2.3.6...@visulima/fs@2.3.7) (2025-01-13)


### Dependencies

* **@visulima/path:** upgraded to 1.3.3
* **@visulima/error:** upgraded to 4.4.13

## @visulima/fs [2.3.6](https://github.com/visulima/visulima/compare/@visulima/fs@2.3.5...@visulima/fs@2.3.6) (2025-01-12)

### Bug Fixes

* **fs:** updated yaml to 2.7.0 and all dev deps ([f836ac3](https://github.com/visulima/visulima/commit/f836ac3fa28c345d56218ab7918f86fe75034804))


### Dependencies

* **@visulima/path:** upgraded to 1.3.2
* **@visulima/error:** upgraded to 4.4.12

## @visulima/fs [2.3.5](https://github.com/visulima/visulima/compare/@visulima/fs@2.3.4...@visulima/fs@2.3.5) (2025-01-08)


### Dependencies

* **@visulima/path:** upgraded to 1.3.1
* **@visulima/error:** upgraded to 4.4.11

## @visulima/fs [2.3.4](https://github.com/visulima/visulima/compare/@visulima/fs@2.3.3...@visulima/fs@2.3.4) (2025-01-08)


### Dependencies

* **@visulima/path:** upgraded to 1.3.0
* **@visulima/error:** upgraded to 4.4.10

## @visulima/fs [2.3.3](https://github.com/visulima/visulima/compare/@visulima/fs@2.3.2...@visulima/fs@2.3.3) (2024-12-31)


### Dependencies

* **@visulima/path:** upgraded to 1.2.0
* **@visulima/error:** upgraded to 4.4.9

## @visulima/fs [2.3.2](https://github.com/visulima/visulima/compare/@visulima/fs@2.3.1...@visulima/fs@2.3.2) (2024-12-27)

### Bug Fixes

* **fs:** added missing yaml to dependencies ([210b995](https://github.com/visulima/visulima/commit/210b99503da7a30ceb3aa01019ae7d3f8bed6807))

### Miscellaneous Chores

* updated dev dependencies ([9de2eab](https://github.com/visulima/visulima/commit/9de2eab91e95c8b9289d12f863a5167218770650))

## @visulima/fs [2.3.1](https://github.com/visulima/visulima/compare/@visulima/fs@2.3.0...@visulima/fs@2.3.1) (2024-12-12)

### Bug Fixes

* allow node v23 ([8ca929a](https://github.com/visulima/visulima/commit/8ca929af311ce8036cbbfde68b6db05381b860a5))
* allowed node 23, updated dev dependencies ([f99d34e](https://github.com/visulima/visulima/commit/f99d34e01f6b13be8586a1b5d37dc8b8df0a5817))
* **fs:** fixed constrain of yaml peer dependency ([ddb7981](https://github.com/visulima/visulima/commit/ddb798129787043e710ce2c0452463e4a8d040c4))
* updated packem to v1.8.2 ([23f869b](https://github.com/visulima/visulima/commit/23f869b4120856cc97e2bffa6d508e2ae30420ea))
* updated packem to v1.9.2 ([47bdc2d](https://github.com/visulima/visulima/commit/47bdc2dfaeca4e7014dbe7772eae2fdf8c8b35bb))

### Styles

* cs fixes ([46d31e0](https://github.com/visulima/visulima/commit/46d31e082e1865262bf380859c14fabd28ff456d))

### Miscellaneous Chores

* updated dev dependencies ([a916944](https://github.com/visulima/visulima/commit/a916944b888bb34c34b0c54328b38d29e4399857))
* updated README.md ([fa3d4aa](https://github.com/visulima/visulima/commit/fa3d4aaef3435488b70e5ee1141559b85dcbb6c4))


### Dependencies

* **@visulima/path:** upgraded to 1.1.2
* **@visulima/error:** upgraded to 4.4.8

## @visulima/fs [2.3.0](https://github.com/visulima/visulima/compare/@visulima/fs@2.2.2...@visulima/fs@2.3.0) (2024-10-25)

### Features

* **fs:** added moveFile, moveFileSync, renameFile, renameFileSync ([#477](https://github.com/visulima/visulima/issues/477)) ([1f2cd29](https://github.com/visulima/visulima/commit/1f2cd29e3c62a9cc661f6f97b1d1cbda8566ea9c))

## @visulima/fs [2.2.2](https://github.com/visulima/visulima/compare/@visulima/fs@2.2.1...@visulima/fs@2.2.2) (2024-10-05)


### Dependencies

* **@visulima/path:** upgraded to 1.1.1
* **@visulima/error:** upgraded to 4.4.7

## @visulima/fs [2.2.1](https://github.com/visulima/visulima/compare/@visulima/fs@2.2.0...@visulima/fs@2.2.1) (2024-10-05)

### Bug Fixes

* **fs:** fixed typing of findUp and findUpSync when a function is used, export new result types ([08c322a](https://github.com/visulima/visulima/commit/08c322a12270b65766cd4cef7c30c3b8dee88475))
* updated dev dependencies, updated packem to v1.0.7, fixed naming of some lint config files ([c071a9c](https://github.com/visulima/visulima/commit/c071a9c8e129014a962ff654a16f302ca18a5c67))


### Dependencies

* **@visulima/path:** upgraded to 1.1.0
* **@visulima/error:** upgraded to 4.4.6

## @visulima/fs [2.2.0](https://github.com/visulima/visulima/compare/@visulima/fs@2.1.18...@visulima/fs@2.2.0) (2024-09-29)

### Features

* **fs:** added allowSymlinks to findUp and findUpSync ([1ef8c03](https://github.com/visulima/visulima/commit/1ef8c039e4e7b054177d25f74b98b56d79f2d27b))

## @visulima/fs [2.1.18](https://github.com/visulima/visulima/compare/@visulima/fs@2.1.17...@visulima/fs@2.1.18) (2024-09-24)

### Bug Fixes

* update packem to v1 ([05f3bc9](https://github.com/visulima/visulima/commit/05f3bc960df10a1602e24f9066e2b0117951a877))
* updated esbuild from v0.23 to v0.24 ([3793010](https://github.com/visulima/visulima/commit/3793010d0d549c0d41f85dea04b8436251be5fe8))

### Miscellaneous Chores

* updated dev dependencies ([05edb67](https://github.com/visulima/visulima/commit/05edb671285b1cc42875223314b24212e6a12588))


### Dependencies

* **@visulima/path:** upgraded to 1.0.9
* **@visulima/error:** upgraded to 4.4.5

## @visulima/fs [2.1.17](https://github.com/visulima/visulima/compare/@visulima/fs@2.1.16...@visulima/fs@2.1.17) (2024-09-11)

### Bug Fixes

* fixed node10 support ([f5e78d9](https://github.com/visulima/visulima/commit/f5e78d9bff8fd603967666598b34f9338a8726b5))

### Miscellaneous Chores

* updated dev dependencies ([28b5ee5](https://github.com/visulima/visulima/commit/28b5ee5c805ca8868536418829cde7ba8c5bb8dd))


### Dependencies

* **@visulima/path:** upgraded to 1.0.8
* **@visulima/error:** upgraded to 4.4.4

## @visulima/fs [2.1.16](https://github.com/visulima/visulima/compare/@visulima/fs@2.1.15...@visulima/fs@2.1.16) (2024-09-07)

### Bug Fixes

* fixed broken chunk splitting from packem ([1aaf277](https://github.com/visulima/visulima/commit/1aaf27779292d637923c5f8a220e18606e78caa2))


### Dependencies

* **@visulima/path:** upgraded to 1.0.7
* **@visulima/error:** upgraded to 4.4.3

## @visulima/fs [2.1.15](https://github.com/visulima/visulima/compare/@visulima/fs@2.1.14...@visulima/fs@2.1.15) (2024-09-07)

### Bug Fixes

* added types support for node10 ([604583f](https://github.com/visulima/visulima/commit/604583fa3c24b950fafad45d17e7a1333040fd76))

### Styles

* cs fixes ([f5c4af7](https://github.com/visulima/visulima/commit/f5c4af7cfa9fc79b6d3fa60c1e48d88bffab5a08))

### Miscellaneous Chores

* update dev dependencies ([0738f98](https://github.com/visulima/visulima/commit/0738f9810478bb215ce4b2571dc8874c4c503089))


### Dependencies

* **@visulima/path:** upgraded to 1.0.6
* **@visulima/error:** upgraded to 4.4.2

## @visulima/fs [2.1.14](https://github.com/visulima/visulima/compare/@visulima/fs@2.1.13...@visulima/fs@2.1.14) (2024-08-30)

### Bug Fixes

* updated license content ([63e34b3](https://github.com/visulima/visulima/commit/63e34b3a173d0b05b4eea97f85d37f08559559dd))

### Miscellaneous Chores

* updated dev dependencies ([45c2a76](https://github.com/visulima/visulima/commit/45c2a76bc974ecb2c6b172c3af03373d4cc6a5ce))


### Dependencies

* **@visulima/path:** upgraded to 1.0.5
* **@visulima/error:** upgraded to 4.4.1

## @visulima/fs [2.1.13](https://github.com/visulima/visulima/compare/@visulima/fs@2.1.12...@visulima/fs@2.1.13) (2024-08-08)

### Miscellaneous Chores

* updated dev dependencies ([da46d8e](https://github.com/visulima/visulima/commit/da46d8ef8a964c086060944172f1bd931b7bde9a))


### Dependencies

* **@visulima/error:** upgraded to 4.4.0

## @visulima/fs [2.1.12](https://github.com/visulima/visulima/compare/@visulima/fs@2.1.11...@visulima/fs@2.1.12) (2024-08-04)


### Dependencies

* **@visulima/path:** upgraded to 1.0.4
* **@visulima/error:** upgraded to 4.3.2

## @visulima/fs [2.1.11](https://github.com/visulima/visulima/compare/@visulima/fs@2.1.10...@visulima/fs@2.1.11) (2024-08-01)

### Bug Fixes

* upgraded @visulima/packem ([dc0cb57](https://github.com/visulima/visulima/commit/dc0cb5701b30f3f81404346c909fd4daf891b894))

### Styles

* cs fixes ([6f727ec](https://github.com/visulima/visulima/commit/6f727ec36437384883ca4b764d920cf03ffe44df))
* cs fixes ([ee5ed6f](https://github.com/visulima/visulima/commit/ee5ed6f31bdabcfacdb0d1abd1eff2cc6207cefc))

### Miscellaneous Chores

* added private true into fixture package.json files ([4a9494c](https://github.com/visulima/visulima/commit/4a9494c642fa98f224505a1d231b5af4e73d6c79))
* updated dev dependencies ([ac67ec1](https://github.com/visulima/visulima/commit/ac67ec1bcba16175d225958e318199f60b10d179))
* updated dev dependencies and sorted the package.json ([9571572](https://github.com/visulima/visulima/commit/95715725a8ed053ca24fd1405a55205c79342ecb))


### Dependencies

* **@visulima/path:** upgraded to 1.0.3
* **@visulima/error:** upgraded to 4.3.1

## @visulima/fs [2.1.10](https://github.com/visulima/visulima/compare/@visulima/fs@2.1.9...@visulima/fs@2.1.10) (2024-07-02)

### Miscellaneous Chores

* changed typescript version back to 5.4.5 ([55d28bb](https://github.com/visulima/visulima/commit/55d28bbdc103718d19f844034b38a0e8e5af798a))


### Dependencies

* **@visulima/error:** upgraded to 4.3.0

## @visulima/fs [2.1.9](https://github.com/visulima/visulima/compare/@visulima/fs@2.1.8...@visulima/fs@2.1.9) (2024-07-02)

### Miscellaneous Chores

* updated dev dependencies ([34df456](https://github.com/visulima/visulima/commit/34df4569f2fc074823a406c44a131c8fbae2b147))


### Dependencies

* **@visulima/error:** upgraded to 4.2.0

## @visulima/fs [2.1.8](https://github.com/visulima/visulima/compare/@visulima/fs@2.1.7...@visulima/fs@2.1.8) (2024-07-01)

### Styles

* cs fixes ([cf19938](https://github.com/visulima/visulima/commit/cf199384f25cd6e97d4041317b35b6a3cc586f88))
* cs fixes found by eslint and prettier ([69ef744](https://github.com/visulima/visulima/commit/69ef7444c0bfbf1c94763623332e06b7fffc0039))


### Dependencies

* **@visulima/error:** upgraded to 4.1.0

## @visulima/fs [2.1.7](https://github.com/visulima/visulima/compare/@visulima/fs@2.1.6...@visulima/fs@2.1.7) (2024-06-17)

### Bug Fixes

* **fs:** changed from tsup to packem ([#426](https://github.com/visulima/visulima/issues/426)) ([e74adad](https://github.com/visulima/visulima/commit/e74adaded8d0f5298fb755afe4536a1ec3f88f1c))

### Miscellaneous Chores

* updated dev dependencies ([c889486](https://github.com/visulima/visulima/commit/c889486f8980741f459b993648c1b6d0815e3d66))

## @visulima/fs [2.1.6](https://github.com/visulima/visulima/compare/@visulima/fs@2.1.5...@visulima/fs@2.1.6) (2024-06-16)


### Dependencies

* **@visulima/error:** upgraded to 4.0.0

## @visulima/fs [2.1.5](https://github.com/visulima/visulima/compare/@visulima/fs@2.1.4...@visulima/fs@2.1.5) (2024-06-11)

### Bug Fixes

* **fs:** updated type-fest to v4.20.0 ([b34f417](https://github.com/visulima/visulima/commit/b34f417537b209f4c411103b6eef0e5a6d9b947d))

### Build System

* fixed found audit error, updated all dev package deps, updated deps in apps and examples ([4c51950](https://github.com/visulima/visulima/commit/4c519500dc5504579d35725572920658999885cb))

## @visulima/fs [2.1.4](https://github.com/visulima/visulima/compare/@visulima/fs@2.1.3...@visulima/fs@2.1.4) (2024-06-06)


### Bug Fixes

* allow node v22 ([890d457](https://github.com/visulima/visulima/commit/890d4570f18428e2463944813c0c638b3f142803))



### Dependencies

* **@visulima/path:** upgraded to 1.0.2
* **@visulima/error:** upgraded to 3.2.11

## @visulima/fs [2.1.3](https://github.com/visulima/visulima/compare/@visulima/fs@2.1.2...@visulima/fs@2.1.3) (2024-06-05)


### Bug Fixes

* **fs:** updated type-fest ([f1ba811](https://github.com/visulima/visulima/commit/f1ba81100ad6eddeeda80066b2fb0f0b57a4cfa5))


### Miscellaneous Chores

* **fs:** added test for dot file ([105c6f3](https://github.com/visulima/visulima/commit/105c6f329312c71d3596b7115c16eb3829d7eac9))



### Dependencies

* **@visulima/error:** upgraded to 3.2.10

## @visulima/fs [2.1.2](https://github.com/visulima/visulima/compare/@visulima/fs@2.1.1...@visulima/fs@2.1.2) (2024-05-24)


### Bug Fixes

* changed pathe to @visulima/path ([#410](https://github.com/visulima/visulima/issues/410)) ([bfe1287](https://github.com/visulima/visulima/commit/bfe1287aff6d28d5dca302fd4d58c1f6234ce0bb))


### Miscellaneous Chores

* changed semantic-release-npm to pnpm ([b6d100a](https://github.com/visulima/visulima/commit/b6d100a2bf3fd026577be48726a37754947f0973))
* fixed wrong named folders to integration, added TEST_PROD_BUILD ([1b826f5](https://github.com/visulima/visulima/commit/1b826f5baf8285847199de9ede8fbdbadf201ad6))



### Dependencies

* **@visulima/path:** upgraded to 1.0.1
* **@visulima/error:** upgraded to 3.2.9

## @visulima/fs [2.1.1](https://github.com/visulima/visulima/compare/@visulima/fs@2.1.0...@visulima/fs@2.1.1) (2024-05-15)



### Dependencies

* **@visulima/error:** upgraded to 3.2.8

## @visulima/fs [2.1.0](https://github.com/visulima/visulima/compare/@visulima/fs@2.0.9...@visulima/fs@2.1.0) (2024-05-06)


### Features

* **fs:** adding ensure symlink ([#350](https://github.com/visulima/visulima/issues/350)) ([3e2fd19](https://github.com/visulima/visulima/commit/3e2fd191c4de13a2a6ebf599cd83926b7f8ad9a6))

## @visulima/fs [2.0.9](https://github.com/visulima/visulima/compare/@visulima/fs@2.0.8...@visulima/fs@2.0.9) (2024-05-03)


### Bug Fixes

* updated type-fest to version ^4.18.1 ([ab96053](https://github.com/visulima/visulima/commit/ab9605355b6d84d1662fa19ef919682c33e68b5b))

## @visulima/fs [2.0.8](https://github.com/visulima/visulima/compare/@visulima/fs@2.0.7...@visulima/fs@2.0.8) (2024-04-27)


### Bug Fixes

* **deps:** updated type-fest dep ([93445aa](https://github.com/visulima/visulima/commit/93445aaa7c8a5431b3ecffe5bfb90a54f635d68d))



### Dependencies

* **@visulima/error:** upgraded to 3.2.7

## @visulima/fs [2.0.7](https://github.com/visulima/visulima/compare/@visulima/fs@2.0.6...@visulima/fs@2.0.7) (2024-04-17)



### Dependencies

* **@visulima/error:** upgraded to 3.2.6

## @visulima/fs [2.0.6](https://github.com/visulima/visulima/compare/@visulima/fs@2.0.5...@visulima/fs@2.0.6) (2024-04-09)



### Dependencies

* **@visulima/error:** upgraded to 3.2.5

## @visulima/fs [2.0.5](https://github.com/visulima/visulima/compare/@visulima/fs@2.0.4...@visulima/fs@2.0.5) (2024-04-05)


### Bug Fixes

* updated type-fest and dev deps ([d7f648d](https://github.com/visulima/visulima/commit/d7f648debdb10eeeb4b8942c45b2e6f6ead560e2))

## @visulima/fs [2.0.4](https://github.com/visulima/visulima/compare/@visulima/fs@2.0.3...@visulima/fs@2.0.4) (2024-04-02)


### Bug Fixes

* **fs:** fixed default behavior of collect ([#387](https://github.com/visulima/visulima/issues/387)) ([172baa9](https://github.com/visulima/visulima/commit/172baa9ebd724c1d145e78f926ec12d068ef73bb))

## @visulima/fs [2.0.3](https://github.com/visulima/visulima/compare/@visulima/fs@2.0.2...@visulima/fs@2.0.3) (2024-03-30)


### Bug Fixes

* updated dev dependencies and type-fest ([1df1a35](https://github.com/visulima/visulima/commit/1df1a353f0bc7968087d5c68e0712c262837535b))



### Dependencies

* **@visulima/error:** upgraded to 3.2.4

## @visulima/fs [2.0.2](https://github.com/visulima/visulima/compare/@visulima/fs@2.0.1...@visulima/fs@2.0.2) (2024-03-27)


### Bug Fixes

* added missing os key to package.json ([4ad1268](https://github.com/visulima/visulima/commit/4ad1268ed12cbdcf60aeb46d4c052ed1696bc150))



### Dependencies

* **@visulima/error:** upgraded to 3.2.3

## @visulima/fs [2.0.1](https://github.com/visulima/visulima/compare/@visulima/fs@2.0.0...@visulima/fs@2.0.1) (2024-03-24)


### Bug Fixes

* changed parse back to node:path ([#371](https://github.com/visulima/visulima/issues/371)) ([675dd0a](https://github.com/visulima/visulima/commit/675dd0a39b6cd3c4559472608b23c55196df12a0))

## @visulima/fs [2.0.0](https://github.com/visulima/visulima/compare/@visulima/fs@1.11.1...@visulima/fs@2.0.0) (2024-03-23)


### ⚠ BREAKING CHANGES

* **fs:** moved node:path to pathe and changed NotFoundError message

Signed-off-by: prisis <d.bannert@anolilab.de>

### Features

* **fs:** moved node:path to pathe, changed NotFoundError message ([0557a18](https://github.com/visulima/visulima/commit/0557a18d97af6061ba9cb1581c420c2bc72965ef))

## @visulima/fs [1.11.1](https://github.com/visulima/visulima/compare/@visulima/fs@1.11.0...@visulima/fs@1.11.1) (2024-03-22)


### Bug Fixes

* **fs:** updated type-fest ([aa84569](https://github.com/visulima/visulima/commit/aa84569aca39f2b3af3508fbae9a56ea2da33b9e))



### Dependencies

* **@visulima/error:** upgraded to 3.2.2

## @visulima/fs [1.11.0](https://github.com/visulima/visulima/compare/@visulima/fs@1.10.0...@visulima/fs@1.11.0) (2024-03-20)


### Features

* **fs:** adding ensure methods ([#355](https://github.com/visulima/visulima/issues/355)) ([0456bc7](https://github.com/visulima/visulima/commit/0456bc7753d8a117e5bab23d74000906ba1d98ba))

## @visulima/fs [1.10.0](https://github.com/visulima/visulima/compare/@visulima/fs@1.9.0...@visulima/fs@1.10.0) (2024-03-19)


### Features

* **fs:** added remove a wrapper around rm and unlink ([#354](https://github.com/visulima/visulima/issues/354)) ([ea30c3e](https://github.com/visulima/visulima/commit/ea30c3e3efd75e2bf07ca81af701543e087aff25))

## @visulima/fs [1.9.0](https://github.com/visulima/visulima/compare/@visulima/fs@1.8.0...@visulima/fs@1.9.0) (2024-03-19)


### Features

* **fs:** added read and write yaml functions ([#351](https://github.com/visulima/visulima/issues/351)) ([365b1ed](https://github.com/visulima/visulima/commit/365b1ed5cbf33c356e4427fb4fd8f2d93ee14733))

## @visulima/fs [1.8.0](https://github.com/visulima/visulima/compare/@visulima/fs@1.7.1...@visulima/fs@1.8.0) (2024-03-17)


### Features

* **fs:** added eol, emptyDir and emptyDirSync ([#348](https://github.com/visulima/visulima/issues/348)) ([8084200](https://github.com/visulima/visulima/commit/8084200779f671403b9585c3b6fec985641c1cf6))

## @visulima/fs [1.7.1](https://github.com/visulima/visulima/compare/@visulima/fs@1.7.0...@visulima/fs@1.7.1) (2024-03-16)



### Dependencies

* **@visulima/error:** upgraded to 3.2.1

## @visulima/fs [1.7.0](https://github.com/visulima/visulima/compare/@visulima/fs@1.6.0...@visulima/fs@1.7.0) (2024-03-16)


### Features

* **package:** added cjs and esm export ([#335](https://github.com/visulima/visulima/issues/335)) ([62b873a](https://github.com/visulima/visulima/commit/62b873a76d2a5356e7596d3a7e299d8e51eb2fcd))

## @visulima/fs [1.6.0](https://github.com/visulima/visulima/compare/@visulima/fs@1.5.0...@visulima/fs@1.6.0) (2024-03-14)


### Features

* **fs:** added matcher and FIND_UP_STOP to findup ([#344](https://github.com/visulima/visulima/issues/344)) ([34a5844](https://github.com/visulima/visulima/commit/34a584450416b8e99b70b920357cbde57e2c6b5b))


### Bug Fixes

* **fs:** added missing constants exports ([51915b2](https://github.com/visulima/visulima/commit/51915b257fa416c7fbcca24f16eb98132273cf4c))

## @visulima/fs [1.5.0](https://github.com/visulima/visulima/compare/@visulima/fs@1.4.0...@visulima/fs@1.5.0) (2024-03-14)


### Features

* **fs:** added findUp array support, based on the other the file will be found ([#343](https://github.com/visulima/visulima/issues/343)) ([4816318](https://github.com/visulima/visulima/commit/4816318770049c4d9a9cfa27c251449ce3077e8f))
* **fs:** added new toPath util ([d65cf3e](https://github.com/visulima/visulima/commit/d65cf3e2f53a4d81f927740050741d59bcccfc9f))


### Bug Fixes

* **fs:** fixed wrong return type on findUp ([f3c96de](https://github.com/visulima/visulima/commit/f3c96def18cd8e70093bdd943c2e2f396436dda4))

## @visulima/fs [1.4.0](https://github.com/visulima/visulima/compare/@visulima/fs@1.3.1...@visulima/fs@1.4.0) (2024-03-11)


### Features

* **fs:** added new stringify option to write json ([5549b80](https://github.com/visulima/visulima/commit/5549b80386aa8ea5f47997dea50dc05209245008))

## @visulima/fs [1.3.1](https://github.com/visulima/visulima/compare/@visulima/fs@1.3.0...@visulima/fs@1.3.1) (2024-03-11)


### Bug Fixes

* **fs:** exported the find-up options as type ([f8b2321](https://github.com/visulima/visulima/commit/f8b2321cead794003f5100d2aa8b30b31d42cc64))

## @visulima/fs [1.3.0](https://github.com/visulima/visulima/compare/@visulima/fs@1.2.1...@visulima/fs@1.3.0) (2024-03-11)


### Features

* **fs:** add read and write for file and json ([#341](https://github.com/visulima/visulima/issues/341)) ([a2e16d8](https://github.com/visulima/visulima/commit/a2e16d88ea6b14cef1b55ff7ee5d6a9e4afe262f))

## @visulima/fs [1.2.1](https://github.com/visulima/visulima/compare/@visulima/fs@1.2.0...@visulima/fs@1.2.1) (2024-03-09)


### Bug Fixes

* added missing type module to the package.json ([510c5b7](https://github.com/visulima/visulima/commit/510c5b7e9cdca2b6de104d0b6b0f5ad2fbf50956))

## @visulima/fs [1.2.0](https://github.com/visulima/visulima/compare/@visulima/fs@1.1.0...@visulima/fs@1.2.0) (2024-03-09)


### Features

* added readFile and readFileSync ([#340](https://github.com/visulima/visulima/issues/340)) ([47dd800](https://github.com/visulima/visulima/commit/47dd800cbadc8d353e9546487fa4c288d3f8be79))

## @visulima/fs [1.1.0](https://github.com/visulima/visulima/compare/@visulima/fs@1.0.0...@visulima/fs@1.1.0) (2024-03-09)


### Features

* **fs:** added isAccessibleSync and isAccessible ([#339](https://github.com/visulima/visulima/issues/339)) ([552eaec](https://github.com/visulima/visulima/commit/552eaec4a1b36db08a6386c562fa6a3bf248c40d))

## @visulima/fs 1.0.0 (2024-03-09)


### Features

* **fs:** added collect-sync ([ed76052](https://github.com/visulima/visulima/commit/ed760529d190a177c64c4028c572160da62c9a0f))
* migrating readdir to fs package ([664d567](https://github.com/visulima/visulima/commit/664d5670ac84811963a830b594968f19bf81809a))
* renamed readdir to fs ([29b0564](https://github.com/visulima/visulima/commit/29b0564913cd136cd126a1e3a6d9461a85158930))


### Bug Fixes

* **fs:** fixed test and lint errors ([01e5f92](https://github.com/visulima/visulima/commit/01e5f921fd2a8700f40464bdc77b0a9ea00ab613))
