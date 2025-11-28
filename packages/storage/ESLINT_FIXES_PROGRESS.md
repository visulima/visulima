# ESLint Fixes Progress

## Summary

- **Initial Issues**: 647 (567 errors, 80 warnings)
- **Current Issues**: 512 (431 errors, 81 warnings)
- **Fixed**: 135 issues (21% reduction)
- **Status**: In Progress
- **Remaining**: Mostly complex refactoring (nested functions, identical functions, cognitive complexity), some no-param-reassign
- **Source Files**: ~1 error remaining
- **Test Files**: ~486 errors remaining

## Files to Fix

### Test Files

#### `__tests__/__helpers__/express-app.ts`

- [ ] 0:1 - Rename file to "app" (sonarjs/file-name-differ-from-class)
- [ ] 6:7 - Framework version disclosure (sonarjs/x-powered-by)
- [ ] 9:1 - Should be done within a hook (vitest/require-hook)
- [ ] 14:1 - Should be done within a hook (vitest/require-hook)
- [ ] 17:1 - Should be done within a hook (vitest/require-hook)

#### `__tests__/handler/base/base-handler.test.ts`

- [ ] 65:5 - `beforeEach` hooks should be before any `afterAll` hooks (vitest/prefer-hooks-in-order)
- [ ] 69:5 - `afterEach` hooks should be before any `afterAll` hooks (vitest/prefer-hooks-in-order)
- [ ] Multiple nested function issues (sonarjs/no-nested-functions) - lines: 301, 323, 347, 350, 363, 434, 464, 502, 562, 614, 657, 667

#### `__tests__/handler/range-requests.test.ts`

- [ ] 43:5 - `beforeEach` hooks should be before any `afterAll` hooks (vitest/prefer-hooks-in-order)
- [ ] 47:5 - `afterEach` hooks should be before any `afterAll` hooks (vitest/prefer-hooks-in-order)

#### `__tests__/handler/rest/fetch/rest.test.ts`

- [ ] Multiple console statements (no-console) - lines: 61, 64, 67, 70, 93, 94, 95, 101, 103, 104

#### `__tests__/handler/rest/node/rest-chunked.test.ts`

- [ ] Multiple expect assertions warnings (vitest/prefer-expect-assertions)
- [ ] 83:46 - Unexpected dangling '\_' in '\_chunkedUpload' (no-underscore-dangle)
- [ ] Standalone expect calls (vitest/no-standalone-expect) - lines: 117, 130, 134, 139

#### `__tests__/handler/tus/fetch/tus.test.ts`

- [ ] Multiple nested function issues (sonarjs/no-nested-functions) - lines: 61, 97, 136, 178, 218, 253
- [ ] Identical function issues (sonarjs/no-identical-functions) - lines: 97, 136, 178, 218, 253

#### `__tests__/handler/tus/node/tus-express.test.ts`

- [ ] Slow regex issues (sonarjs/slow-regex) - lines: 105, 129, 135, 157, 158, 193, 194, 260
- [ ] 135:9 - Definition for rule 'radar/no-duplicate-string' was not found (radar/no-duplicate-string)

#### `__tests__/handler/tus/node/tus-extended.test.ts`

- [ ] Multiple nested function issues (sonarjs/no-nested-functions) - lines: 39, 134, 183, 209, 229, 260, 363, 424, 456
- [ ] Await in loop issues (no-await-in-loop) - lines: 133, 259, 362, 455
- [ ] 285:9 - Test has no assertions (vitest/expect-expect, sonarjs/assertions-in-tests)

#### `__tests__/handler/tus/node/tus.test.ts`

- [ ] Slow regex issues (sonarjs/slow-regex) - lines: 106, 129, 147, 148, 252

#### `__tests__/metrics/index.test.ts`

- [ ] 36:13 - Avoid calling `expect` inside conditional statements (vitest/no-conditional-expect)

#### `__tests__/metrics/metrics.test.ts`

