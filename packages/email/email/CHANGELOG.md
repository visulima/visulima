## @visulima/email [1.0.0-alpha.43](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.42...@visulima/email@1.0.0-alpha.43) (2026-06-23)

## @visulima/email [1.0.0-alpha.42](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.41...@visulima/email@1.0.0-alpha.42) (2026-06-23)

## @visulima/email [1.0.0-alpha.41](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.40...@visulima/email@1.0.0-alpha.41) (2026-06-20)

## @visulima/email [1.0.0-alpha.40](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.39...@visulima/email@1.0.0-alpha.40) (2026-06-20)

### Features

* **email:** add sparkpost, netcore and outlook365 providers ([b8efc45](https://github.com/visulima/visulima/commit/b8efc45e273dffa246a4badc1711f01682ea7af5))

### Tests

* **email:** fix ical file-url path assertion on windows ([3673d90](https://github.com/visulima/visulima/commit/3673d901f522430bea634f6c93bd286577fa144f))

## @visulima/email [1.0.0-alpha.39](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.38...@visulima/email@1.0.0-alpha.39) (2026-06-19)

## @visulima/email [1.0.0-alpha.38](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.37...@visulima/email@1.0.0-alpha.38) (2026-06-19)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.34

## @visulima/email [1.0.0-alpha.37](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.36...@visulima/email@1.0.0-alpha.37) (2026-06-19)

## @visulima/email [1.0.0-alpha.36](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.35...@visulima/email@1.0.0-alpha.36) (2026-06-13)

### Bug Fixes

* **email:** harden header sanitization, DSN fallback header, batch counts ([5629850](https://github.com/visulima/visulima/commit/5629850e2fe23710bc11d71820c867e5952c9a1d))
* **email:** stop bcc disclosure and fix mime header/dsn handling ([70f0c70](https://github.com/visulima/visulima/commit/70f0c70fe441be5ba9cf15b3e94acbe7cc7af3c2))
* **email:** unwrap juice ESM default export and align fs error expectation ([0bc2705](https://github.com/visulima/visulima/commit/0bc2705af39a0da641eb50a4e85eff0f954f267e))

### Performance Improvements

* **email:** lazy-load ical-generator on build ([b6b4466](https://github.com/visulima/visulima/commit/b6b4466d87ddaaed19e5726bef4583bf433403d0))

### Miscellaneous Chores

* **email:** clear baseline eslint violations ([1906b0b](https://github.com/visulima/visulima/commit/1906b0bed81cba8d979aa55b5e5d8518263b7b7b))

### Tests

* **email:** deepen middleware/queue/events tests ([be80a72](https://github.com/visulima/visulima/commit/be80a725e20661b24650f13b6b524891811b8af8))
* **email:** restore precise toHaveBeenCalledWith assertions ([524d4bd](https://github.com/visulima/visulima/commit/524d4bd545c7440e1d26fbb201706a1a0bdc8023))

### Build System

* **deps:** update email dependencies ([5ce1f27](https://github.com/visulima/visulima/commit/5ce1f27ebecb9f7459db7503e4a8128b1ff8ac01))
* regenerate bundled-license manifests and types ordering ([af26588](https://github.com/visulima/visulima/commit/af26588d75aaa937fd4862800560bd4070a4878c))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.17
* **@visulima/error:** upgraded to 6.0.0-alpha.33
* **@visulima/fs:** upgraded to 5.0.0-alpha.32
* **@visulima/path:** upgraded to 3.0.0-alpha.13

## @visulima/email [1.0.0-alpha.35](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.34...@visulima/email@1.0.0-alpha.35) (2026-06-04)

### Features

* **email:** inbound, webhooks, deliverability, middleware, queue, events, testing + ARC/i18n/batch ([#671](https://github.com/visulima/visulima/issues/671)) ([2ca23f2](https://github.com/visulima/visulima/commit/2ca23f27ecc5064d693c16bd3f44ccaeaf050888))

### Bug Fixes

* **email:** 5 bug fixes ([4e87c42](https://github.com/visulima/visulima/commit/4e87c429a56d68d7a0a09325484ed299ffe6493c))
* **lint:** clear pre-existing eslint rot across packages ([#674](https://github.com/visulima/visulima/issues/674)) ([5354253](https://github.com/visulima/visulima/commit/5354253b163bd50bcefaf8a3fddf831bdb5df32b))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.16
* **@visulima/error:** upgraded to 6.0.0-alpha.32
* **@visulima/fs:** upgraded to 5.0.0-alpha.30
* **@visulima/path:** upgraded to 3.0.0-alpha.12

## @visulima/email [1.0.0-alpha.34](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.33...@visulima/email@1.0.0-alpha.34) (2026-06-02)

### Features

* **email:** add fail-fast capability guard ([#657](https://github.com/visulima/visulima/issues/657)) ([81f24ab](https://github.com/visulima/visulima/commit/81f24abcde5cb8b6bbbd989a5ad397eefb3292ab))

### Bug Fixes

* **tests:** revert unsafe vitest autofixes from the lint sweep ([378f27c](https://github.com/visulima/visulima/commit/378f27caa370f1d3188aef2ed36d46839abc88c4))

### Miscellaneous Chores

* apply eslint + prettier autofixes across packages ([c1bb784](https://github.com/visulima/visulima/commit/c1bb7848a0d93d0dfe2960c77e3cda22239c79a0))

### Tests

* **email:** cover address normalization branches ([128f9d4](https://github.com/visulima/visulima/commit/128f9d485b0007636cf369f0c9a435c50d445794))
* **email:** cover ahasend request, attachment and availability branches ([747ba3c](https://github.com/visulima/visulima/commit/747ba3cef6b84cd79d82b8441cb250032e9247eb))
* **email:** cover ahasend send and messageId branches ([b9c5085](https://github.com/visulima/visulima/commit/b9c5085546f2abad3515d9d899a7f40f2b12cb58))
* **email:** cover angle-bracket first-bracket fallback ([3f6f8b9](https://github.com/visulima/visulima/commit/3f6f8b9c6d44d370140d59146d8446be3a5b035a))
* **email:** cover attach/embed empty basename fallback ([b5be774](https://github.com/visulima/visulima/commit/b5be7745cfeed21ec92911f1673c712744f2f311))
* **email:** cover attachment content-type fallbacks ([94bf172](https://github.com/visulima/visulima/commit/94bf172278f65af5c3e4260ae2aeaf7ed35ca67a))
* **email:** cover attachment default content type ([ac83c50](https://github.com/visulima/visulima/commit/ac83c501a40a874e721d9a58e5e5b0fd6125795e))
* **email:** cover aws-ses branch paths ([c299c28](https://github.com/visulima/visulima/commit/c299c2873fcc309ce2c6695fb148dfab36bf795d))
* **email:** cover aws-ses initialize, isAvailable, request errors and SES params ([b0c90c7](https://github.com/visulima/visulima/commit/b0c90c7245d3a68d891e1673e7acf8d6a9f129d7))
* **email:** cover azure availability non-error branch ([1fea2cb](https://github.com/visulima/visulima/commit/1fea2cb1bd6908ef87b2de109b7e7159015f30ad))
* **email:** cover azure connection-string auth and send/getEmail branches ([462d4f9](https://github.com/visulima/visulima/commit/462d4f95bb8d59fd459b1cd812640028abf60237))
* **email:** cover azure getEmail auth, isAvailable status codes and send failure ([d03fe62](https://github.com/visulima/visulima/commit/d03fe62ceffce0598af844453e40daa64817bb0a))
* **email:** cover brevo getEmail, replyTo array branches, batch and attachments ([e967213](https://github.com/visulima/visulima/commit/e967213b93e24075d62bd6e12e43015fed045dda))
* **email:** cover brevo send and getEmail branches ([78389b9](https://github.com/visulima/visulima/commit/78389b90d0bf19e89e6e58ecdb07887a1e8618c4))
* **email:** cover build-mime-message attachment headers and encodings ([1095d47](https://github.com/visulima/visulima/commit/1095d471f8ed38755b3a847f3b39fdb3e7621722))
* **email:** cover dkim empty-body canonicalization ([b5a7f4c](https://github.com/visulima/visulima/commit/b5a7f4c24ca211d0ae76d8df9a9f667e890cfcc0))
* **email:** cover dkim-signer canonicalization branches ([d6c0bec](https://github.com/visulima/visulima/commit/d6c0bece326173678650f5a4f30078e35e17cffb))
* **email:** cover failover init failures and fallbacks ([2cbead7](https://github.com/visulima/visulima/commit/2cbead75a564c25d3f921e80f49b099595927628))
* **email:** cover failover unnamed-provider init failure ([38e0060](https://github.com/visulima/visulima/commit/38e0060f3cdfc963b6a85d725b7519b0fa188fb6))
* **email:** cover handlebars register error rethrow ([b740f8f](https://github.com/visulima/visulima/commit/b740f8f2ed121a953cb5e02f81eebef4f172b598))
* **email:** cover http initialize, availability, and cc/bcc branches ([b2f6509](https://github.com/visulima/visulima/commit/b2f6509c67fd3ba5e4b4e20be8c48965fa0e1928))
* **email:** cover http send, init, and message-id branches ([62719bd](https://github.com/visulima/visulima/commit/62719bd9e9e9dece8de1e26b44854c73923b4cf8))
* **email:** cover in-memory cache delete, clear and eviction ([e4b0333](https://github.com/visulima/visulima/commit/e4b03330889d2f5e822fa61b201411991c19d498))
* **email:** cover infobip request, attachment and availability branches ([2dac360](https://github.com/visulima/visulima/commit/2dac3608200f75f7f795accadf226f242937831b))
* **email:** cover infobip send and getEmail branches ([4d8719d](https://github.com/visulima/visulima/commit/4d8719db845882f0c52d580b47f040e5533fbae8))
* **email:** cover Mail logger, sendMany, and global-config merge paths ([bd5c50b](https://github.com/visulima/visulima/commit/bd5c50be8b6aa110086f0c9975440decf1189ab6))
* **email:** cover mail message replyTo setter ([afe8dae](https://github.com/visulima/visulima/commit/afe8daed7363d7fdd7354b8e3190602fdc635347))
* **email:** cover mail send and batch branch paths ([b45b1b0](https://github.com/visulima/visulima/commit/b45b1b0e0066a276bee5a6bfddde13a63f7f415b))
* **email:** cover mail-message auto-text generation ([2c44d7f](https://github.com/visulima/visulima/commit/2c44d7fa6636ca4c88e38504aa988855f6387436))
* **email:** cover mail-message logger branches ([23b4496](https://github.com/visulima/visulima/commit/23b44963ed8edf4e794544bdcde94f2d3798994a))
* **email:** cover mailersend request, attachment and availability branches ([999e22c](https://github.com/visulima/visulima/commit/999e22c94828e382f962d3bb695f2a63bc3e985b))
* **email:** cover mailersend send and getEmail branches ([e20e805](https://github.com/visulima/visulima/commit/e20e8055fc8058a471fd45fb1526a6e35504865e))
* **email:** cover mailgun getEmail events, tracking flags, form encoding and attachments ([cf63a01](https://github.com/visulima/visulima/commit/cf63a013cdcfc546fb731ad7c9b381b637490bd5))
* **email:** cover mailgun send and getEmail branches ([3f63011](https://github.com/visulima/visulima/commit/3f63011a43752e8ba4f19e11857843b1f4830557))
* **email:** cover mailjet getEmail, send failure, campaign fields and attachments ([2f4147f](https://github.com/visulima/visulima/commit/2f4147ff105386ac13700154a2fb5e081fa6d70b))
* **email:** cover mailjet send and getEmail branches ([d692d34](https://github.com/visulima/visulima/commit/d692d346dc179f9778857d502824b3f68cd0f769))
* **email:** cover mailomat and mailpace getEmail and edge paths ([519d057](https://github.com/visulima/visulima/commit/519d057b19f23f2157c379595fa041fb17fff189))
* **email:** cover mailomat getEmail and branch paths ([8b52328](https://github.com/visulima/visulima/commit/8b52328146ccb0f6f2a10ce4652679e13debdb1a))
* **email:** cover mailomat send/getEmail branch paths ([df5b5a4](https://github.com/visulima/visulima/commit/df5b5a446c8f373d09f5cab3d98280b35d495657))
* **email:** cover mailpace availability and send branches ([b89b4ad](https://github.com/visulima/visulima/commit/b89b4ad51cde34d58656944a171434d6b2d361d7))
* **email:** cover mailpace logger branch ([8e4fe77](https://github.com/visulima/visulima/commit/8e4fe779599f5ad43a63c24f7e7e9fa4d5b631ce))
* **email:** cover mailtrap request, attachment and availability branches ([ee23353](https://github.com/visulima/visulima/commit/ee2335365cf6aac08578e7010b20752768bc3c8d))
* **email:** cover mailtrap send and getEmail branches ([be3e1a3](https://github.com/visulima/visulima/commit/be3e1a3b85fc49c7f9848d3d5f12b1aa2df18ab8))
* **email:** cover make-request non-error rejection ([9626626](https://github.com/visulima/visulima/commit/9626626f57afca5b8dcbb1653d9796575a17d666))
* **email:** cover make-request timeout cleanup, json fallback and body coercion ([3d76d4e](https://github.com/visulima/visulima/commit/3d76d4ee92da4159ea9a5c6d247ee22f680ed3a4))
* **email:** cover mandrill request, analytics and availability branches ([1233ff3](https://github.com/visulima/visulima/commit/1233ff327f34246ea2363a0b914e88d7c8471d78))
* **email:** cover mandrill send and template branches ([297754f](https://github.com/visulima/visulima/commit/297754f8aa984269da98a082e8252b4cca9f1fc2))
* **email:** cover mock init, recipient, and response branches ([5b301f5](https://github.com/visulima/visulima/commit/5b301f5d8de4bc0778379d9b2da8024913f2bcc2))
* **email:** cover mock provider send/retrieve catch paths ([bb47683](https://github.com/visulima/visulima/commit/bb47683295e249f37cea1ea6bfb6bdda9f29a8d5))
* **email:** cover mx lookup non-error rejection ([e52a2b6](https://github.com/visulima/visulima/commit/e52a2b663fe795a1c6f8727dc6ea655425c140b0))
* **email:** cover nodemailer branch paths and fix lint ([6b5b72b](https://github.com/visulima/visulima/commit/6b5b72b0d8404a25d386d9d6cd0b79199550a1ed))
* **email:** cover opentelemetry branches and fix lint ([6ac926b](https://github.com/visulima/visulima/commit/6ac926b484a229a66ac38c98dbe8e0c47e431ee8))
* **email:** cover parse-address domain-literal and quoted-local edge cases ([fa909c7](https://github.com/visulima/visulima/commit/fa909c735d849997f99254f5dcfd0a3bf62b4804))
* **email:** cover parse-address quote after at-sign ([49143f6](https://github.com/visulima/visulima/commit/49143f65e65b317d1da6e42cab7d2c03f1e63fca))
* **email:** cover payload builder recipient/template branches ([e629d81](https://github.com/visulima/visulima/commit/e629d814c02576c4b24035235b4fdadf4021a61e))
* **email:** cover plunk getEmail throw and attachment branches ([c24c2bf](https://github.com/visulima/visulima/commit/c24c2bf0e14247a8bd8538b679ba0f869276107a))
* **email:** cover plunk send/getEmail branch paths ([96c2097](https://github.com/visulima/visulima/commit/96c2097ae3cb3bec00a57a04d768c83cd816c1db))
* **email:** cover postal request, attachment and availability branches ([8617ce2](https://github.com/visulima/visulima/commit/8617ce2e43a5244a94434a0995367f5bbb4669b3))
* **email:** cover postal send and getEmail branches ([9e78f76](https://github.com/visulima/visulima/commit/9e78f769faf6dcb38311995d1f26dee11f2727c8))
* **email:** cover postmark getEmail, template alias, metadata and attachments ([58236b4](https://github.com/visulima/visulima/commit/58236b47e751a893cca3762e11600fd29fecf4a8))
* **email:** cover postmark send and template branches ([5c298da](https://github.com/visulima/visulima/commit/5c298da4a20d1125d82cb36cb3c324948ab7c228))
* **email:** cover provider address formatters ([dd4da80](https://github.com/visulima/visulima/commit/dd4da80afd21074fb145b65d75ad44da5bfaac2f))
* **email:** cover reply-to validation and mx cache-on-error ([16cc9c2](https://github.com/visulima/visulima/commit/16cc9c2f96368d364271a11a72ec679af5d3df0a))
* **email:** cover resend getEmail, isAvailable, and full send payload ([e0c4981](https://github.com/visulima/visulima/commit/e0c4981ece5a148c941b3239d53e87dd1b38cb48))
* **email:** cover resend send, getEmail, availability branches ([bfca30d](https://github.com/visulima/visulima/commit/bfca30d7387d9c351f4b201f21e287fc8a7b2eb6))
* **email:** cover roundrobin init, wait and failover branches ([8b42738](https://github.com/visulima/visulima/commit/8b427389ff13d9b5cf7d79e318522d54be103ac7))
* **email:** cover roundrobin name fallbacks and retry paths ([57d56c8](https://github.com/visulima/visulima/commit/57d56c8f8fca3ec17088b09000deac6d0c0707c2))
* **email:** cover scaleway branch and init failure paths ([5ca4c8f](https://github.com/visulima/visulima/commit/5ca4c8fa479b94d675bc5b6982d6dbe8564a4f0c))
* **email:** cover scaleway getEmail failure and attachment branches ([1fdbb2f](https://github.com/visulima/visulima/commit/1fdbb2f9404e988129ef485c3ec86a10f870b431))
* **email:** cover sendgrid getEmail, settings, send failure and attachments ([db99fc8](https://github.com/visulima/visulima/commit/db99fc82e925c5c1187c00185d11872ffc5b5247))
* **email:** cover sendgrid send and availability branches ([5bca44a](https://github.com/visulima/visulima/commit/5bca44a7fdde5cca30d4079b6ab222271eefb8ad))
* **email:** cover smime aes128/aes192 algorithm aliases ([715482a](https://github.com/visulima/visulima/commit/715482aeabd6b90949e4a0f70cc9c6b11f0e9170))
* **email:** cover smime build-message and algorithm paths ([49319c1](https://github.com/visulima/visulima/commit/49319c1c540dc5dd2a1b568791e40e246358c91b))
* **email:** cover smime empty-body and empty recipient ([bc8ab8c](https://github.com/visulima/visulima/commit/bc8ab8cae1f15c466dfb08eef07312081e358484))
* **email:** cover smtp 551/553 recipient rejections ([7c4630c](https://github.com/visulima/visulima/commit/7c4630c87496d62c371443412ecb22aabab44be7))
* **email:** cover smtp branch paths ([d0c135e](https://github.com/visulima/visulima/commit/d0c135eaf7739d1f3025060eaf0bf953c7d41d13))
* **email:** cover smtp provider via mock-socket harness ([08d98f9](https://github.com/visulima/visulima/commit/08d98f95bb677df4212928a9019cfd7cdf9de898))
* **email:** cover smtp verify cache write error ([eceaf97](https://github.com/visulima/visulima/commit/eceaf9785081ec4418db0e279009a0c2238a87e8))
* **email:** cover sweego branch and init failure paths ([99abf7a](https://github.com/visulima/visulima/commit/99abf7a3cd42fba2f4808539f4177368f7186de8))
* **email:** cover sweego getEmail throw and attachment branches ([139d0ca](https://github.com/visulima/visulima/commit/139d0ca18be97d91a92dbbf9dd6da81693375e0c))
* **email:** cover to-base64 buffer-less fallback and is-port-available ([c8c7454](https://github.com/visulima/visulima/commit/c8c7454bf0bcf9d734384bac21f24739eeb8de84))
* **email:** cover validate-email hyphen domain rejection paths ([125eab0](https://github.com/visulima/visulima/commit/125eab0d9a543196496aea6de7d8adf3b3441aae))
* **email:** cover verify-email mx and smtp branches ([70905d1](https://github.com/visulima/visulima/commit/70905d1430e00efea031116ac675ef30919cee51))
* **email:** cover verify-smtp socket state machine and caching ([2b84cc1](https://github.com/visulima/visulima/commit/2b84cc1e36c01ef067ec571acdcfe614d9b2d1dc))
* **email:** cover vue-email default data branch ([c51b812](https://github.com/visulima/visulima/commit/c51b812079f98eca77615c0c08fd206dfb67ad39))
* **email:** cover zeptomail send error detail and exception branches ([ea74549](https://github.com/visulima/visulima/commit/ea745494f693360cc48d12bfb2bd8af66be0395e))
* **email:** cover zeptomail send error/header/attachment branches ([5b78e15](https://github.com/visulima/visulima/commit/5b78e15a97a8f0070fe172e5dc92b0a3926bb01b))
* **email:** fix lint in smtp harness test ([87811af](https://github.com/visulima/visulima/commit/87811af4dc6dea41a5a6ea2f96e3af19b168a0b3))
* improve coverage across packages ([91bd6d3](https://github.com/visulima/visulima/commit/91bd6d3b61736e3c8bd1fc59b0b5955f76a5d323))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.31
* **@visulima/fs:** upgraded to 5.0.0-alpha.29

## @visulima/email [1.0.0-alpha.33](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.32...@visulima/email@1.0.0-alpha.33) (2026-05-27)

### Bug Fixes

* **storage-client:** percent-encode user fields in defaultFingerprint ([7c78a0f](https://github.com/visulima/visulima/commit/7c78a0f9512e2a673b941d80839e9f1e86b7b5d0))

### Documentation

* prettier-format agent instructions ([71b6414](https://github.com/visulima/visulima/commit/71b6414528780ac82c4e0bb25b5f4f11faba5549))

### Miscellaneous Chores

* sorted package.json ([b47c545](https://github.com/visulima/visulima/commit/b47c545591600fdab17d5cd3a3fbc68b61e199da))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.15
* **@visulima/error:** upgraded to 6.0.0-alpha.30
* **@visulima/fs:** upgraded to 5.0.0-alpha.28
* **@visulima/path:** upgraded to 3.0.0-alpha.11

## @visulima/email [1.0.0-alpha.32](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.31...@visulima/email@1.0.0-alpha.32) (2026-05-26)

### Miscellaneous Chores

* **ci-stability:** green CI across vis, native, lint, tests, attw ([#651](https://github.com/visulima/visulima/issues/651)) ([d4eb684](https://github.com/visulima/visulima/commit/d4eb684b5f75c818c9251048c605a0ed54a268e3))
* **repo:** sort package.json keys across all packages ([e1fd9ab](https://github.com/visulima/visulima/commit/e1fd9ab467ef96a98c777da1572ff6a50fcf7e71))

### Tests

* **repo:** add dist runtime + types integration tests ([32ee300](https://github.com/visulima/visulima/commit/32ee300b7184117a0ddf9f9d390f75f8932d5ed9))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.28
* **@visulima/fs:** upgraded to 5.0.0-alpha.26

## @visulima/email [1.0.0-alpha.31](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.30...@visulima/email@1.0.0-alpha.31) (2026-05-20)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.27
* **@visulima/fs:** upgraded to 5.0.0-alpha.25

## @visulima/email [1.0.0-alpha.30](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.29...@visulima/email@1.0.0-alpha.30) (2026-05-19)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.26
* **@visulima/fs:** upgraded to 5.0.0-alpha.24

## @visulima/email [1.0.0-alpha.29](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.28...@visulima/email@1.0.0-alpha.29) (2026-05-16)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.25
* **@visulima/fs:** upgraded to 5.0.0-alpha.23

## @visulima/email [1.0.0-alpha.28](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.27...@visulima/email@1.0.0-alpha.28) (2026-05-14)

### Miscellaneous Chores

* **email:** apply prettier and eslint formatting sweep ([6950709](https://github.com/visulima/visulima/commit/69507091f75a9c4783f4ce04927c4152d7a00cd7))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.14
* **@visulima/error:** upgraded to 6.0.0-alpha.24
* **@visulima/fs:** upgraded to 5.0.0-alpha.22

## @visulima/email [1.0.0-alpha.27](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.26...@visulima/email@1.0.0-alpha.27) (2026-05-11)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.23
* **@visulima/fs:** upgraded to 5.0.0-alpha.21

## @visulima/email [1.0.0-alpha.26](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.25...@visulima/email@1.0.0-alpha.26) (2026-05-11)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.22
* **@visulima/fs:** upgraded to 5.0.0-alpha.20

## @visulima/email [1.0.0-alpha.25](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.24...@visulima/email@1.0.0-alpha.25) (2026-05-10)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.21
* **@visulima/fs:** upgraded to 5.0.0-alpha.19

## @visulima/email [1.0.0-alpha.24](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.23...@visulima/email@1.0.0-alpha.24) (2026-05-10)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.20
* **@visulima/fs:** upgraded to 5.0.0-alpha.18

## @visulima/email [1.0.0-alpha.23](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.22...@visulima/email@1.0.0-alpha.23) (2026-05-07)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.19
* **@visulima/fs:** upgraded to 5.0.0-alpha.17

## @visulima/email [1.0.0-alpha.22](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.21...@visulima/email@1.0.0-alpha.22) (2026-05-07)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.18
* **@visulima/fs:** upgraded to 5.0.0-alpha.16

## @visulima/email [1.0.0-alpha.21](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.20...@visulima/email@1.0.0-alpha.21) (2026-05-06)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.17
* **@visulima/fs:** upgraded to 5.0.0-alpha.15

## @visulima/email [1.0.0-alpha.20](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.19...@visulima/email@1.0.0-alpha.20) (2026-05-06)

### Miscellaneous Chores

* **email:** apply prettier and eslint quote-style auto-fix ([ba38e00](https://github.com/visulima/visulima/commit/ba38e009085d304e7810ee9dd63bc1fd22b53ae8))
* **email:** housekeeping cleanup ([fac388e](https://github.com/visulima/visulima/commit/fac388edbb3073d912b65c6ad1716dc57257dccf))


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.16
* **@visulima/fs:** upgraded to 5.0.0-alpha.14

## @visulima/email [1.0.0-alpha.19](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.18...@visulima/email@1.0.0-alpha.19) (2026-05-04)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.15
* **@visulima/fs:** upgraded to 5.0.0-alpha.13

## @visulima/email [1.0.0-alpha.18](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.17...@visulima/email@1.0.0-alpha.18) (2026-04-30)


### Dependencies

* **@visulima/error:** upgraded to 6.0.0-alpha.14

## @visulima/email [1.0.0-alpha.17](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.16...@visulima/email@1.0.0-alpha.17) (2026-04-28)

### Miscellaneous Chores

* **email:** upgrade packem to 2.0.0-alpha.76 ([d2840bc](https://github.com/visulima/visulima/commit/d2840bcc61a1be0a9176645c40875e7e0381a0c3))
* re-sort workspace package.json files via vis sort-package-json ([f625696](https://github.com/visulima/visulima/commit/f625696cfac974325774b3243e1a83c3d23acbd7))

## @visulima/email [1.0.0-alpha.16](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.15...@visulima/email@1.0.0-alpha.16) (2026-04-22)

## @visulima/email [1.0.0-alpha.15](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.14...@visulima/email@1.0.0-alpha.15) (2026-04-22)

## @visulima/email [1.0.0-alpha.14](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.13...@visulima/email@1.0.0-alpha.14) (2026-04-22)

### Bug Fixes

* **email:** resolve eslint and formatting issues ([50c6fb1](https://github.com/visulima/visulima/commit/50c6fb14a6f72e40d168fcb57908fa9489417e9a))
* **email:** resolve eslint and formatting issues ([ad82020](https://github.com/visulima/visulima/commit/ad82020ded7fffdbba89b6befd2522a908cffe81))
* **email:** resolve eslint issues and format code ([8fd689c](https://github.com/visulima/visulima/commit/8fd689c12e9c21f7222597bbf99a6fe431b5f0d4))
* Remove JSR configuration generation script and generated jsr.json files ([#616](https://github.com/visulima/visulima/issues/616)) ([533744b](https://github.com/visulima/visulima/commit/533744b103b74896941db5b727173e617a27a63b))

### Miscellaneous Chores

* bump engines.node to ^22.14.0 || >=24.10.0 ([c3d0931](https://github.com/visulima/visulima/commit/c3d0931d1504e4f21ebf50ea680cfa7ce4ba15ce))
* **email:** apply formatter and lint fixes across providers ([addf346](https://github.com/visulima/visulima/commit/addf346653b0400de7a944b1d5573efc9654fe30))
* **email:** apply pending changes ([002c978](https://github.com/visulima/visulima/commit/002c9781033e9b2eae08257867b136dccdd11160))
* **email:** enforce curly braces and apply lint fixes ([2d82544](https://github.com/visulima/visulima/commit/2d82544bd769eef2935565a4df2c0c98b2cb8262))
* fixed jsr.json ([5d85e51](https://github.com/visulima/visulima/commit/5d85e5179de38e284ec433b14d77c71a1619c8d6))

### Code Refactoring

* replace inline import() types with top-level imports ([4569a4c](https://github.com/visulima/visulima/commit/4569a4ca04723da069f985855dcfab292f7347e1))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.13

## @visulima/email [1.0.0-alpha.13](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.12...@visulima/email@1.0.0-alpha.13) (2026-04-08)

### Bug Fixes

* **email:** properly fix eslint errors in code ([ec1645b](https://github.com/visulima/visulima/commit/ec1645b3a4c7e471e7af74bac203ce34b950cdd3))
* **email:** remove remaining eslint suppressions with proper code fixes ([02367a9](https://github.com/visulima/visulima/commit/02367a9212ba72d90274b6e408e98a09ddb03b39))
* **email:** resolve eslint errors ([d35b6fe](https://github.com/visulima/visulima/commit/d35b6fe1e6ee4c19456b8428639529c75c0a97d3))

### Miscellaneous Chores

* **email:** add tsconfig.eslint.json for type-aware linting ([65a33f4](https://github.com/visulima/visulima/commit/65a33f4fa4b4771055a0267c679c62658813f746))
* **email:** apply prettier formatting ([362576d](https://github.com/visulima/visulima/commit/362576dd10e86707b0da2be7a27c7f6cb287e340))
* **email:** expand inline if-return to block syntax ([5e39aa0](https://github.com/visulima/visulima/commit/5e39aa0c563c1dd401337e485728635431f1da13))
* **email:** migrate .prettierrc.cjs to prettier.config.js ([f0caf3c](https://github.com/visulima/visulima/commit/f0caf3c1e2e5cc13a9a8bd5a14acc4f24e3f3a00))
* **email:** remove empty dependency objects from package.json ([0737b35](https://github.com/visulima/visulima/commit/0737b353aabceefe962dab9971ee0c09e9f055fe))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.12
* **@visulima/error:** upgraded to 6.0.0-alpha.8
* **@visulima/fs:** upgraded to 5.0.0-alpha.7
* **@visulima/path:** upgraded to 3.0.0-alpha.8

## @visulima/email [1.0.0-alpha.12](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.11...@visulima/email@1.0.0-alpha.12) (2026-03-26)

### Features

* **web:** auto-generate packages page from workspace metadata ([623e520](https://github.com/visulima/visulima/commit/623e5207693a7fe720f5f2f179593a3654c880e3))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.11
* **@visulima/error:** upgraded to 6.0.0-alpha.7
* **@visulima/fs:** upgraded to 5.0.0-alpha.6
* **@visulima/path:** upgraded to 3.0.0-alpha.7

## @visulima/email [1.0.0-alpha.11](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.10...@visulima/email@1.0.0-alpha.11) (2026-03-26)

### Bug Fixes

* **docs:** correct code examples found during verification ([8e4f8c4](https://github.com/visulima/visulima/commit/8e4f8c4b0b1664c232fe5ae721b771c72d29a152))
* **email:** use workspace:* for internal [@visulima](https://github.com/visulima) deps ([4c5c008](https://github.com/visulima/visulima/commit/4c5c008d5c65b3ee26225448eb0a7d6a90a47f5e))
* **web:** improve build setup with incremental stats caching and prod install ([fe33e75](https://github.com/visulima/visulima/commit/fe33e75827586779b4b3a0c6d57b39f889ee6207))

### Documentation

* add missing documentation pages for email, string, and storage-client ([623f8af](https://github.com/visulima/visulima/commit/623f8afd2ea03dd2805fb2d7a9d10083571224bb))

### Miscellaneous Chores

* **email:** migrate deps to pnpm catalogs ([487ca7a](https://github.com/visulima/visulima/commit/487ca7abb6db86498e4993afb0cd0113d005af23))
* **email:** update dependencies ([f7fb112](https://github.com/visulima/visulima/commit/f7fb1124a030474af12592992bbd95db29db53c1))
* visulima website ([#591](https://github.com/visulima/visulima/issues/591)) ([59ab2e2](https://github.com/visulima/visulima/commit/59ab2e2befb03e51cd2088956f83d9b87de6d033))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.10
* **@visulima/error:** upgraded to 6.0.0-alpha.6
* **@visulima/fs:** upgraded to 5.0.0-alpha.5
* **@visulima/path:** upgraded to 3.0.0-alpha.6

## @visulima/email [1.0.0-alpha.10](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.9...@visulima/email@1.0.0-alpha.10) (2026-03-06)

### Bug Fixes

* **email:** update packem to 2.0.0-alpha.54 ([857a650](https://github.com/visulima/visulima/commit/857a650aea408e49c11f36ebe6e3a7f2e3560c82))

### Miscellaneous Chores

* **email:** update dependencies ([07a300d](https://github.com/visulima/visulima/commit/07a300dcb01259457a41ef3aaf8dd8038d7074ff))
* **email:** update dependencies ([0250461](https://github.com/visulima/visulima/commit/02504619e8e7ec6ef8e05f323674705656cde7de))
* update lock file maintenance ([d83e716](https://github.com/visulima/visulima/commit/d83e71697b75d24704185b66bb521a934d2db02d))
* year update ([47f4105](https://github.com/visulima/visulima/commit/47f410596ce7190cfea36a073db32e0cec50bbcd))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.9
* **@visulima/error:** upgraded to 6.0.0-alpha.5
* **@visulima/fs:** upgraded to 5.0.0-alpha.4
* **@visulima/path:** upgraded to 3.0.0-alpha.5

## @visulima/email [1.0.0-alpha.9](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.8...@visulima/email@1.0.0-alpha.9) (2026-01-17)

### Bug Fixes

* **jsdoc-open-api:** combine name and description for path-based YAML parsing ([68e7d23](https://github.com/visulima/visulima/commit/68e7d2395ab97de3221892afe03da27688df7569))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.8

## @visulima/email [1.0.0-alpha.8](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.7...@visulima/email@1.0.0-alpha.8) (2025-12-27)

### Bug Fixes

* **email:** update package files ([3e215cf](https://github.com/visulima/visulima/commit/3e215cf0ae366591dd1747a96a7275524e3f5501))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.7
* **@visulima/error:** upgraded to 6.0.0-alpha.3
* **@visulima/fs:** upgraded to 5.0.0-alpha.3
* **@visulima/path:** upgraded to 3.0.0-alpha.4

## @visulima/email [1.0.0-alpha.7](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.6...@visulima/email@1.0.0-alpha.7) (2025-12-13)

### Miscellaneous Chores

* fixed project.json names and schema path ([964722f](https://github.com/visulima/visulima/commit/964722f691db205c7edb9aa6db29e849a647500b))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.6

## @visulima/email [1.0.0-alpha.6](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.5...@visulima/email@1.0.0-alpha.6) (2025-12-11)

### Bug Fixes

* update package OG images across multiple packages ([f08e4dd](https://github.com/visulima/visulima/commit/f08e4dd2b105ccb29c8412020a9c2be36d6c1e9e))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.5
* **@visulima/error:** upgraded to 6.0.0-alpha.2
* **@visulima/fs:** upgraded to 5.0.0-alpha.2
* **@visulima/path:** upgraded to 3.0.0-alpha.3

## @visulima/email [1.0.0-alpha.5](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.4...@visulima/email@1.0.0-alpha.5) (2025-12-10)


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.4

## @visulima/email [1.0.0-alpha.4](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.3...@visulima/email@1.0.0-alpha.4) (2025-12-08)


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.3

## @visulima/email [1.0.0-alpha.3](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.2...@visulima/email@1.0.0-alpha.3) (2025-12-07)

### ⚠ BREAKING CHANGES

* change min node version to 22.13

### Bug Fixes

* add new package image, fixed readme rendering on npm, fixed building of packages ([b790ba2](https://github.com/visulima/visulima/commit/b790ba253ea07fef83528fd822a678facf021b5f))
* update Node.js engine version requirement to >=22.13 in multiple package.json files for improved compatibility ([b828e9a](https://github.com/visulima/visulima/commit/b828e9aeaebfc798eecddccd90e6ec7560c6d36a))

### Miscellaneous Chores

* moved all packages into groups ([0615e9d](https://github.com/visulima/visulima/commit/0615e9d14a8a886e11da529ce150cf31ca973c10))
* update @anolilab/semantic-release-pnpm and @anolilab/semantic-release-preset to versions 3.2.2 and 12.1.2 across multiple package.json files for improved compatibility ([3921626](https://github.com/visulima/visulima/commit/3921626141fe5da398749bf0ba675f1596f18afb))
* update dependencies across multiple packages to improve compatibility and performance, including upgrading `@anolilab/semantic-release-pnpm` and `@anolilab/semantic-release-preset` to versions 3.2.0 and 12.1.0 respectively, and updating `react`, `react-dom`, and `next` versions to 19.2.1 and 16.0.7 in various package.json files ([aee8fcd](https://github.com/visulima/visulima/commit/aee8fcd796ae9b8d055903260e7150996ea9f53d))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.2
* **@visulima/error:** upgraded to 6.0.0-alpha.1
* **@visulima/fs:** upgraded to 5.0.0-alpha.1

## @visulima/email [1.0.0-alpha.2](https://github.com/visulima/visulima/compare/@visulima/email@1.0.0-alpha.1...@visulima/email@1.0.0-alpha.2) (2025-12-02)

### Features

* add default email configuration options ([848d2fb](https://github.com/visulima/visulima/commit/848d2fb723634aa6e027be55fa479bfb99c6504c))
* add disposable email detection utility to email package ([59bebd4](https://github.com/visulima/visulima/commit/59bebd4114efc5f77740f458bef7bbe6e8bcfcee))
* add draft email functionality and enhance documentation ([3ea7e88](https://github.com/visulima/visulima/commit/3ea7e88f0af453709294802f50028b0ac4fb723e))
* add email alias normalization utility and documentation ([1efed30](https://github.com/visulima/visulima/commit/1efed309a833f122f2aa586e11c2622492e8580d))
* add email verification utilities and tests ([88079a7](https://github.com/visulima/visulima/commit/88079a7c718040fb6118991ea37d4da1d3668aef))
* enhance draft email functionality and update documentation ([25e153e](https://github.com/visulima/visulima/commit/25e153e1f6c2466f3c8246357cc31ed4dd8eb297))
* enhance email package with new utilities and updates ([e06baf0](https://github.com/visulima/visulima/commit/e06baf00a6dcbd78642fbd046801333236d7279e))
* initialize disposable email domains package with configuration and utilities ([ef671a1](https://github.com/visulima/visulima/commit/ef671a14492abae5bbf7324f36b49d24f3f5cf58))
* integrate disposable email domains into email package ([24b3d42](https://github.com/visulima/visulima/commit/24b3d425bb6e5a7da2fb3922f0d093dc271536fe))
* update disposable email domains package and enhance synchronization ([dd81823](https://github.com/visulima/visulima/commit/dd818230a2435568317fdb02728a96ec580962a3))

### Miscellaneous Chores

* update @visulima/packem version to 2.0.0-alpha.40 across multiple packages ([e5be373](https://github.com/visulima/visulima/commit/e5be373fef8f8dda20c1dee7a1ac30d9b7a7712e))
* update package dependencies and versions across multiple packages ([9a9ac80](https://github.com/visulima/visulima/commit/9a9ac8046f7138cf37bec9e2041bc2125e97f212))

### Code Refactoring

* enhance role account prefixes and update README ([b4f3a1f](https://github.com/visulima/visulima/commit/b4f3a1fdf43985f503aecf23b999e3443b52a403))
* simplify disposable email tests and remove unused functions ([c331ec5](https://github.com/visulima/visulima/commit/c331ec5d93df2b8b564733f2104c373a62fb87ee))
* update disposable email domains synchronization workflow and README ([c3b3291](https://github.com/visulima/visulima/commit/c3b3291c76a6e4bfa47788341cdf72c34a8987e0))


### Dependencies

* **@visulima/disposable-email-domains:** upgraded to 1.0.0-alpha.1

## @visulima/email 1.0.0-alpha.1 (2025-11-29)

### Features

* create new email package and providers ([#567](https://github.com/visulima/visulima/issues/567)) ([783cecf](https://github.com/visulima/visulima/commit/783cecf89fd772ae9caf679e0bca33ab4611216c))

### Bug Fixes

* enhance email package functionality and improve test coverage ([550c0ba](https://github.com/visulima/visulima/commit/550c0ba408afac52291c48ae503ca12c3fd57c3b))

### Miscellaneous Chores

* clean up pnpm-lock.yaml by removing unused dependencies ([57f3464](https://github.com/visulima/visulima/commit/57f3464e0b3910020b18c28cc194366601d1dd03))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]
