/**
 * Vendored REAPI v2 + google.bytestream proto sources, embedded as TS
 * template literals so they bundle into the published `dist/` without
 * any asset-copy plugin.
 *
 * Field numbers and wire layout match the upstream definitions:
 *   - https://github.com/bazelbuild/remote-apis (Apache-2.0)
 *   - https://github.com/googleapis/googleapis/tree/master/google/bytestream (Apache-2.0)
 *
 * Subset scope: ActionCache + ContentAddressableStorage + Capabilities
 * (REAPI), plus Read/Write (ByteStream). The Execution service is
 * intentionally excluded — vis caches build results, it does not ask
 * remote workers to run actions.
 *
 * google.rpc.Status is vendored inline inside the REAPI proto's
 * package to avoid pulling in the whole google.rpc proto graph; the
 * field numbers (`code`, `message`) match google.rpc.Status, only
 * `details` (which depends on google.protobuf.Any) is omitted.
 */

// eslint-disable-next-line no-secrets/no-secrets -- vendored REAPI proto, identifiers come from build.bazel.remote.execution.v2 spec
export const REMOTE_EXECUTION_PROTO = `syntax = "proto3";

package build.bazel.remote.execution.v2;

message Digest {
  string hash = 1;
  int64 size_bytes = 2;
}

message NodeProperties {
  repeated NodeProperty properties = 1;
  string mtime = 2;
  uint32 unix_mode = 3;
}

message NodeProperty {
  string name = 1;
  string value = 2;
}

message OutputFile {
  string path = 1;
  Digest digest = 2;
  bool is_executable = 4;
  bytes contents = 5;
  NodeProperties node_properties = 7;
}

message OutputDirectory {
  string path = 1;
  Digest tree_digest = 3;
  bool is_topologically_sorted = 4;
  Digest root_directory_digest = 5;
}

message OutputSymlink {
  string path = 1;
  string target = 2;
  NodeProperties node_properties = 3;
}

message ActionResult {
  repeated OutputFile output_files = 2;
  repeated OutputSymlink output_file_symlinks = 10;
  repeated OutputSymlink output_symlinks = 12;
  repeated OutputDirectory output_directories = 3;
  repeated OutputSymlink output_directory_symlinks = 11;
  int32 exit_code = 4;
  bytes stdout_raw = 5;
  Digest stdout_digest = 6;
  bytes stderr_raw = 7;
  Digest stderr_digest = 8;
}

message FindMissingBlobsRequest {
  string instance_name = 1;
  repeated Digest blob_digests = 2;
  DigestFunction.Value digest_function = 3;
}

message FindMissingBlobsResponse {
  repeated Digest missing_blob_digests = 2;
}

message BatchUpdateBlobsRequest {
  message Request {
    Digest digest = 1;
    bytes data = 2;
    Compressor.Value compressor = 3;
  }
  string instance_name = 1;
  repeated Request requests = 2;
  DigestFunction.Value digest_function = 5;
}

message BatchUpdateBlobsResponse {
  message Response {
    Digest digest = 1;
    Status status = 2;
  }
  repeated Response responses = 1;
}

message BatchReadBlobsRequest {
  string instance_name = 1;
  repeated Digest digests = 2;
  repeated Compressor.Value acceptable_compressors = 3;
  DigestFunction.Value digest_function = 4;
}

message BatchReadBlobsResponse {
  message Response {
    Digest digest = 1;
    bytes data = 2;
    Compressor.Value compressor = 4;
    Status status = 3;
  }
  repeated Response responses = 1;
}

message GetActionResultRequest {
  string instance_name = 1;
  Digest action_digest = 2;
  bool inline_stdout = 3;
  bool inline_stderr = 4;
  repeated string inline_output_files = 5;
  DigestFunction.Value digest_function = 6;
}

message UpdateActionResultRequest {
  string instance_name = 1;
  Digest action_digest = 2;
  ActionResult action_result = 3;
  ResultsCachePolicy results_cache_policy = 4;
  DigestFunction.Value digest_function = 5;
}

message ResultsCachePolicy {
  int32 priority = 1;
}

message GetCapabilitiesRequest {
  string instance_name = 1;
}

message ServerCapabilities {
  CacheCapabilities cache_capabilities = 1;
  ExecutionCapabilities execution_capabilities = 2;
  SemVer deprecated_api_version = 3;
  SemVer low_api_version = 4;
  SemVer high_api_version = 5;
}

message ExecutionCapabilities {
  DigestFunction.Value digest_function = 1;
  bool exec_enabled = 2;
  PriorityCapabilities execution_priority_capabilities = 3;
  repeated string supported_node_properties = 4;
  repeated DigestFunction.Value digest_functions = 5;
}

message CacheCapabilities {
  repeated DigestFunction.Value digest_functions = 1;
  ActionCacheUpdateCapabilities action_cache_update_capabilities = 2;
  PriorityCapabilities cache_priority_capabilities = 3;
  int64 max_batch_total_size_bytes = 4;
  SymlinkAbsolutePathStrategy.Value symlink_absolute_path_strategy = 5;
  repeated Compressor.Value supported_compressors = 6;
  repeated Compressor.Value supported_batch_update_compressors = 7;
}

message ActionCacheUpdateCapabilities {
  bool update_enabled = 1;
}

message PriorityCapabilities {
  message PriorityRange {
    int32 min_priority = 1;
    int32 max_priority = 2;
  }
  repeated PriorityRange priorities = 1;
}

message SymlinkAbsolutePathStrategy {
  enum Value {
    UNKNOWN = 0;
    DISALLOWED = 1;
    ALLOWED = 2;
  }
}

message DigestFunction {
  enum Value {
    UNKNOWN = 0;
    SHA256 = 1;
    SHA1 = 2;
    MD5 = 3;
    VSO = 4;
    SHA384 = 5;
    SHA512 = 6;
    MURMUR3 = 7;
    SHA256TREE = 8;
    BLAKE3 = 9;
  }
}

message Compressor {
  enum Value {
    IDENTITY = 0;
    ZSTD = 1;
    DEFLATE = 2;
    BROTLI = 3;
  }
}

message SemVer {
  int32 major = 1;
  int32 minor = 2;
  string patch = 3;
  string prerelease = 4;
}

message Status {
  int32 code = 1;
  string message = 2;
}

service ContentAddressableStorage {
  rpc FindMissingBlobs(FindMissingBlobsRequest) returns (FindMissingBlobsResponse);
  rpc BatchUpdateBlobs(BatchUpdateBlobsRequest) returns (BatchUpdateBlobsResponse);
  rpc BatchReadBlobs(BatchReadBlobsRequest) returns (BatchReadBlobsResponse);
}

service ActionCache {
  rpc GetActionResult(GetActionResultRequest) returns (ActionResult);
  rpc UpdateActionResult(UpdateActionResultRequest) returns (ActionResult);
}

service Capabilities {
  rpc GetCapabilities(GetCapabilitiesRequest) returns (ServerCapabilities);
}
`;

export const BYTESTREAM_PROTO = `syntax = "proto3";

package google.bytestream;

message ReadRequest {
  string resource_name = 1;
  int64 read_offset = 2;
  int64 read_limit = 3;
}

message ReadResponse {
  bytes data = 10;
}

message WriteRequest {
  string resource_name = 1;
  int64 write_offset = 2;
  bool finish_write = 3;
  bytes data = 10;
}

message WriteResponse {
  int64 committed_size = 1;
}

service ByteStream {
  rpc Read(ReadRequest) returns (stream ReadResponse);
  rpc Write(stream WriteRequest) returns (WriteResponse);
}
`;