- [ ] 74:21 - Unexpected `await` inside a loop (no-await-in-loop)
- [ ] 129:17 - Avoid calling `expect` inside conditional statements (vitest/no-conditional-expect)
- [ ] Multiple nested function issues (sonarjs/no-nested-functions) - lines: 236, 243, 267, 274, 302, 309, 327, 334, 358, 365, 389, 396, 414, 421, 439, 446, 489, 510, 517, 522, 567, 574, 608, 615
- [ ] Disabled tests (vitest/no-disabled-tests) - lines: 482, 541, 591
- [ ] Conditional tests (vitest/no-conditional-in-test, vitest/no-conditional-expect) - lines: 644, 645, 646

#### `__tests__/openapi/shared.test.ts`

- [ ] Use `toStrictEqual()` instead (vitest/prefer-strict-equal) - lines: 21, 76, 96, 163, 164, 172, 173

#### `__tests__/openapi/xhr.test.ts`

- [ ] Snapshot hints (vitest/prefer-snapshot-hint) - lines: 15, 16

#### `__tests__/storage/aws-light/aws-light-storage.test.ts`

- [ ] Multiple string entropy issues (no-secrets/no-secrets)
- [ ] 181:60, 453:60 - Add error message to toThrow() (vitest/require-to-throw-message)
- [ ] 710:47 - Unexpected any (@typescript-eslint/no-explicit-any)
- [ ] Identical function issues (sonarjs/no-identical-functions) - lines: 686, 698

#### `__tests__/storage/aws/s3-storage.test.ts`

- [ ] 214:60 - Add error message to toThrow() (vitest/require-to-throw-message)

#### `__tests__/storage/batch-operations.test.ts`

- [ ] Multiple dangling underscore issues (no-underscore-dangle) - lines: 70, 71, 72, 94, 143, 144, 168, 169, 192, 245, 246, 269, 323, 342, 361
- [ ] Await in loop issues (no-await-in-loop) - lines: 140, 144

#### `__tests__/storage/gcs/gcs-file.test.ts`

- [ ] String entropy issues (no-secrets/no-secrets) - lines: 14, 16

#### `__tests__/storage/gcs/gcs-storage.test.ts`

- [ ] 48:17 - String entropy issue (no-secrets/no-secrets)
- [ ] 49:11 - Unused variable 'request' (unused-imports/no-unused-vars, sonarjs/no-unused-vars, sonarjs/no-dead-store)
- [ ] 49:56 - Using http protocol is insecure (sonarjs/no-clear-text-protocols)
- [ ] Multiple expect assertions warnings (vitest/prefer-expect-assertions)
- [ ] 158:13 - Definition for rule 'radar/no-duplicate-string' was not found (radar/no-duplicate-string)
- [ ] Conditional expect issues (vitest/no-conditional-expect) - lines: 247, 248
- [ ] 247:92, 380:32 - Using http protocol is insecure (sonarjs/no-clear-text-protocols)
- [ ] 306:60 - Add error message to toThrow() (vitest/require-to-throw-message)

#### `__tests__/storage/local/disk-storage-with-checksum.test.ts`

- [ ] 28:11 - Unused variable 'request' (unused-imports/no-unused-vars, sonarjs/no-unused-vars, sonarjs/no-dead-store)
- [ ] 103:15 - Unused variable 'deletedFile' (unused-imports/no-unused-vars, sonarjs/no-unused-vars, sonarjs/no-dead-store)
- [ ] 124:56, 162:56, 197:56, 231:60 - Pseudorandom number generator (sonarjs/pseudo-random)
- [ ] 125:34, 125:47, 232:34, 232:47 - Variable naming convention issues (@typescript-eslint/naming-convention, sonarjs/no-unused-vars)

#### `__tests__/storage/local/disk-storage.test.ts`

- [ ] Conditional expect issues (vitest/no-conditional-expect)

### Source Files

#### `src/metrics/opentelemetry-metrics.ts`

- [ ] 49:1 - Unexpected inline JSDoc tag (jsdoc/escape-inline-tags)
- [ ] 69:25, 87:27, 104:23 - Forbidden non-null assertion (@typescript-eslint/no-non-null-assertion)

#### `src/openapi/rest.ts`

- [ ] 0:1 - Rename file to "swaggerSpec" (sonarjs/file-name-differ-from-class)

#### `src/openapi/shared.ts`

- [ ] 554:37 - Unexpected any (@typescript-eslint/no-explicit-any)

#### `src/openapi/transform.ts`

