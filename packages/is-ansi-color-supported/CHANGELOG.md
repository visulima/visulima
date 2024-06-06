## @visulima/is-ansi-color-supported [2.2.1](https://github.com/visulima/visulima/compare/@visulima/is-ansi-color-supported@2.2.0...@visulima/is-ansi-color-supported@2.2.1) (2024-06-06)


### Bug Fixes

* allow node v22 ([890d457](https://github.com/visulima/visulima/commit/890d4570f18428e2463944813c0c638b3f142803))


### Styles

* cs fixes ([7bf5b91](https://github.com/visulima/visulima/commit/7bf5b91383b612598d955fe23505c94f22a8d277))


### Miscellaneous Chores

* changed semantic-release-npm to pnpm ([b6d100a](https://github.com/visulima/visulima/commit/b6d100a2bf3fd026577be48726a37754947f0973))
* **deps:** updated dev deps ([d91ac38](https://github.com/visulima/visulima/commit/d91ac389cea85a6c6bdc8de97905252a6c467abc))
* update dev dependencies ([068bdbf](https://github.com/visulima/visulima/commit/068bdbfe0b371b5cc7e5ac071dc3310a3b8cea98))
* update dev dependencies ([09c4854](https://github.com/visulima/visulima/commit/09c4854e221fa8b808dfe66d7196d8db2a39b366))
* updated dev dependencies ([a2e0504](https://github.com/visulima/visulima/commit/a2e0504dc239049434c2482756ff15bdbaac9b54))
* updated dev dependencies ([abd319c](https://github.com/visulima/visulima/commit/abd319c23576aa1dc751ac874e806bddbc977d51))
* updated dev dependencies ([0767afe](https://github.com/visulima/visulima/commit/0767afe9be83da6698c1343724400171f952599e))
* updated dev dependencies ([d7791e3](https://github.com/visulima/visulima/commit/d7791e327917e438757636573b1e5549a97bba7b))
* updated dev dependencies ([6005345](https://github.com/visulima/visulima/commit/60053456717a3889fc77b4fb5b05d50a662475b2))

## @visulima/is-ansi-color-supported [2.2.0](https://github.com/visulima/visulima/compare/@visulima/is-ansi-color-supported@2.1.0...@visulima/is-ansi-color-supported@2.2.0) (2024-04-09)


### Features

* **is-ansi-color-supported:** add support for PM2 process manager ([dd8bb6f](https://github.com/visulima/visulima/commit/dd8bb6f93a9abff12f2a89fd06651559010d586a))
* **is-ansi-color-support:** updated readme ([38ca0a0](https://github.com/visulima/visulima/commit/38ca0a0fcf2d644bdfa80a324c6b4e16dc5e4afa))


### Bug Fixes

* fixed CLI flags and FORCE_COLOR should precede other color support checks ([d8b524e](https://github.com/visulima/visulima/commit/d8b524e27a28b8818bb306f032e8eb17f1dfb237))

## @visulima/is-ansi-color-supported [2.1.0](https://github.com/visulima/visulima/compare/@visulima/is-ansi-color-supported@2.0.2...@visulima/is-ansi-color-supported@2.1.0) (2024-04-09)


### Features

* **is-ansi-color-supported:** added new const exports, added check f… ([#390](https://github.com/visulima/visulima/issues/390)) ([167f5b3](https://github.com/visulima/visulima/commit/167f5b3936a9fadcb30c748bf0533c89fed8c6ab))

## @visulima/is-ansi-color-supported [2.0.2](https://github.com/visulima/visulima/compare/@visulima/is-ansi-color-supported@2.0.1...@visulima/is-ansi-color-supported@2.0.2) (2024-03-27)


### Bug Fixes

* added missing os key to package.json ([4ad1268](https://github.com/visulima/visulima/commit/4ad1268ed12cbdcf60aeb46d4c052ed1696bc150))

## @visulima/is-ansi-color-supported [2.0.1](https://github.com/visulima/visulima/compare/@visulima/is-ansi-color-supported@2.0.0...@visulima/is-ansi-color-supported@2.0.1) (2024-03-04)


### Bug Fixes

* fixed all found type issues ([eaa40d1](https://github.com/visulima/visulima/commit/eaa40d11f3fc056dfddcc25404bf109587ef2862))
* minifyWhitespace on prod build, removed @tsconfig/* configs ([410cb73](https://github.com/visulima/visulima/commit/410cb737c44c445a0479bdd49b4100d5daf2d83d))

## @visulima/is-ansi-color-supported [2.0.0](https://github.com/visulima/visulima/compare/@visulima/is-ansi-color-supported@1.2.0...@visulima/is-ansi-color-supported@2.0.0) (2024-02-28)


### ⚠ BREAKING CHANGES

* export changed to isStderrColorSupported,isStdoutColorSupported; isColorSupported is now isStdoutColorSupported

Signed-off-by: prisis <d.bannert@anolilab.de>

### Features

* added support for stderr, migrated deno api to v2 ([2e8ac8f](https://github.com/visulima/visulima/commit/2e8ac8f0251719aa54a2bf3466618d47988dd248))


### Bug Fixes

* fixed tests ([12c7b71](https://github.com/visulima/visulima/commit/12c7b716f716f9190d462c1b8665989b57602160))

## @visulima/is-ansi-color-supported [1.2.0](https://github.com/visulima/visulima/compare/@visulima/is-ansi-color-supported@1.1.0...@visulima/is-ansi-color-supported@1.2.0) (2024-02-20)


### Features

* add detection of additional terminals, thanks [@dse](https://github.com/dse), [colors.js:issue [#42](https://github.com/visulima/visulima/issues/42)](https://github.com/DABH/colors.js/issues/42) ([d2f034d](https://github.com/visulima/visulima/commit/d2f034de2ea41bce4c09fe7a40d8e9aa8ad4401c))

## @visulima/is-ansi-color-supported [1.1.0](https://github.com/visulima/visulima/compare/@visulima/is-ansi-color-supported@1.0.0...@visulima/is-ansi-color-supported@1.1.0) (2024-01-31)


### Features

* added GITHUB_WORKFLOW env to the ansi color check ([080ec5f](https://github.com/visulima/visulima/commit/080ec5f0ad2fc651d41ced92cc7e21401df725ff))

## @visulima/is-ansi-color-supported 1.0.0 (2024-01-28)


### Features

* added colorize and is-ansi-color-supported ([e2d9945](https://github.com/visulima/visulima/commit/e2d9945a5666bc8f3be0aea9b5aca45f2ba44284))


### Bug Fixes

* fixed wrong package.json ([43dd507](https://github.com/visulima/visulima/commit/43dd507419c7020251396bfc26854a360e72d605))
