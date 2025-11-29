<div align="center">
  <h3>Visulima upload</h3>
  <p>Visulima upload copies files to a web-accessible location and provides a consistent way to get the URLs that correspond to those files.</p>
  <p>Visulima upload can also resize, crop and autorotate uploaded images.</p>
  <p>Visulima upload includes S3-based, Azure-based, GCS-based and local filesystem-based backends and you may supply others.</p>
</div>

<br />

<div align="center">

[![typescript-image]][typescript-url] [![npm-image]][npm-url] [![license-image]][license-url]

</div>

<div align="center">
  <sub>Built with ❤︎ by <a href="https://twitter.com/_prisis_">Daniel Bannert</a></sub>
</div>

## Features

- **Multiple Upload Handlers**: Multipart (form-based), REST (direct binary), and TUS (resumable) uploads
- **Chunked Uploads**: REST handler supports client-side chunked uploads for large files
- **Automatic Retry**: Built-in retry mechanism with exponential backoff for all storage backends (S3, Azure, GCS, Vercel Blob, Netlify Blob)
- Parent directories are created automatically as needed (like S3 and Azure)
- Content types are inferred from file extensions (like the filesystem)
- Files are by default marked as readable via the web (like a filesystem + web server)
- Images can be automatically scaled to multiple sizes
- Images can be cropped
- Images are automatically rotated if necessary for proper display on the web (i.e. iPhone photos with rotation hints are right side up)
- Image width, image height and correct file extension are made available to the developer
- Non-image files are also supported
- Web access to files can be disabled and reenabled
- GIF is supported, including animation, with full support for scaling and cropping
- Batch operations: Delete multiple files in a single request
- On fire about minimizing file sizes for your resized images? You can plug in `imagemin` and compatible tools using the `postprocessors` option.

## Installation

```sh
npm install @visulima/upload
```

```sh
yarn add @visulima/upload
```

```sh
pnpm add @visulima/upload
```

## Install requirements peer storage

### AWS S3

```sh
npm install @aws-sdk/client-s3 @aws-sdk/credential-providers @aws-sdk/s3-request-presigner @aws-sdk/signature-v4-crt aws-crt @aws-sdk/types
```

```sh
yarn add @aws-sdk/client-s3 @aws-sdk/credential-providers @aws-sdk/s3-request-presigner @aws-sdk/signature-v4-crt aws-crt @aws-sdk/types
```

```sh
pnpm add @aws-sdk/client-s3 @aws-sdk/credential-providers @aws-sdk/s3-request-presigner @aws-sdk/signature-v4-crt aws-crt @aws-sdk/types
```

### Azure Blob Storage

```sh
npm install @azure/storage-blob
```

```sh
yarn add @azure/storage-blob
```

```sh
pnpm add @azure/storage-blob
```

