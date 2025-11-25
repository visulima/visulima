# Storage Adapters Hooks Review

## Executive Summary

This document reviews all storage adapter implementations to verify consistent hook usage across all storage backends. The review covers hook definitions, hook calls, and identifies inconsistencies.

## Hook Definitions

All storage implementations inherit from `BaseStorage` which defines 5 hooks:

1. **onCreate**: `(file: TFile) => Promise<void> | void`
   - Called when a new file is created
   - Called after file metadata is saved but before returning the file

2. **onUpdate**: `(file: TFile) => Promise<void> | void`
   - Called when file metadata is updated
   - Called after metadata is updated and saved

3. **onDelete**: `(file: TFile) => Promise<void> | void`
   - Called when a file is deleted
   - Called after the file is deleted but before returning

4. **onComplete**: `(file: TFile, response: unknown, request?: unknown) => Promise<void> | void`
   - Called when a file upload is completed
   - Called when file status becomes "completed"
   - The response object can be modified directly

5. **onError**: `(error: HttpError) => Promise<void> | void`
   - Called when an error occurs during storage operations
   - Allows customizing error responses by modifying the error object

## Storage Implementations Reviewed

1. **DiskStorage** (`storage/local/disk-storage.ts`)
2. **DiskStorageWithChecksum** (`storage/local/disk-storage-with-checksum.ts`)
3. **S3Storage** (`storage/aws/s3-storage.ts`)
4. **S3BaseStorage** (`storage/aws/s3-base-storage.ts`)
5. **AwsLightStorage** (`storage/aws-light/aws-light-storage.ts`)
6. **GCSStorage** (`storage/gcs/gcs-storage.ts`)
7. **AzureStorage** (`storage/azure/azure-storage.ts`)
8. **VercelBlobStorage** (`storage/vercel-blob/vercel-blob-storage.ts`)
9. **NetlifyBlobStorage** (`storage/netlify-blob/netlify-blob-storage.ts`)

## Hook Usage Analysis

### onCreate Hook

**Status**: ✅ Mostly Consistent (with one exception)

**Implementation Pattern**:
- Called in `create()` method after `saveMeta()` and before returning the file
- All implementations follow this pattern except S3Storage

**Findings**:

| Storage | onCreate Called | Notes |
|---------|----------------|-------|
| DiskStorage | ✅ Yes | Line 164: `await this.onCreate(file as TFile);` |
| DiskStorageWithChecksum | ✅ Yes | Inherits from DiskStorage |
| S3BaseStorage | ✅ Yes | Line 288: `await this.onCreate(file);` |
| S3Storage | ⚠️ Conditional | Line 133: Overridden to no-op when `clientDirectUpload` is enabled |
| AwsLightStorage | ✅ Yes | Inherits from S3BaseStorage |
| GCSStorage | ✅ Yes | Line 230: `await this.onCreate(file);` |
| AzureStorage | ✅ Yes | Line 206: `await this.onCreate(file);` |
| VercelBlobStorage | ✅ Yes | Line 99: `await this.onCreate(file);` |
| NetlifyBlobStorage | ✅ Yes | Line 141: `await this.onCreate(file);` |

**Issue Found**:
- **S3Storage** (line 132-134): When `clientDirectUpload` is enabled, `onCreate` is overridden to a no-op function:
  ```typescript
  if (this.config.clientDirectUpload) {
      this.onCreate = async () => {}; // TODO: remove hook
  }
  ```
  This breaks the expected behavior for users who configure `onCreate` hook.

### onUpdate Hook

**Status**: ✅ Consistent

**Implementation Pattern**:
- Called in `BaseStorage.update()` method (line 554)
- All implementations inherit this behavior
- Called after metadata is updated and saved

**Findings**:
- All storage implementations inherit `update()` from `BaseStorage`
- Hook is called consistently: `await this.onUpdate(updatedFile);`
- No issues found

### onDelete Hook

**Status**: ✅ Consistent

**Implementation Pattern**:
- Called in `delete()` method after file deletion and metadata deletion
- Should be called before returning the deleted file

**Findings**:

| Storage | onDelete Called | Notes |
|---------|----------------|-------|
| DiskStorage | ✅ Yes | Line 417: `await this.onDelete(deletedFile);` |
| DiskStorageWithChecksum | ✅ Yes | Line 42: `await this.onDelete(deletedFile);` |
| S3BaseStorage | ✅ Yes | Line 419: `await this.onDelete(deletedFile);` |
| S3Storage | ✅ Yes | Inherits from S3BaseStorage |
| AwsLightStorage | ✅ Yes | Inherits from S3BaseStorage |
| GCSStorage | ✅ Yes | Line 322: `await this.onDelete(deletedFile);` |
| AzureStorage | ✅ Yes | Line 232: `await this.onDelete(deletedFile);` |
| VercelBlobStorage | ✅ Yes | Line 228: `await this.onDelete(deletedFile);` |
| NetlifyBlobStorage | ✅ Yes | Line 273: `await this.onDelete(deletedFile);` |

**Analysis**:
- All storage implementations correctly call `onDelete` hook
- No issues found

### onComplete Hook

**Status**: ⚠️ Inconsistent (different patterns)

**Implementation Pattern**:
- Should be called when file status becomes "completed"
- Called from handlers (not storage layer) with full request/response context
- Some storages have `internalOnComplete` which is different

