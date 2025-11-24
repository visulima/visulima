# Test Coverage Analysis

## Summary
- **Total Source Files**: 134 files
- **Total Test Files**: 22 files
- **Coverage**: ~16% of source files have tests

## Core (`src/core/`) - 7 files

### ✅ Tested (3/7)
- `multipart-adapter.ts` → `__tests__/core/multipart-adapter.test.ts`
- `tus-adapter.ts` → `__tests__/core/tus-adapter.test.ts`
- `uploader.ts` → `__tests__/core/uploader.test.ts`, `uploader-abort.test.ts`, `uploader-batch.test.ts`, `uploader-retry.test.ts`

### ❌ Missing Tests (4/7)
- `chunked-rest-adapter.ts` - **NO TEST**
- `query-client.ts` - **NO TEST** (exports: buildUrl, deleteRequest, extractFileMetaFromHeaders, fetchFile, fetchHead, fetchJson, parseApiError, patchChunk, putFile)
- `query-keys.ts` - **NO TEST** (exports: storageQueryKeys)
- `index.ts` - Export file, no test needed

---

## React (`src/react/`) - 29 files

### ✅ Tested (9/29)
- `use-abort-all.ts` → `__tests__/react/use-abort-all.test.ts`
- `use-abort-batch.ts` → `__tests__/react/use-abort-batch.test.ts`
- `use-abort-item.ts` → `__tests__/react/use-abort-item.test.ts`
- `use-batch-retry.ts` → `__tests__/react/use-batch-retry.test.ts`
- `use-batch-upload.ts` → `__tests__/react/use-batch-upload.test.ts`
- `use-file-input.ts` → `__tests__/react/use-file-input.test.ts`
- `use-get-file.ts` → `__tests__/react/use-get-file.test.ts`
- `use-multipart-upload.ts` → `__tests__/react/use-multipart-upload.test.ts`
- `use-paste-upload.ts` → `__tests__/react/use-paste-upload.test.ts`
- `use-put-file.ts` → `__tests__/react/use-put-file.test.ts`
- `use-retry.ts` → `__tests__/react/use-retry.test.ts`

### ❌ Missing Tests (18/29)
- `use-all-abort-listener.ts` - **NO TEST**
- `use-batch-cancelled-listener.ts` - **NO TEST**
- `use-batch-delete-files.ts` - **NO TEST**
- `use-batch-error-listener.ts` - **NO TEST**
- `use-batch-finalize-listener.ts` - **NO TEST**
- `use-batch-finish-listener.ts` - **NO TEST**
- `use-batch-progress-listener.ts` - **NO TEST**
- `use-batch-start-listener.ts` - **NO TEST**
- `use-chunked-rest-upload.ts` - **NO TEST**
- `use-delete-file.ts` - **NO TEST**
- `use-get-file-list.ts` - **NO TEST**
- `use-get-file-meta.ts` - **NO TEST**
- `use-head-file.ts` - **NO TEST**
- `use-patch-chunk.ts` - **NO TEST**
- `use-retry-listener.ts` - **NO TEST**
- `use-transform-file.ts` - **NO TEST**
- `use-transform-metadata.ts` - **NO TEST**
- `use-tus-upload.ts` - **NO TEST**
- `use-upload.ts` - **NO TEST**
- `index.ts` - Export file, no test needed
- `types.ts` - Type definitions, no test needed

---

## Vue (`src/vue/`) - 31 files

### ✅ Tested (3/31)
- `use-batch-upload.ts` → `__tests__/vue/use-batch-upload.test.ts`
- `use-file-input.ts` → `__tests__/vue/use-file-input.test.ts`
- `use-get-file.ts` → `__tests__/vue/use-get-file.test.ts`

### ❌ Missing Tests (28/31)
- `use-abort-all.ts` - **NO TEST**
- `use-abort-batch.ts` - **NO TEST**
- `use-abort-item.ts` - **NO TEST**
- `use-all-abort-listener.ts` - **NO TEST**
- `use-batch-cancelled-listener.ts` - **NO TEST**
- `use-batch-delete-files.ts` - **NO TEST**
- `use-batch-error-listener.ts` - **NO TEST**
- `use-batch-finalize-listener.ts` - **NO TEST**
- `use-batch-finish-listener.ts` - **NO TEST**
- `use-batch-progress-listener.ts` - **NO TEST**
- `use-batch-retry.ts` - **NO TEST**
- `use-batch-start-listener.ts` - **NO TEST**
- `use-chunked-rest-upload.ts` - **NO TEST**
- `use-delete-file.ts` - **NO TEST**
- `use-get-file-list.ts` - **NO TEST**
- `use-get-file-meta.ts` - **NO TEST**
- `use-head-file.ts` - **NO TEST**
- `use-multipart-upload.ts` - **NO TEST**
- `use-paste-upload.ts` - **NO TEST**
- `use-patch-chunk.ts` - **NO TEST**
- `use-put-file.ts` - **NO TEST**
- `use-retry-listener.ts` - **NO TEST**
- `use-retry.ts` - **NO TEST**
- `use-transform-file.ts` - **NO TEST**
- `use-transform-metadata.ts` - **NO TEST**
- `use-tus-upload.ts` - **NO TEST**
- `use-upload.ts` - **NO TEST**
- `index.ts` - Export file, no test needed