- [ ] 0:1 - Rename file to "swaggerSpec" (sonarjs/file-name-differ-from-class)

#### `src/openapi/tus.ts`

- [ ] 0:1 - Rename file to "swaggerSpec" (sonarjs/file-name-differ-from-class)

#### `src/openapi/xhr.ts`

- [ ] 0:1 - Rename file to "swaggerSpec" (sonarjs/file-name-differ-from-class)

#### `src/storage/aws-light/aws-light-api-adapter.ts`

- [ ] 12:58 - Cognitive complexity too high (sonarjs/cognitive-complexity)
- [ ] 19:22, 40:25 - Slow regex (sonarjs/slow-regex)
- [ ] 157:9 - Replace if statement with ternary (unicorn/prefer-ternary)
- [ ] Multiple anchor precedence issues (sonarjs/anchor-precedence) - lines: 186, 227, 266, 318, 363
- [ ] 200:25 - String entropy issue (no-secrets/no-secrets)
- [ ] 261:46 - Extract nested ternary (sonarjs/no-nested-conditional)

#### `src/storage/aws/s3-base-storage.ts`

- [x] 22:1, 31:1 - Export statements should appear at the end (import/exports-last) - FIXED
- [ ] 212:19 - Each then() should return a value (promise/always-return)
- [ ] 301:59 - Cognitive complexity too high (sonarjs/cognitive-complexity)
- [ ] 343:161 - Unexpected any (@typescript-eslint/no-explicit-any)
- [ ] 351:29 - Assignment to property of function parameter (no-param-reassign)
- [ ] 481:22 - Cognitive complexity too high (sonarjs/cognitive-complexity)
- [ ] 502:37, 522:25 - Unexpected `await` inside a loop (no-await-in-loop)
- [ ] 518:25 - Remove useless assignment (sonarjs/no-dead-store)
- [ ] 537:57 - Cognitive complexity too high (sonarjs/cognitive-complexity)
- [ ] 608:9, 630:10 - Assignment to property of function parameter (no-param-reassign)
- [ ] 645:31 - Forbidden non-null assertion (@typescript-eslint/no-non-null-assertion)

#### `src/storage/aws/s3-client-adapter.ts`

- [x] 39:9 - Expected 'undefined' and instead saw 'void' (no-void, sonarjs/void-use) - FIXED
- [x] 78:9 - Use 'const' instead (prefer-const) - FIXED
- [x] 78:140, 190:106 - Unexpected any (@typescript-eslint/no-explicit-any) - FIXED

#### `src/storage/aws/s3-meta-storage.ts`

- [x] 98:74 - Unexpected any (@typescript-eslint/no-explicit-any) - FIXED

#### `src/storage/azure/azure-storage.ts`

- [ ] 136:19 - Each then() should return a value (promise/always-return)
- [ ] 217:1, 243:1, 385:1 - The type 'UploadError' is undefined (jsdoc/no-undefined-types)
- [ ] 257:59 - Cognitive complexity too high (sonarjs/cognitive-complexity)
- [ ] 297:29 - Assignment to property of function parameter (no-param-reassign)
- [ ] 458:25 - Remove useless assignment (sonarjs/no-dead-store)
- [ ] 462:25 - Unexpected `await` inside a loop (no-await-in-loop)

#### `src/storage/gcs/gcs-storage.ts`

- [ ] 0:1 - Rename file to "GCStorage" (sonarjs/file-name-differ-from-class)
- [ ] 128:19 - Each then() should return a value (promise/always-return)
- [ ] 277:25 - Assignment to property of function parameter (no-param-reassign)
- [ ] 306:1, 333:1, 380:1, 398:1 - The type 'UploadError' is undefined (jsdoc/no-undefined-types)
- [ ] 464:25 - Remove useless assignment (sonarjs/no-dead-store)
- [ ] 468:25 - Unexpected `await` inside a loop (no-await-in-loop)

#### `src/storage/gcs/types.ts`

- [x] 25:28, 26:31 - Unexpected any (@typescript-eslint/no-explicit-any) - FIXED

#### `src/storage/gcs/utils.ts`

- [ ] 9:31 - Slow regex (sonarjs/slow-regex)

#### `src/storage/local/disk-storage-with-checksum.ts`