> Note: If you hit this error: "TypeError: Expected signal to be an instanceof AbortSignal" [#784](https://github.com/node-fetch/node-fetch/issues/784) you need to install node-fetch 4.0.0-beta or higher.

### Google Cloud Storage

```sh
npm install @google-cloud/storage node-fetch gaxios
```

```sh
yarn add @google-cloud/storage node-fetch gaxios
```

```sh
pnpm add @google-cloud/storage node-fetch gaxios
```

## Caching

The storage package supports caching to improve performance and reduce API calls. You provide your own cache implementation that follows the simple `Cache` interface.

### LRU Cache

Use the built-in LRU cache for simple in-memory caching:

```typescript
import { LRUCache } from "lru-cache";
import { DiskStorage } from "@visulima/storage";

const cache = new LRUCache({
    max: 1000, // Maximum number of items
    ttl: 3600000, // 1 hour in milliseconds
});

const storage = new DiskStorage({
    directory: "/uploads",
    cache,
});
```

### Custom Cache Implementation

Implement the `Cache` interface for any cache provider:

```typescript
import { DiskStorage, type Cache } from "@visulima/storage";
import { Redis } from "ioredis";

// Custom Redis cache implementation
class RedisCache implements Cache<string, any> {
    constructor(private redis: Redis) {}

    async get(key: string): Promise<any | undefined> {
        const value = await this.redis.get(key);
        return value ? JSON.parse(value) : undefined;
    }

    async set(key: string, value: any): Promise<boolean> {
        await this.redis.set(key, JSON.stringify(value));
        return true;
    }

    async delete(key: string): Promise<boolean> {
        await this.redis.del(key);
        return true;
    }

    async clear(): Promise<void> {
        await this.redis.flushall();
    }

    async has(key: string): Promise<boolean> {
        const exists = await this.redis.exists(key);
        return exists === 1;
    }
}

const redis = new Redis();
const cache = new RedisCache(redis);

const storage = new DiskStorage({
    directory: "/uploads",
    cache,
});
```

### BentoCache Integration

For advanced multi-tier caching, use BentoCache with the adapter:

```typescript
import { BentoCache, bentostore } from "bentocache";
import { memoryDriver } from "bentocache/drivers/memory";
import { redisDriver } from "bentocache/drivers/redis";
import { BentoCacheAdapter } from "@visulima/storage/utils/cache";

const bento = new BentoCache({
    default: "storage",
    stores: {
        storage: bentostore()
            .useL1Layer(memoryDriver({ maxSize: "10mb" }))
            .useL2Layer(
                redisDriver({
                    connection: { host: "127.0.0.1", port: 6379 },
                }),
            ),
    },
});

const cache = new BentoCacheAdapter({
    bento,
    namespace: "storage",
    defaultTtl: 3600000, // 1 hour
});

const storage = new DiskStorage({
    directory: "/uploads",
    cache,
});
```

### Transformer Caching

```typescript
import { MediaTransformer } from "@visulima/upload/transformer";
import ImageTransformer from "@visulima/upload/transformer/image";
import VideoTransformer from "@visulima/upload/transformer/video";
import { LRUCache } from "lru-cache";

const transformer = new MediaTransformer(storage, {
    cache: new LRUCache({ max: 100, ttl: 3600000 }),
    ImageTransformer: ImageTransformer,
    VideoTransformer: VideoTransformer,
});
```

### Cache Interface

Any cache implementation must implement this interface:

```typescript
interface Cache<K = string, V = any> {
    get(key: K): V | undefined | Promise<V | undefined>;
    set(key: K, value: V, options?: { ttl?: number }): boolean | Promise<boolean>;
    delete(key: K): boolean | Promise<boolean>;
    clear(): void | Promise<void>;
    has(key: K): boolean | Promise<boolean>;
}
```

For more information, see the [BentoCache documentation](https://bentocache.dev/docs/introduction).

## Retry Mechanism

All storage backends (AWS S3, Azure, GCS, Vercel Blob, Netlify Blob) include automatic retry logic for transient failures. This ensures your uploads and file operations are resilient to network issues, rate limits, and temporary service unavailability.

### Default Behavior

By default, storage operations will retry up to 3 times with exponential backoff:

- Initial delay: 1 second
- Backoff multiplier: 2x (delays double each retry: 1s → 2s → 4s)
- Maximum delay: 30 seconds
- Retryable status codes: 408, 429, 500, 502, 503, 504

### Basic Configuration

Configure retry behavior when creating your storage instance:

```typescript
import { S3Storage } from "@visulima/storage";

const storage = new S3Storage({
    bucket: "my-bucket",
    region: "us-east-1",
    retryConfig: {
        maxRetries: 5,
        initialDelay: 2000,
        backoffMultiplier: 1.5,
        maxDelay: 60_000,
    },
});
```

### Advanced Configuration

Customize retry logic with backend-specific error detection:

```typescript
import { AzureStorage } from "@visulima/storage";

const storage = new AzureStorage({
    containerName: "uploads",
    accountName: "myaccount",
    accountKey: "mykey",
    retryConfig: {
        maxRetries: 3,
        initialDelay: 1000,
        backoffMultiplier: 2,
        maxDelay: 30_000,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504],
        shouldRetry: (error: unknown) => {
            // Custom retry logic
            if (error instanceof Error) {
                const errorCode = (error as any).code;

                // Retry on network errors
                if (errorCode === "ECONNRESET" || errorCode === "ETIMEDOUT") {
                    return true;
                }
            }

            // Retry on specific HTTP status codes
            if ((error as any).statusCode && [429, 503].includes((error as any).statusCode)) {
                return true;
            }

            return false;
        },
    },
});
```

### Retry Configuration Options

```typescript
interface RetryConfig {
    /** Maximum number of retry attempts (default: 3) */
    maxRetries?: number;

    /** Initial delay in milliseconds before first retry (default: 1000) */
    initialDelay?: number;

    /** Multiplier for exponential backoff (default: 2) */
    backoffMultiplier?: number;

    /** Maximum delay in milliseconds between retries (default: 30000) */
    maxDelay?: number;

    /** HTTP status codes that should trigger a retry (default: [408, 429, 500, 502, 503, 504]) */
    retryableStatusCodes?: number[];

    /** Custom function to determine if an error should be retried */
    shouldRetry?: (error: unknown) => boolean;

    /** Custom function to calculate delay for a specific retry attempt */
    calculateDelay?: (attempt: number, error: unknown) => number | undefined;
}
```

### Using Retry Utilities Directly

You can also use the retry utilities for custom operations:

```typescript
import { retry, createRetryWrapper, isRetryableError } from "@visulima/storage";

// One-off retry
const result = await retry(
    async () => {
        // Your operation here
        return await someOperation();
    },
    {
        maxRetries: 3,
        initialDelay: 1000,
    },
);

// Create a reusable retry wrapper
const retryWrapper = createRetryWrapper({
    maxRetries: 5,
    initialDelay: 2000,
});

const result = await retryWrapper(async () => {
    return await someOperation();
});

// Check if an error is retryable
if (isRetryableError(error)) {
    // Handle retryable error
}
```

### Supported Error Types

The retry mechanism automatically handles:

- **Network errors**: `ECONNRESET`, `ETIMEDOUT`, `ENOTFOUND`, `ECONNREFUSED`, `EAI_AGAIN`
- **AWS SDK errors**: Server faults, retryable status codes, SDK v2/v3 error formats
- **Azure Storage errors**: HTTP status codes, network connection issues
- **HTTP errors**: 408 (Request Timeout), 429 (Too Many Requests), 5xx (Server Errors)

### Examples by Storage Backend

#### AWS S3

```typescript
import { S3Storage } from "@visulima/storage";

const storage = new S3Storage({
    bucket: "my-bucket",
    region: "us-east-1",
    retryConfig: {
        maxRetries: 3,
        // AWS SDK errors are automatically detected
    },
});
```

#### Azure Blob Storage

```typescript
import { AzureStorage } from "@visulima/storage";

const storage = new AzureStorage({
    containerName: "uploads",
    accountName: "myaccount",
    accountKey: "mykey",
    retryConfig: {
        maxRetries: 5,
        initialDelay: 2000,
    },
});
```

#### Google Cloud Storage

GCS already has built-in retry support via `gaxios`. The retry mechanism works alongside GCS's native retry logic:

```typescript
import { GCStorage } from "@visulima/storage";

const storage = new GCStorage({
    bucket: "my-bucket",
    projectId: "my-project",
    retryConfig: {
        maxRetries: 3,
        // Works with GCS's existing retryOptions
    },
});
```

#### Vercel Blob

```typescript
import { VercelBlobStorage } from "@visulima/storage";

const storage = new VercelBlobStorage({
    token: process.env.BLOB_READ_WRITE_TOKEN,
    retryConfig: {
        maxRetries: 3,
        retryableStatusCodes: [408, 429, 500, 502, 503, 504],
    },
});
```

#### Netlify Blob

```typescript
import { NetlifyBlobStorage } from "@visulima/storage";

const storage = new NetlifyBlobStorage({
    storeName: "uploads",
    retryConfig: {
        maxRetries: 3,
    },
});
```

## Chunked Uploads

The REST handler supports client-side chunked uploads for large files. This allows you to upload files in smaller pieces, reducing memory usage and enabling resumable uploads.

### Initializing a Chunked Upload

```typescript
import { Rest } from "@visulima/upload/handler/rest";

const rest = new Rest({ storage });

// Initialize chunked upload
const initResponse = await fetch("/files", {
    method: "POST",
    headers: {
        "X-Chunked-Upload": "true",
        "X-Total-Size": "10485760", // Total file size in bytes
        "Content-Length": "0",
        "Content-Type": "application/octet-stream",
    },
});

const { id } = await initResponse.json();
// id is the upload session ID
```

### Uploading Chunks

```typescript
// Upload chunk 1 (bytes 0-524288)
await fetch(`/files/${id}`, {
    method: "PATCH",
    headers: {
        "X-Chunk-Offset": "0",
        "Content-Length": "524288",
        "Content-Type": "application/octet-stream",
    },
    body: chunk1,
});

// Upload chunk 2 (bytes 524288-1048576) - can be out of order
await fetch(`/files/${id}`, {
    method: "PATCH",
    headers: {
        "X-Chunk-Offset": "524288",
        "Content-Length": "524288",
        "Content-Type": "application/octet-stream",
    },
    body: chunk2,
});
```

### Checking Upload Progress

```typescript
// Check upload status
const statusResponse = await fetch(`/files/${id}`, {
    method: "HEAD",
});

const offset = statusResponse.headers.get("X-Upload-Offset");
const complete = statusResponse.headers.get("X-Upload-Complete");
const chunks = JSON.parse(statusResponse.headers.get("X-Received-Chunks") || "[]");

console.log(`Uploaded: ${offset} bytes, Complete: ${complete}`);
```

### Features

- **Out-of-Order Chunks**: Chunks can be uploaded in any order
- **Idempotency**: Duplicate chunks are safely ignored
- **Resumable**: Check progress and resume from last uploaded chunk
- **Progress Tracking**: Real-time upload progress via HEAD requests
- **Chunk Size Limits**: Maximum 100MB per chunk (configurable)

### Response Headers

- `X-Upload-ID`: Upload session ID (returned on initialization)
- `X-Chunked-Upload`: Indicates chunked upload mode
- `X-Upload-Offset`: Current upload offset in bytes
- `X-Upload-Complete`: "true" when upload is complete, "false" otherwise
- `X-Received-Chunks`: JSON array of received chunks `[{ offset, length }]`

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track
[Node.js’ release schedule](https://github.com/nodejs/release#release-schedule). Here’s [a
post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima uploads is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/upload?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/upload/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/upload/v/latest "npm"
