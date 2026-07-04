## @visulima/progress-bar 1.0.0 (2026-07-03)

### Features

- **progress-bar:** add terminal progress bar package ([9104d4b](https://github.com/visulima/visulima/commit/9104d4bffabe86aa2b0c83331dfd4afd166a3593))
- **progress-bar:** implement fps throttle, eta, per-bar options and hooks ([0a43f95](https://github.com/visulima/visulima/commit/0a43f95270b23c6441bb266cabf52e6e2dfd4960))

### Bug Fixes

- fixed package version ([710e732](https://github.com/visulima/visulima/commit/710e73235b82699c511cfcc2482c491c767b2376))
- **progress-bar:** 3 bug fixes ([499bf5e](https://github.com/visulima/visulima/commit/499bf5e8d33438c88ff2b8802cab2a98ebe82a63))
- Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))
- **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Performance Improvements

- **progress-bar:** throttle multi-bar renders to configured fps ([0682b3e](https://github.com/visulima/visulima/commit/0682b3e97edb09519f1bd9b836b72bacdd2cfb16))

### Documentation

- **progress-bar:** fix CHANGELOG bullet style and README table ([1308ff6](https://github.com/visulima/visulima/commit/1308ff662d2857dfd4c30cf430529dc278b29ec0))

### Styles

- cs fixes ([2a960bb](https://github.com/visulima/visulima/commit/2a960bb1772c9dc70080e2d75d3a0d827034e294))

### Miscellaneous Chores

- add fallow code-intelligence across all packages ([a3b4821](https://github.com/visulima/visulima/commit/a3b48215002e86fed20f2973038b5d4a0aa1ce04))
- apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))
- bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
- **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
- fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
- **progress-bar:** apply pending changes ([e09fee0](https://github.com/visulima/visulima/commit/e09fee0d3afe8b8d2e1ddab1e1529a1381f4b6cf))
- **progress-bar:** housekeeping cleanup ([c6f2860](https://github.com/visulima/visulima/commit/c6f2860d2b71afc7f3ac3571b1fc4d7723fdf595))
- **progress-bar:** upgrade packem to 2.0.0-alpha.76 ([cb0dc71](https://github.com/visulima/visulima/commit/cb0dc7188d7c1eecaa9b247b93a292b20d83f47f))
- re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
- **release:** @visulima/progress-bar@1.0.0-alpha.1 [skip ci]\n\n## @visulima/progress-bar 1.0.0-alpha.1 (2026-04-22) ([49cd065](https://github.com/visulima/visulima/commit/49cd06573f2c593ff55e0ec566362a83679c2edf))
- **release:** @visulima/progress-bar@1.0.0-alpha.2 [skip ci]\n\n## @visulima/progress-bar [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/progress-bar@1.0.0-alpha.1...@visulima/progress-bar@1.0.0-alpha.2) (2026-05-27) ([771ab4a](https://github.com/visulima/visulima/commit/771ab4ad52306917488f5dbb53e0f8d41360069e))
- **release:** @visulima/progress-bar@1.0.0-alpha.3 [skip ci]\n\n## @visulima/progress-bar [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/progress-bar@1.0.0-alpha.2...@visulima/progress-bar@1.0.0-alpha.3) (2026-06-04) ([149f5f0](https://github.com/visulima/visulima/commit/149f5f0f69eadb4b5653932f9bc4871437212a33))
- **release:** @visulima/progress-bar@1.0.0-alpha.4 [skip ci]\n\n## @visulima/progress-bar [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/progress-bar@1.0.0-alpha.3...@visulima/progress-bar@1.0.0-alpha.4) (2026-06-13) ([31132da](https://github.com/visulima/visulima/commit/31132da39a95b36aa9d92ea6b4837ea736291cbc))
- **repo:** sort package.json keys across all packages ([e1fd9ab](https://github.com/visulima/visulima/commit/e1fd9ab467ef96a98c777da1572ff6a50fcf7e71))
- sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))

### Tests

- improve coverage across packages ([91bd6d3](https://github.com/visulima/visulima/commit/91bd6d3b61736e3c8bd1fc59b0b5955f76a5d323))
- **progress-bar:** cover gradient char selection, fallbacks, eta and composite multi-bar paths ([cae30a3](https://github.com/visulima/visulima/commit/cae30a3f47b7f645e0174d4317ecd70f159cec71))
- **progress-bar:** fix eslint errors in progress-bar test files ([9232a88](https://github.com/visulima/visulima/commit/9232a88ee2efd52a56770cea139a836c441901cf))
- **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))

### Continuous Integration

- **fallow:** make fallow:health advisory (--report-only) ([d57148e](https://github.com/visulima/visulima/commit/d57148ea0e3556b4c24d8d336b9fa14987f5dc7d))
- **lint:** raise eslint job timeout and cache slow per-package eslint runs ([#717](https://github.com/visulima/visulima/issues/717)) ([c93878d](https://github.com/visulima/visulima/commit/c93878dbfa1888cc834704448ae6eefd3098597e)), closes [#713](https://github.com/visulima/visulima/issues/713)

### Dependencies

- **@visulima/interactive-manager:** upgraded to 1.0.0

## @visulima/progress-bar [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/progress-bar@1.0.0-alpha.3...@visulima/progress-bar@1.0.0-alpha.4) (2026-06-13)

### Features

- **progress-bar:** implement fps throttle, eta, per-bar options and hooks ([0a43f95](https://github.com/visulima/visulima/commit/0a43f95270b23c6441bb266cabf52e6e2dfd4960))

### Performance Improvements

- **progress-bar:** throttle multi-bar renders to configured fps ([0682b3e](https://github.com/visulima/visulima/commit/0682b3e97edb09519f1bd9b836b72bacdd2cfb16))

### Documentation

- **progress-bar:** fix CHANGELOG bullet style and README table ([1308ff6](https://github.com/visulima/visulima/commit/1308ff662d2857dfd4c30cf430529dc278b29ec0))

### Dependencies

- **@visulima/interactive-manager:** upgraded to 1.0.0-alpha.5

## @visulima/progress-bar [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/progress-bar@1.0.0-alpha.2...@visulima/progress-bar@1.0.0-alpha.3) (2026-06-04)

### Bug Fixes

- **progress-bar:** 3 bug fixes ([499bf5e](https://github.com/visulima/visulima/commit/499bf5e8d33438c88ff2b8802cab2a98ebe82a63))

### Miscellaneous Chores

- apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))

### Tests

- improve coverage across packages ([91bd6d3](https://github.com/visulima/visulima/commit/91bd6d3b61736e3c8bd1fc59b0b5955f76a5d323))
- **progress-bar:** cover gradient char selection, fallbacks, eta and composite multi-bar paths ([cae30a3](https://github.com/visulima/visulima/commit/cae30a3f47b7f645e0174d4317ecd70f159cec71))
- **progress-bar:** fix eslint errors in progress-bar test files ([9232a88](https://github.com/visulima/visulima/commit/9232a88ee2efd52a56770cea139a836c441901cf))

### Dependencies

- **@visulima/interactive-manager:** upgraded to 1.0.0-alpha.4

## @visulima/progress-bar [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/progress-bar@1.0.0-alpha.1...@visulima/progress-bar@1.0.0-alpha.2) (2026-05-27)

### Bug Fixes

- **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Miscellaneous Chores

- **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
- **progress-bar:** housekeeping cleanup ([c6f2860](https://github.com/visulima/visulima/commit/c6f2860d2b71afc7f3ac3571b1fc4d7723fdf595))
- **progress-bar:** upgrade packem to 2.0.0-alpha.76 ([cb0dc71](https://github.com/visulima/visulima/commit/cb0dc7188d7c1eecaa9b247b93a292b20d83f47f))
- re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
- **repo:** sort package.json keys across all packages ([e1fd9ab](https://github.com/visulima/visulima/commit/e1fd9ab467ef96a98c777da1572ff6a50fcf7e71))
- sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))

### Tests

- **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))

### Dependencies

- **@visulima/interactive-manager:** upgraded to 1.0.0-alpha.3

## @visulima/progress-bar 1.0.0-alpha.1 (2026-04-22)

### Features

- **progress-bar:** add terminal progress bar package ([9104d4b](https://github.com/visulima/visulima/commit/9104d4bffabe86aa2b0c83331dfd4afd166a3593))

### Bug Fixes

- fixed package version ([710e732](https://github.com/visulima/visulima/commit/710e73235b82699c511cfcc2482c491c767b2376))
- Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))

### Miscellaneous Chores

- bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
- fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
- **progress-bar:** apply pending changes ([e09fee0](https://github.com/visulima/visulima/commit/e09fee0d3afe8b8d2e1ddab1e1529a1381f4b6cf))