- [ ] 19:1 - JSDoc indentation issue (jsdoc/check-indentation)
- [ ] 56:27 - Cognitive complexity too high (sonarjs/cognitive-complexity)
- [ ] 120:25 - Assignment to property of function parameter (no-param-reassign)

#### `src/storage/local/disk-storage.ts`

- [ ] 76:19 - Each then() should return a value (promise/always-return)
- [ ] 104:60 - Cognitive complexity too high (sonarjs/cognitive-complexity)
- [ ] 372:1, 411:1, 433:1 - The type 'UploadError' is undefined (jsdoc/no-undefined-types)
- [ ] 527:46 - Expected to return a value (consistent-return)
- [ ] 557:17 - Return values from promise executor functions cannot be read (no-promise-executor-return)

#### `src/storage/netlify-blob/netlify-blob-storage.ts`

- [ ] 88:17 - Replace if-then-else flow by a single return statement (sonarjs/prefer-single-boolean-return)
- [ ] 147:59 - Cognitive complexity too high (sonarjs/cognitive-complexity)
- [ ] 246:1, 347:1, 426:1 - The type 'UploadError' is undefined (jsdoc/no-undefined-types)
- [ ] 319:55, 457:58 - Use `undefined` instead of `null` (unicorn/no-null)
- [ ] 337:23, 337:36 - Use explicit length check (unicorn/explicit-length-check)
- [ ] 497:1 - JSDoc description does not satisfy the regex pattern (jsdoc/match-description)

#### `src/storage/storage.ts`

- [ ] 304:1 - The type 'ValidationError' is undefined (jsdoc/no-undefined-types)
- [ ] 389:1, 412:1, 481:1, 491:1, 536:1, 591:1, 601:1, 610:1 - The type 'UploadError' is undefined (jsdoc/no-undefined-types)
- [x] 418:13, 420:13, 891:27 - Remove this use of the "void" operator (sonarjs/void-use) - FIXED

#### `src/storage/utils/file/get-file-status.ts`

- [x] 9:56 - Unnecessary parentheses (@stylistic/no-extra-parens) - FIXED
- [x] 9:105 - Extract nested ternary (sonarjs/no-nested-conditional) - FIXED

#### `src/storage/utils/file/metadata.ts`

- [x] 12:11 - Unexpected dangling '_' in 'number_' (no-underscore-dangle, @typescript-eslint/naming-convention) - FIXED
- [x] 14:38 - Prefer `Number.isFinite` over `isFinite` (no-restricted-globals, unicorn/prefer-number-properties) - FIXED
- [x] 48:45 - Unary operator '++' used (no-plusplus) - FIXED
- [ ] 82:59 - Cognitive complexity too high (sonarjs/cognitive-complexity)
- [ ] 99:68 - Extract nested ternary (sonarjs/no-nested-conditional)

#### `src/storage/utils/file/types.ts`

- [x] 7:17 - Replace union type with a type alias (sonarjs/use-type-alias) - FIXED

#### `src/storage/vercel-blob/vercel-blob-storage.ts`

- [ ] 105:59 - Cognitive complexity too high (sonarjs/cognitive-complexity)
- [ ] 201:1, 268:1, 299:1 - The type 'UploadError' is undefined (jsdoc/no-undefined-types)
- [ ] 258:23, 258:36 - Use explicit length check (unicorn/explicit-length-check)

#### `src/transformer/audio-transformer.ts`

- [ ] 112:83, 215:68, 216:24, 272:70, 291:57 - Unexpected any (@typescript-eslint/no-explicit-any)
- [ ] 171:1, 209:1, 267:1, 285:1, 315:1, 359:1, 389:1 - JSDoc description does not satisfy the regex pattern (jsdoc/match-description)
- [ ] 215:13 - Cognitive complexity too high (sonarjs/cognitive-complexity)
- [ ] 219:13 - Expected a default case (default-case)

#### `src/transformer/base-transformer.ts`

- [ ] 53:54, 53:70, 61:58, 105:34, 115:48 - Unexpected any (@typescript-eslint/no-explicit-any)
- [ ] 115:40 - Argument 'result' should be typed with a non-any type (@typescript-eslint/explicit-module-boundary-types)

#### `src/transformer/image-transformer.ts`