---

## Solid (`src/solid/`) - 31 files

### ✅ Tested (1/31)
- `create-get-file.ts` → `__tests__/solid/create-get-file.test.ts`

### ❌ Missing Tests (30/31)
- `create-abort-all.ts` - **NO TEST**
- `create-abort-batch.ts` - **NO TEST**
- `create-abort-item.ts` - **NO TEST**
- `create-all-abort-listener.ts` - **NO TEST**
- `create-batch-cancelled-listener.ts` - **NO TEST**
- `create-batch-delete-files.ts` - **NO TEST**
- `create-batch-error-listener.ts` - **NO TEST**
- `create-batch-finalize-listener.ts` - **NO TEST**
- `create-batch-finish-listener.ts` - **NO TEST**
- `create-batch-progress-listener.ts` - **NO TEST**
- `create-batch-retry.ts` - **NO TEST**
- `create-batch-start-listener.ts` - **NO TEST**
- `create-batch-upload.ts` - **NO TEST**
- `create-chunked-rest-upload.ts` - **NO TEST**
- `create-delete-file.ts` - **NO TEST**
- `create-file-input.ts` - **NO TEST**
- `create-get-file-list.ts` - **NO TEST**
- `create-get-file-meta.ts` - **NO TEST**
- `create-head-file.ts` - **NO TEST**
- `create-multipart-upload.ts` - **NO TEST**
- `create-paste-upload.ts` - **NO TEST**
- `create-patch-chunk.ts` - **NO TEST**
- `create-put-file.ts` - **NO TEST**
- `create-retry-listener.ts` - **NO TEST**
- `create-retry.ts` - **NO TEST**
- `create-transform-file.ts` - **NO TEST**
- `create-transform-metadata.ts` - **NO TEST**
- `create-tus-upload.ts` - **NO TEST**
- `create-upload.ts` - **NO TEST**
- `index.ts` - Export file, no test needed

---

## Svelte (`src/svelte/`) - 31 files

### ✅ Tested (1/31)
- `create-get-file.ts` → `__tests__/svelte/create-get-file.test.ts`

### ❌ Missing Tests (30/31)
- `create-abort-all.ts` - **NO TEST**
- `create-abort-batch.ts` - **NO TEST**
- `create-abort-item.ts` - **NO TEST**
- `create-all-abort-listener.ts` - **NO TEST**
- `create-batch-cancelled-listener.ts` - **NO TEST**
- `create-batch-delete-files.ts` - **NO TEST**
- `create-batch-error-listener.ts` - **NO TEST**
- `create-batch-finalize-listener.ts` - **NO TEST**
- `create-batch-finish-listener.ts` - **NO TEST**
- `create-batch-progress-listener.ts` - **NO TEST**
- `create-batch-retry.ts` - **NO TEST**
- `create-batch-start-listener.ts` - **NO TEST**
- `create-batch-upload.ts` - **NO TEST**
- `create-chunked-rest-upload.ts` - **NO TEST**
- `create-delete-file.ts` - **NO TEST**
- `create-file-input.ts` - **NO TEST**
- `create-get-file-list.ts` - **NO TEST**
- `create-get-file-meta.ts` - **NO TEST**
- `create-head-file.ts` - **NO TEST**
- `create-multipart-upload.ts` - **NO TEST**
- `create-paste-upload.ts` - **NO TEST**
- `create-patch-chunk.ts` - **NO TEST**
- `create-put-file.ts` - **NO TEST**
- `create-retry-listener.ts` - **NO TEST**
- `create-retry.ts` - **NO TEST**
- `create-transform-file.ts` - **NO TEST**
- `create-transform-metadata.ts` - **NO TEST**
- `create-tus-upload.ts` - **NO TEST**
- `create-upload.ts` - **NO TEST**
- `index.ts` - Export file, no test needed

---

## Root Files
- `index.ts` - Export file, no test needed
- `reset.d.ts` - Type definitions, no test needed

---

## Priority Recommendations

### High Priority (Core functionality)
1. **Core**: `chunked-rest-adapter.ts`, `query-client.ts`, `query-keys.ts`
2. **React**: `use-upload.ts`, `use-tus-upload.ts`, `use-chunked-rest-upload.ts`, `use-delete-file.ts`, `use-get-file-list.ts`, `use-get-file-meta.ts`, `use-head-file.ts`

### Medium Priority (Framework parity)
3. **Vue**: Match React test coverage (28 missing tests)
4. **Solid**: Match React test coverage (30 missing tests)
5. **Svelte**: Match React test coverage (30 missing tests)

### Lower Priority (Listeners and transforms)
6. All listener hooks (batch listeners, abort listeners, retry listeners)
7. Transform hooks (`use-transform-file.ts`, `use-transform-metadata.ts`)

