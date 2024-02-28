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
