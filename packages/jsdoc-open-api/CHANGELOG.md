## @visulima/jsdoc-open-api [1.3.6](https://github.com/visulima/visulima/compare/@visulima/jsdoc-open-api@1.3.5...@visulima/jsdoc-open-api@1.3.6) (2023-05-29)


### Bug Fixes

* fixed wrong path for windows ([53cb491](https://github.com/visulima/visulima/commit/53cb4916dc072af385255936da2e054509f9b712))
* There's a difference in Node's handling of imports across OSes. You can find more info + the recommended solution in this issue: nodejs/node[#31710](https://github.com/visulima/visulima/issues/31710) ([c8709c2](https://github.com/visulima/visulima/commit/c8709c24c13a1fb90a029f17713157722f703107))

## @visulima/jsdoc-open-api [1.3.5](https://github.com/visulima/visulima/compare/@visulima/jsdoc-open-api@1.3.4...@visulima/jsdoc-open-api@1.3.5) (2023-05-29)


### Bug Fixes

* added read-pkg-up to check if the first found package.json has the type key to create the correct config file export ([edc0e6e](https://github.com/visulima/visulima/commit/edc0e6e5cfef0b93a4280f67cd2dec37581e0dc6))

## @visulima/jsdoc-open-api [1.3.4](https://github.com/visulima/visulima/compare/@visulima/jsdoc-open-api@1.3.3...@visulima/jsdoc-open-api@1.3.4) (2023-05-26)


### Bug Fixes

* **#146:** check if config is a commonjs file ([e8f4522](https://github.com/visulima/visulima/commit/e8f45227b5df10a7b1652326141c5d4e47399b61)), closes [#146](https://github.com/visulima/visulima/issues/146)

## @visulima/jsdoc-open-api [1.3.3](https://github.com/visulima/visulima/compare/@visulima/jsdoc-open-api@1.3.2...@visulima/jsdoc-open-api@1.3.3) (2023-05-25)


### Bug Fixes

* chore updated the deps, changed replace to replaceAll and the engine to allow node v20 ([6298590](https://github.com/visulima/visulima/commit/62985907cc9a1b0067f7603e6623294d1c9fec75))
* fixed all calls to radar with sonarjs, removed radar eslint package ([001aecf](https://github.com/visulima/visulima/commit/001aecf78dde134bade44f382698d52eedbd3bbe))
* updated package deps ([5f605aa](https://github.com/visulima/visulima/commit/5f605aab74a7c1f4cbdfe4502363e36d57716921))



### Dependencies

* **@visulima/readdir:** upgraded to 1.3.5

## @visulima/jsdoc-open-api [1.3.2](https://github.com/visulima/visulima/compare/@visulima/jsdoc-open-api@1.3.1...@visulima/jsdoc-open-api@1.3.2) (2023-01-25)


### Bug Fixes

* updated tsconfig to use module esnext and target es2021 ([#107](https://github.com/visulima/visulima/issues/107)) ([e888fe8](https://github.com/visulima/visulima/commit/e888fe8d15c99453a3c04f2cf9d2f6c69c158648))



### Dependencies

* **@visulima/readdir:** upgraded to 1.3.4

## @visulima/jsdoc-open-api [1.3.1](https://github.com/visulima/visulima/compare/@visulima/jsdoc-open-api@1.3.0...@visulima/jsdoc-open-api@1.3.1) (2023-01-08)


### Bug Fixes

* allow higher node versions ([c93d55b](https://github.com/visulima/visulima/commit/c93d55b80135282235e933da52d9c88ade3073a8))
* allow higher node versions ([faf4780](https://github.com/visulima/visulima/commit/faf478069f3508249db22ed2171ddee4fa380122))



### Dependencies

* **@visulima/readdir:** upgraded to 1.3.3

## @visulima/jsdoc-open-api [1.3.0](https://github.com/visulima/visulima/compare/@visulima/jsdoc-open-api@1.2.2...@visulima/jsdoc-open-api@1.3.0) (2022-12-22)


### Features

* **jsdoc-open-api:** exported the init (create config) and generate … ([#70](https://github.com/visulima/visulima/issues/70)) ([935f7bf](https://github.com/visulima/visulima/commit/935f7bf299fc1d0591132d08b3b40502f7e9ccf8))

## @visulima/jsdoc-open-api [1.2.2](https://github.com/visulima/visulima/compare/@visulima/jsdoc-open-api@1.2.1...@visulima/jsdoc-open-api@1.2.2) (2022-12-10)



### Dependencies

* **@visulima/readdir:** upgraded to 1.3.2

## @visulima/jsdoc-open-api [1.2.1](https://github.com/visulima/visulima/compare/@visulima/jsdoc-open-api@1.2.0...@visulima/jsdoc-open-api@1.2.1) (2022-12-01)


### Bug Fixes

* added correct folder to files key in package.json ([da9f987](https://github.com/visulima/visulima/commit/da9f9871462a0b2663046cde5f05e9a90df4c496))



### Dependencies

* **@visulima/readdir:** upgraded to 1.3.1

## @visulima/jsdoc-open-api [1.2.0](https://github.com/visulima/visulima/compare/@visulima/jsdoc-open-api@1.1.1...@visulima/jsdoc-open-api@1.2.0) (2022-11-15)


### Features

* added new packages for faster api creation ([#14](https://github.com/visulima/visulima/issues/14)) ([eb64fcf](https://github.com/visulima/visulima/commit/eb64fcf33f2a75ea48262ad6e71f80e159a93972))



### Dependencies

* **@visulima/readdir:** upgraded to 1.3.0

## @visulima/jsdoc-open-api [1.1.1](https://github.com/visulima/visulima/compare/@visulima/jsdoc-open-api@1.1.0...@visulima/jsdoc-open-api@1.1.1) (2022-10-31)


### Bug Fixes

* **jsdoc-open-api:** make bin file executable ([469cb9b](https://github.com/visulima/visulima/commit/469cb9bd32e1815354a46c1dd6fca8c1a3532f32))
* **jsdoc-open-api:** removed second to in the txt ([dc5eebb](https://github.com/visulima/visulima/commit/dc5eebb96c220c21171753238eb6b1d7c2da58a1))

## @visulima/jsdoc-open-api [1.1.0](https://github.com/visulima/visulima/compare/@visulima/jsdoc-open-api@1.0.3...@visulima/jsdoc-open-api@1.1.0) (2022-10-29)


### Features

* **jsdoc-open-api:** added includeDirs: false to the collect func to hidde dir output ([c77f5ca](https://github.com/visulima/visulima/commit/c77f5cad73856de17e576af61cce661cb4f65189))



### Dependencies

* **@visulima/readdir:** upgraded to 1.2.0

## @visulima/jsdoc-open-api [1.0.3](https://github.com/visulima/visulima/compare/@visulima/jsdoc-open-api@1.0.2...@visulima/jsdoc-open-api@1.0.3) (2022-10-27)


### Bug Fixes

* fixed package.json files paths ([0d21e94](https://github.com/visulima/visulima/commit/0d21e94a75e9518f7b87293706615d8fb280095c))



### Dependencies

* **@visulima/readdir:** upgraded to 1.1.1

## @visulima/jsdoc-open-api [1.0.2](https://github.com/visulima/visulima/compare/@visulima/jsdoc-open-api@1.0.1...@visulima/jsdoc-open-api@1.0.2) (2022-10-27)


### Bug Fixes

* **jsdoc-open-api:** fixed found errors with empty data, writing swagger file to a not existing folder, added more error returns ([8cef566](https://github.com/visulima/visulima/commit/8cef566b998d37a5c0f5c32acabf8e336510ec81))
* **jsdoc-open-api:** fixed wrong options for minimatchOptions and added default exclude for the webpack plugin ([e6cba73](https://github.com/visulima/visulima/commit/e6cba73a5add43042249e0caff0d6d605f694274))

## @visulima/jsdoc-open-api [1.0.1](https://github.com/visulima/visulima/compare/@visulima/jsdoc-open-api@1.0.0...@visulima/jsdoc-open-api@1.0.1) (2022-10-26)


### Bug Fixes

* **jsdoc-open-api:** make package public ([f266edf](https://github.com/visulima/visulima/commit/f266edf64fb21f2510d9ab15e27e48909d593a58))

## @visulima/jsdoc-open-api 1.0.0 (2022-10-26)


### Features

* **jsdoc-open-api:** added connect as new package for swagger parsing ([a641712](https://github.com/visulima/visulima/commit/a641712ab27616d38250fdd86a6cdc5c865ddd80))



### Dependencies

* **@visulima/readdir:** upgraded to 1.1.0