- [ ] 532:13 - Too many switch cases (sonarjs/max-switch-cases)
- [ ] Multiple unexpected any issues (@typescript-eslint/no-explicit-any) - lines: 676, 705, 782, 920, 960, 1005, 1065, 1125, 1287, 1289
- [ ] 1205:13 - Identical function (sonarjs/no-identical-functions)
- [ ] 1226:17, 1246:17 - Unused variables (unused-imports/no-unused-vars)

#### `src/transformer/media-transformer.ts`

- [ ] 402:76 - Replace union type with a type alias (sonarjs/use-type-alias)
- [ ] 403:9 - Expected a default case (default-case)
- [ ] 551:13 - Cognitive complexity too high (sonarjs/cognitive-complexity)
- [ ] Multiple unexpected any issues (@typescript-eslint/no-explicit-any) - lines: 726, 727, 729, 730, 736, 738, 744, 745, 746, 748, 789, 938, 1012, 1090
- [ ] 998:49, 998:105, 1076:49, 1076:105, 1134:49, 1134:105 - Forbidden non-null assertion (@typescript-eslint/no-non-null-assertion)
- [ ] 1234:13 - Cognitive complexity too high (sonarjs/cognitive-complexity)

#### `src/transformer/types.ts`

- [ ] 190:18, 286:11, 477:13, 491:13 - Replace union type with a type alias (sonarjs/use-type-alias)

#### `src/transformer/video-transformer.ts`

- [ ] 129:83, 236:68, 237:24, 319:70, 338:57 - Unexpected any (@typescript-eslint/no-explicit-any)
- [ ] 236:13 - Cognitive complexity too high (sonarjs/cognitive-complexity)
- [ ] 240:13 - Expected a default case (default-case)

#### `src/utils/chunked-upload.ts`

- [x] 100:38 - Unnecessary parentheses (@stylistic/no-extra-parens) - FIXED
- [x] Multiple dangling underscore issues (no-underscore-dangle) - lines: 158, 160, 161, 162, 178, 188, 190, 191 - FIXED
- [x] 188:11 - Variable shadowing (@typescript-eslint/no-shadow) - FIXED

#### `src/utils/http.ts`

- [ ] 81:53 - Extract nested ternary (sonarjs/no-nested-conditional)
- [ ] 212:34 - Slow regex (sonarjs/slow-regex)
- [x] 233:55 - Unary operator '--' used (no-plusplus) - FIXED

#### `src/utils/pipes/stream-checksum.ts`

- [x] 78:31 - Arrow function used ambiguously with a conditional expression (no-confusing-arrow) - FIXED

#### `src/utils/retry.ts`

- [x] 4:1, 70:1 - Export statements should appear at the end (import/exports-last) - FIXED
- [ ] 65:1, 129:1, 143:1, 149:1, 199:1 - JSDoc description does not satisfy the regex pattern (jsdoc/match-description)
- [ ] 70:133 - Cognitive complexity too high (sonarjs/cognitive-complexity)
- [x] 146:71 - Return values from promise executor functions cannot be read (no-promise-executor-return) - FIXED
- [ ] 150:1 - Expected @param names to be "function\_, config". Got "fn, config" (jsdoc/check-param-names)
- [ ] 155:99 - Cognitive complexity too high (sonarjs/cognitive-complexity)
- [x] 168:50 - Unary operator '++' used (no-plusplus) - FIXED
- [x] 170:20, 190:17 - Unexpected `await` inside a loop (no-await-in-loop) - FIXED

#### `src/utils/streaming.ts`

- [ ] 213:17 - 'processNextChunk' was used before it was defined (@typescript-eslint/no-use-before-define)
- [ ] 230:23 - Forbidden non-null assertion (@typescript-eslint/no-non-null-assertion)
- [ ] 302:33, 308:33 - Do not pass function `clearTimeout` directly to `.forEach(…)` (unicorn/no-array-callback-reference)

#### `src/utils/validator.ts`

- [x] 68:29 - Unexpected `await` inside a loop (no-await-in-loop) - FIXED

## Notes

- Some issues may require refactoring (cognitive complexity, nested functions)
- Some file rename suggestions may not be appropriate (e.g., openapi files)
- Some rules may need to be disabled if they're false positives (e.g., radar/no-duplicate-string)