**Findings**:

| Storage | onComplete Called | Notes |
|---------|-------------------|-------|
| DiskStorage | ⚠️ No | Line 286-292: Comment explains it's not called at storage layer (handlers call it) |
| DiskStorageWithChecksum | ⚠️ No | Inherits from DiskStorage |
| S3BaseStorage | ⚠️ No | Has `internalOnComplete` (line 731) which is different - completes multipart upload |
| S3Storage | ⚠️ No | Inherits from S3BaseStorage |
| AwsLightStorage | ⚠️ No | Inherits from S3BaseStorage |
| GCSStorage | ⚠️ No | Has `internalOnComplete` (line 509) which only deletes metadata |
| AzureStorage | ⚠️ No | No onComplete call found |
| VercelBlobStorage | ⚠️ No | Has `internalOnComplete` (line 330) which only deletes metadata |
| NetlifyBlobStorage | ⚠️ No | Has `internalOnComplete` (line 468) which only deletes metadata |

**Analysis**:
- `onComplete` is intentionally NOT called at the storage layer
- It's called from handlers (`handler/utils/upload-handlers.ts` and `handler/base/base-handler-fetch.ts`)
- Handlers have access to request/response objects needed for the hook
- `internalOnComplete` methods in some storages are internal cleanup methods, not the public hook

**Conclusion**: This is **by design**, not a bug. The hook is called from handlers where request/response context is available.

### onError Hook

**Status**: ✅ Consistent (called in error scenarios)

**Implementation Pattern**:
- Called when errors occur during storage operations
- Called before throwing errors to allow customizing error responses
- The error object can be modified in place

**Findings**:

| Storage | onError Called | Notes |
|---------|----------------|-------|
| BaseStorage | ✅ Yes | Line 394: `await this.onError(httpError);` in `getMeta()` |
| DiskStorage | ✅ Yes | Lines 156, 303, 337, 343, 395, 466: Called in create, write, get, getStream, move operations |
| DiskStorageWithChecksum | ✅ Yes | Lines 50, 159: Called in delete and write operations |
| S3BaseStorage | ✅ Yes | Lines 520, 731: Called in list and abortMultipartUpload operations |
| S3Storage | ✅ Yes | Inherits from S3BaseStorage |
| AwsLightStorage | ✅ Yes | Inherits from S3BaseStorage |
| GCSStorage | ✅ Yes | Lines 458, 510: Called in error scenarios |
| AzureStorage | ✅ Yes | Line 462: Called in error scenarios |
| VercelBlobStorage | ✅ Yes | Line 221: Called in delete operation error handling |
| NetlifyBlobStorage | ✅ Yes | Line 266: Called in delete operation error handling |

**Analysis**:
- `onError` hook is consistently called across all storage implementations
- Hook is called in error scenarios before errors are thrown
- Allows users to customize error responses by modifying the error object
- No issues found

## Summary of Issues

### Medium Issues

1. **S3Storage.onCreate hook disabled for clientDirectUpload**
   - **Location**: `storage/aws/s3-storage.ts:132-134`
   - **Impact**: Users who configure `onCreate` hook won't get called when `clientDirectUpload` is enabled
   - **Fix**: Remove the override or call the original hook before/after the no-op

## Recommendations

### Immediate Fixes

1. **Fix S3Storage.onCreate for clientDirectUpload**:
   - Remove the override or preserve the original hook
   - If no-op is needed, call original hook first:
     ```typescript
     if (this.config.clientDirectUpload) {
         const originalOnCreate = this.onCreate;
         this.onCreate = async (file) => {
             await originalOnCreate(file);
             // Additional clientDirectUpload logic if needed
         };
     }
     ```

### Long-term Improvements

1. **Standardize hook calling patterns**:
   - Create helper methods in `BaseStorage` for consistent hook calling
   - Add error handling around hook calls (hooks shouldn't break storage operations)

2. **Add hook call validation**:
   - Add tests to verify all hooks are called in all storage implementations
   - Add linting rules to catch missing hook calls

3. **Document hook behavior**:
   - Clarify that `onComplete` is called from handlers, not storage layer
   - Document `internalOnComplete` vs public `onComplete` distinction
   - Add examples of hook usage in each storage type

## Testing Recommendations

1. **Add integration tests** for each storage type that verify:
   - `onCreate` is called after file creation
   - `onUpdate` is called after metadata update
   - `onDelete` is called after file deletion
   - `onError` is called when errors occur
   - `onComplete` is called from handlers (not storage layer)

2. **Add unit tests** for hook call verification:
   - Mock hooks and verify they're called with correct parameters
   - Test error scenarios to verify `onError` is called

## Conclusion

Most storage implementations follow consistent patterns for hook usage, with only **1 medium issue** that needs to be addressed:

1. ✅ **onCreate**: Mostly consistent (1 conditional override issue in S3Storage)
2. ✅ **onUpdate**: Fully consistent
3. ✅ **onDelete**: Fully consistent - all implementations call the hook
4. ✅ **onComplete**: By design, called from handlers (not storage layer)
5. ✅ **onError**: Fully consistent - called in error scenarios across all implementations

The only remaining issue is the `onCreate` hook being disabled in S3Storage when `clientDirectUpload` is enabled.

