## @visulima/storage [1.0.0-alpha.32](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.31...@visulima/storage@1.0.0-alpha.32) (2026-05-27)

### Features

* **storage:** add move, listAll, hooks, range, multipart, transfer, MemoryStorage ([1750846](https://github.com/visulima/visulima/commit/1750846768a2e6b088bdc44485851c07b0863afe))

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Documentation

* prettier-format agent instructions ([71b6414](https://github.com/visulima/visulima/commit/71b6414528780ac82c4e0bb25b5f4f11faba5549))


### Dependencies

* **@visulima/pagination:** upgraded to 5.0.0-alpha.12
* **@visulima/fs:** upgraded to 5.0.0-alpha.28
* **@visulima/path:** upgraded to 3.0.0-alpha.11

## @visulima/storage [1.0.0-alpha.31](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.30...@visulima/storage@1.0.0-alpha.31) (2026-05-26)

### Features

* **storage:** add bulk operations, prefix namespacing, and per-call options ([95f2c9d](https://github.com/visulima/visulima/commit/95f2c9d3f86a04824c65cf358df8393c78062ae2))

### Bug Fixes

* **storage:** satisfy eslint on bulk-ops files ([25602d4](https://github.com/visulima/visulima/commit/25602d405c4fb333eb16cb35f557d4cf8ce322ff))

### Miscellaneous Chores

* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **repo:** apply eslint --fix and prettier --fix across packages ([#650](https://github.com/visulima/visulima/issues/650)) ([2e26a84](https://github.com/visulima/visulima/commit/2e26a84774f218f21345e9a8ecd68236b6542743)), closes [#620](https://github.com/visulima/visulima/issues/620)

### Tests

* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.26

## @visulima/storage [1.0.0-alpha.30](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.29...@visulima/storage@1.0.0-alpha.30) (2026-05-20)

### Features

* **storage:** add Vercel OIDC support to vercel-blob adapter ([f6fbdd9](https://github.com/visulima/visulima/commit/f6fbdd98ac96194a944c10dd9fc4bb54c1669505))

### Continuous Integration

* build vis deps before schema drift + drop nested nuxt exports ([e217fcd](https://github.com/visulima/visulima/commit/e217fcdf3660cb73dd85514a0a387762ee52b873))
* tighten workflow yaml + restore missing publint dep ([b478f9a](https://github.com/visulima/visulima/commit/b478f9a9329d9c7243e694e3f360d385cc34567c))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.25

## @visulima/storage [1.0.0-alpha.29](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.28...@visulima/storage@1.0.0-alpha.29) (2026-05-19)

### Features

* **storage:** add Bun-native S3 adapter and S3-compatible docs ([12650a4](https://github.com/visulima/visulima/commit/12650a4d9da7ca93a3d0f86c0952026dcdaa03ed))
* **storage:** add Cloudinary, Firebase, PocketBase, SharePoint adapters + S3-compat presets ([72e0fc5](https://github.com/visulima/visulima/commit/72e0fc5e0d433f5af0768e7d194a1d533dd46940))
* **storage:** add FTP and SFTP storage backends ([5631dd2](https://github.com/visulima/visulima/commit/5631dd2d1193bc51decc8cc34a1c71df1220d75a))
* **storage:** add per-operation signal/timeout/retries ([45797da](https://github.com/visulima/visulima/commit/45797dacb4757ab9a1c857ed4f795e50d41fdbab))

### Bug Fixes

* **storage:** make operation timeout per-attempt ([3610ffa](https://github.com/visulima/visulima/commit/3610ffa498c1bf7ec8515ddf1e556648393c149e))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.24

## @visulima/storage [1.0.0-alpha.28](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.27...@visulima/storage@1.0.0-alpha.28) (2026-05-16)

### Features

* **storage:** add exists() to Files facade ([#633](https://github.com/visulima/visulima/issues/633)) ([86893da](https://github.com/visulima/visulima/commit/86893da4f462b652e6b5821a4eece997f9f9890d))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.23

## @visulima/storage [1.0.0-alpha.27](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.26...@visulima/storage@1.0.0-alpha.27) (2026-05-14)

### Features

* **storage:** add Bunny, consumer providers, and S3 client expansions ([c03bad7](https://github.com/visulima/visulima/commit/c03bad782698dfc7f9a19139f5ccf22fcc695132))
* **storage:** add Files facade and AI tool integrations ([969311a](https://github.com/visulima/visulima/commit/969311a9f1d7c2644bc3d2bbf4fc67a6b232328d))
* **storage:** clear lint findings across cloud adapters ([42ab8f4](https://github.com/visulima/visulima/commit/42ab8f47013b326c9e602236f819120f2fbf5a74))

### Bug Fixes

* **storage:** align tests and adapters with lint rules ([0b2db31](https://github.com/visulima/visulima/commit/0b2db31cc5d7fca76a43d6bb7d73c9767855df9d))

### Documentation

* **storage:** rewrite docs to lead with Files facade ([0c3a7bf](https://github.com/visulima/visulima/commit/0c3a7bf238a2873226b5d44b4a3e5164f9c634b9))

### Miscellaneous Chores

* upate lock and readme ([a4c331e](https://github.com/visulima/visulima/commit/a4c331e7f7e498d6c23435b18040862f402b7557))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.22

## @visulima/storage [1.0.0-alpha.26](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.25...@visulima/storage@1.0.0-alpha.26) (2026-05-11)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.21

## @visulima/storage [1.0.0-alpha.25](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.24...@visulima/storage@1.0.0-alpha.25) (2026-05-11)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.20

## @visulima/storage [1.0.0-alpha.24](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.23...@visulima/storage@1.0.0-alpha.24) (2026-05-10)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.19

## @visulima/storage [1.0.0-alpha.23](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.22...@visulima/storage@1.0.0-alpha.23) (2026-05-10)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.18

## @visulima/storage [1.0.0-alpha.22](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.21...@visulima/storage@1.0.0-alpha.22) (2026-05-07)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.17

## @visulima/storage [1.0.0-alpha.21](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.20...@visulima/storage@1.0.0-alpha.21) (2026-05-07)

### Miscellaneous Chores

* **storage:** bump sharp peer to >=0.34.5 ([2a40154](https://github.com/visulima/visulima/commit/2a401542f3a02c21e441fa97c196785d9f9276c8))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.16

## @visulima/storage [1.0.0-alpha.20](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.19...@visulima/storage@1.0.0-alpha.20) (2026-05-06)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.15

## @visulima/storage [1.0.0-alpha.19](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.18...@visulima/storage@1.0.0-alpha.19) (2026-05-06)

### Miscellaneous Chores

* re-enable jsdoc/match-description in api-platform and tighten config docs ([4ecaa31](https://github.com/visulima/visulima/commit/4ecaa315064cdd798af1ea1296be1fe52967bf9a))
* **storage:** apply partial lint cleanup from agent batch ([ffcbea2](https://github.com/visulima/visulima/commit/ffcbea2a738fd2a116b26e58eda433109a944d85))
* **storage:** apply prettier and eslint quote-style auto-fix ([437aab6](https://github.com/visulima/visulima/commit/437aab6dc248a8ac058c2af3832bd898a2c51053))
* **storage:** clear lint and prettier diagnostics ([d6c05b1](https://github.com/visulima/visulima/commit/d6c05b11d278d844c872a6cd3364f95778381003))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.14

## @visulima/storage [1.0.0-alpha.18](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.17...@visulima/storage@1.0.0-alpha.18) (2026-05-04)


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.13

## @visulima/storage [1.0.0-alpha.17](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.16...@visulima/storage@1.0.0-alpha.17) (2026-04-30)

## @visulima/storage [1.0.0-alpha.16](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.15...@visulima/storage@1.0.0-alpha.16) (2026-04-28)

### Bug Fixes

* **storage:** pin BaseStorage TFile generic and cast list body ([13f0253](https://github.com/visulima/visulima/commit/13f0253c61f96b0daa4d18e17b273eddea27e20a))

### Miscellaneous Chores

* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))
* **storage:** upgrade packem to 2.0.0-alpha.76 ([9095f20](https://github.com/visulima/visulima/commit/9095f201a4d28970badbf69f8de1eb87aa9f3c2d))

## @visulima/storage [1.0.0-alpha.15](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.14...@visulima/storage@1.0.0-alpha.15) (2026-04-22)

### Bug Fixes

* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))


### Dependencies

* **@visulima/pagination:** upgraded to 5.0.0-alpha.11
* **@visulima/fs:** upgraded to 5.0.0-alpha.12
* **@visulima/humanizer:** upgraded to 3.0.0-alpha.11
* **@visulima/path:** upgraded to 3.0.0-alpha.10

## @visulima/storage [1.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.13...@visulima/storage@1.0.0-alpha.14) (2026-04-21)

### Miscellaneous Chores

* jsr.json update and lock file ([73fce38](https://github.com/visulima/visulima/commit/73fce38c7cb4603f3fffb88609b1b18e2feb4937))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.11

## @visulima/storage [1.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.12...@visulima/storage@1.0.0-alpha.13) (2026-04-21)

### Miscellaneous Chores

* update the jsr.json ([864ab7e](https://github.com/visulima/visulima/commit/864ab7e71c4b5ae82f64792d1ae8debfea2c539b))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.10

## @visulima/storage [1.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.11...@visulima/storage@1.0.0-alpha.12) (2026-04-21)

### Bug Fixes

* **storage:** parameterize BaseStorage with subclass file type for gcs/netlify/vercel ([4d26390](https://github.com/visulima/visulima/commit/4d26390c75023edba40dc38d1291808e0722fdeb))
* **storage:** pass concrete file types as BaseStorage generics ([6a4e8f7](https://github.com/visulima/visulima/commit/6a4e8f7bba252be24cf8f9763abb0f63f6d25832))
* **storage:** resolve eslint and formatting issues ([31e5078](https://github.com/visulima/visulima/commit/31e5078beb640bfca419c144ca22fbfef56926cd))
* **tui:** inline component and hook barrel exports in ink entry ([1cf8dd2](https://github.com/visulima/visulima/commit/1cf8dd25c91a2001268fb9d964d95df649bf7832))

### Miscellaneous Chores

* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))
* **storage:** apply formatter and lint fixes ([093d35e](https://github.com/visulima/visulima/commit/093d35edc53ed4e8f48c86b48a74e4062a7e539e))
* **storage:** apply pending changes ([89a3f64](https://github.com/visulima/visulima/commit/89a3f647d2836a0c48b224d28658ac912e9e1af2))
* **storage:** enforce curly braces and apply lint fixes ([2093253](https://github.com/visulima/visulima/commit/20932531885ae51604907008f730b9edbc06b962))

### Code Refactoring

* **crud:** break handler <-> types circular imports ([#613](https://github.com/visulima/visulima/issues/613)) ([a3c7692](https://github.com/visulima/visulima/commit/a3c7692a5c47cb6ce2284cef7507f4fb992ad3a3))
* replace inline import() types with top-level imports ([4569a4c](https://github.com/visulima/visulima/commit/4569a4ca04723da069f985855dcfab292f7347e1))
* **storage:** format code with prettier ([21477ce](https://github.com/visulima/visulima/commit/21477ce4354f83f68fbcbd11e07621e3329357e2))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.9

## @visulima/storage [1.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.10...@visulima/storage@1.0.0-alpha.11) (2026-04-08)

### Bug Fixes

* remove deprecated baseUrl and downlevelIteration from tsconfigs ([a708366](https://github.com/visulima/visulima/commit/a708366b5c3bc73cfde480a712ed397bd921fb93))
* **storage:** fix tsconfig.eslint.json to extend local tsconfig ([af2628a](https://github.com/visulima/visulima/commit/af2628ae8a8bc6f10693a96c9280feb81da2c0eb))

### Miscellaneous Chores

* **storage:** apply prettier formatting ([b2fa58d](https://github.com/visulima/visulima/commit/b2fa58d4364fa580b321b2df47a4264fd22eb070))
* **storage:** expand inline if-return to block syntax ([29671ac](https://github.com/visulima/visulima/commit/29671ac54f22ae01029f40be73dbd745a1e9a8f9))
* **storage:** migrate .prettierrc.cjs to prettier.config.js ([98b0fe6](https://github.com/visulima/visulima/commit/98b0fe60cd98ea4c33b8a54ee0b2229ad3c1d4c1))
* **storage:** remove empty dependency objects from package.json ([ddfeb08](https://github.com/visulima/visulima/commit/ddfeb08fd392ad2553a1ce833dd331540ecc8b09))


### Dependencies

* **@visulima/pagination:** upgraded to 5.0.0-alpha.9
* **@visulima/fs:** upgraded to 5.0.0-alpha.7
* **@visulima/humanizer:** upgraded to 3.0.0-alpha.9
* **@visulima/path:** upgraded to 3.0.0-alpha.8

## @visulima/storage [1.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.9...@visulima/storage@1.0.0-alpha.10) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))


### Dependencies

* **@visulima/pagination:** upgraded to 5.0.0-alpha.8
* **@visulima/fs:** upgraded to 5.0.0-alpha.6
* **@visulima/humanizer:** upgraded to 3.0.0-alpha.8
* **@visulima/path:** upgraded to 3.0.0-alpha.7

## @visulima/storage [1.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.8...@visulima/storage@1.0.0-alpha.9) (2026-03-26)

### Bug Fixes

* **storage:** use workspace:* for internal [@visulima](https://github.com/visulima) deps ([ff79afe](https://github.com/visulima/visulima/commit/ff79afe26f1941eab24cff80477d8c18aaec65e9))
* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Miscellaneous Chores

* **storage:** migrate deps to pnpm catalogs ([7dfea89](https://github.com/visulima/visulima/commit/7dfea8981d74cd84317133242d2ab5a31f3f98b7))

### Code Refactoring

* **docs:** migrate Nextra components to fumadocs-ui, remove Nextra stripping ([484878f](https://github.com/visulima/visulima/commit/484878f01879363ef5e9a0282904dc4627d6060c))


### Dependencies

* **@visulima/pagination:** upgraded to 5.0.0-alpha.7
* **@visulima/fs:** upgraded to 5.0.0-alpha.5
* **@visulima/humanizer:** upgraded to 3.0.0-alpha.7
* **@visulima/path:** upgraded to 3.0.0-alpha.6

## @visulima/storage [1.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.7...@visulima/storage@1.0.0-alpha.8) (2026-03-16)

### Bug Fixes

* resolve 5 audit vulnerabilities (simple-git, express-rate-limit, tar, file-type, hono) ([2986d77](https://github.com/visulima/visulima/commit/2986d770746afd3223a074dc1a1a0040cca56e61))

### Miscellaneous Chores

* **storage:** update dependencies ([a2d2577](https://github.com/visulima/visulima/commit/a2d257702693aac7f368bddfd0481cdac09c3901))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))

## @visulima/storage [1.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.6...@visulima/storage@1.0.0-alpha.7) (2026-03-06)

### Bug Fixes

* **storage:** update packem to 2.0.0-alpha.54 ([a65ad87](https://github.com/visulima/visulima/commit/a65ad877ac5804a0c1354331a380fbcceddf261f))

### Miscellaneous Chores

* **storage:** update dependencies ([19b3d5c](https://github.com/visulima/visulima/commit/19b3d5c5fd1e535fbbb1419a827e5c4c0b35fa77))
* **storage:** update dependencies ([f591768](https://github.com/visulima/visulima/commit/f591768de337c1b201191e4b78dd7e3fb79ca42b))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))

### Code Refactoring

* **storage:** replace SuperHeaders with native Headers ([68546c5](https://github.com/visulima/visulima/commit/68546c52bedad5c1338d571ad9a2034cc9f49b53))


### Dependencies

* **@visulima/pagination:** upgraded to 5.0.0-alpha.6
* **@visulima/fs:** upgraded to 5.0.0-alpha.4
* **@visulima/humanizer:** upgraded to 3.0.0-alpha.6
* **@visulima/path:** upgraded to 3.0.0-alpha.5

## @visulima/storage [1.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.5...@visulima/storage@1.0.0-alpha.6) (2026-01-17)

### Miscellaneous Chores

* **storage:** update dependencies ([b2450d8](https://github.com/visulima/visulima/commit/b2450d8f096991389ceed4bf4def2f99363daf6f))


### Dependencies

* **@visulima/pagination:** upgraded to 5.0.0-alpha.5

## @visulima/storage [1.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.4...@visulima/storage@1.0.0-alpha.5) (2025-12-27)

### Bug Fixes

* **dependencies:** update hono and related packages to version 4.11.2 and update @hono/swagger-ui to version 0.5.3 ([5d3eed5](https://github.com/visulima/visulima/commit/5d3eed57d30d8216bf91484f35d39678938651fb))
* **storage:** update package files ([5ef0060](https://github.com/visulima/visulima/commit/5ef0060c39b4457395583a828eb2f72fc3949496))

### Miscellaneous Chores

* **dependencies:** update file-type to version 21.2.0, hono to version 4.11.3, and improve README for storage-client with detailed usage examples ([90bebfa](https://github.com/visulima/visulima/commit/90bebfa9b732afd8d80c133ca0636192b8496801))
* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))


### Dependencies

* **@visulima/pagination:** upgraded to 5.0.0-alpha.4
* **@visulima/fs:** upgraded to 5.0.0-alpha.3
* **@visulima/humanizer:** upgraded to 3.0.0-alpha.5
* **@visulima/path:** upgraded to 3.0.0-alpha.4

## @visulima/storage [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.3...@visulima/storage@1.0.0-alpha.4) (2025-12-11)

### Bug Fixes

* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))


### Dependencies

* **@visulima/pagination:** upgraded to 5.0.0-alpha.3
* **@visulima/fs:** upgraded to 5.0.0-alpha.2
* **@visulima/humanizer:** upgraded to 3.0.0-alpha.4
* **@visulima/path:** upgraded to 3.0.0-alpha.3

## @visulima/storage [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.2...@visulima/storage@1.0.0-alpha.3) (2025-12-10)


### Dependencies

* **@visulima/humanizer:** upgraded to 3.0.0-alpha.3

## @visulima/storage [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/storage@1.0.0-alpha.1...@visulima/storage@1.0.0-alpha.2) (2025-12-07)

### ⚠ BREAKING CHANGES

* change min node version to 22.13

### Bug Fixes

* add new package image, fixed readme rendering on npm, fixed building of packages ([b790ba2](https://github.com/visulima/visulima/commit/b790ba253ea07fef83528fd822a678facf021b5f))
* update Node.js engine version requirement to >=22.13 in multiple package.json files for improved compatibility ([b828e9a](https://github.com/visulima/visulima/commit/b828e9aeaebfc798eecddccd90e6ec7560c6d36a))

### Miscellaneous Chores

* moved all packages into groups ([0615e9d](https://github.com/visulima/visulima/commit/0615e9d14a8a886e11da529ce150cf31ca973c10))
* update @anolilab/semantic-release-pnpm and @anolilab/semantic-release-preset to versions 3.2.2 and 12.1.2 across multiple package.json files for improved compatibility ([3921626](https://github.com/visulima/visulima/commit/3921626141fe5da398749bf0ba675f1596f18afb))
* update dependencies across multiple packages to improve compatibility and performance, including upgrading `@anolilab/semantic-release-pnpm` and `@anolilab/semantic-release-preset` to versions 3.2.0 and 12.1.0 respectively, and updating `react`, `react-dom`, and `next` versions to 19.2.1 and 16.0.7 in various package.json files ([aee8fcd](https://github.com/visulima/visulima/commit/aee8fcd796ae9b8d055903260e7150996ea9f53d))
* update implicit dependencies in project.json for storage package ([2473f8a](https://github.com/visulima/visulima/commit/2473f8a2297df40425ba4eb4d9eb14d40db0b6ac))


### Dependencies

* **@visulima/fs:** upgraded to 5.0.0-alpha.1

## @visulima/storage 1.0.0-alpha.1 (2025-12-02)

### Features

* new storage and storage-client package ([#574](https://github.com/visulima/visulima/issues/574)) ([33db3c1](https://github.com/visulima/visulima/commit/33db3c1ebb5718f4e2c1228b5a53d3b901bb1383))
* update disposable email domains package and enhance synchronization ([dd81823](https://github.com/visulima/visulima/commit/dd818230a2435568317fdb02728a96ec580962a3))

### Miscellaneous Chores

* added missing name ([c20fd28](https://github.com/visulima/visulima/commit/c20fd28c99a6c3886adc88745f29700603818468))
* update @visulima/packem version to 2.0.0-alpha.40 across multiple packages ([e5be373](https://github.com/visulima/visulima/commit/e5be373fef8f8dda20c1dee7a1ac30d9b7a7712e))
* update package dependencies and versions across multiple packages ([9a9ac80](https://github.com/visulima/visulima/commit/9a9ac8046f7138cf37bec9e2041bc2125e97f212))
