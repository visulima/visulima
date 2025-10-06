<div align="center">
  <h3>@visulima/upload-client</h3>
  <p>Client SDK for @visulima/upload - Upload files with resumable uploads and progress tracking</p>
</div>

<br />

<div align="center">

[![typescript-image]][typescript-url] [![npm-image]][npm-url] [![license-image]][license-url]

</div>

<div align="center">
  <sub>Built with ❤︎ by <a href="https://twitter.com/_prisis_">Daniel Bannert</a></sub>
</div>

## Features

- 🚀 **Resumable uploads** with Tus protocol support
- 📤 **Simple multipart uploads** for smaller files
- 📊 **Progress tracking** with speed and ETA calculations
- 🔄 **Auto-retry** with configurable backoff
- 🎯 **TypeScript** support with full type safety
- 🌐 **Browser and Node.js** compatible
- ⚡ **Zero dependencies** (except for @visulima/upload server)

## Installation

```sh
npm install @visulima/upload-client
```

```sh
yarn add @visulima/upload-client
```

```sh
pnpm add @visulima/upload-client
```

## Quick Start

```typescript
import { UploadClient } from "@visulima/upload-client";

// Create a client
const client = new UploadClient({
    baseUrl: "https://your-upload-server.com",
});

// Upload a file with automatic protocol selection
const upload = await client.upload({
    file: fileInput.files[0],
    onProgress: (progress) => {
        console.log(`${progress.percentage}% uploaded`);
    },
    onComplete: (result) => {
        console.log("Upload complete!", result.url);
    },
    onError: (error) => {
        console.error("Upload failed:", error.message);
    },
});

// Start the upload
await upload.start();
```

## Advanced Usage

### Tus Resumable Uploads

For large files, use Tus protocol for resumable uploads:

```typescript
import { TusClient } from "@visulima/upload-client";

const tusClient = new TusClient({
    baseUrl: "https://your-upload-server.com",
    chunkSize: 1024 * 1024, // 1MB chunks
});

const upload = await tusClient.createUpload({
    file: largeFile,
    onProgress: (progress) => {
        console.log(`Speed: ${progress.speed} B/s, ETA: ${progress.eta}s`);
    },
});

// Upload can be paused and resumed
await upload.start();
// Later...
await upload.pause();
// And resumed
await upload.start();
```

### Multipart Uploads

For smaller files or when Tus is not available:

```typescript
import { MultipartClient } from "@visulima/upload-client";

const multipartClient = new MultipartClient({
    baseUrl: "https://your-upload-server.com",
    maxFileSize: 100 * 1024 * 1024, // 100MB limit
});

const result = await multipartClient.upload({
    file: smallFile,
    metadata: {
        album: "My Photos",
        tags: ["vacation", "beach"],
    },
    formData: {
        userId: "123",
        private: true,
    },
});
```

### Resuming Uploads

```typescript
// Resume a Tus upload by URL
const resumedUpload = await client.resumeUpload(previousUploadUrl, {
    file: file,
    onProgress: (progress) => console.log(progress),
});

await resumedUpload.start();
```

### Custom Metadata

```typescript
const upload = await client.upload({
    file: file,
    metadata: {
        title: "My File",
        description: "A description",
        tags: ["tag1", "tag2"],
        customField: "custom value",
    },
});
```

### Error Handling

```typescript
try {
    const upload = await client.upload({
        file: file,
        onError: (error) => {
            console.error("Upload error:", error.message);
            // Handle specific error types
            if (error.code === "FILE_TOO_LARGE") {
                alert("File is too large");
            }
        },
    });

    await upload.start();
} catch (error) {
    console.error("Failed to create upload:", error);
}
```

### File Management

```typescript
// Delete an uploaded file
await client.delete(fileUrl);

// Get file metadata
const metadata = await client.getMetadata(fileUrl);
console.log(metadata);
```

## Configuration

### UploadClient Options

```typescript
const client = new UploadClient({
    baseUrl: "https://api.example.com", // Required
    headers: {
        Authorization: "Bearer token",
        "X-API-Key": "key",
    },
    timeout: 30000, // Request timeout in ms
    retries: 3, // Number of retries
    retryDelay: 1000, // Delay between retries in ms
    chunkSize: 1024 * 1024, // Chunk size for Tus uploads
    maxConcurrent: 3, // Max concurrent uploads
});
```

### TusClient Options

```typescript
const tusClient = new TusClient({
    ...baseConfig,
    version: "1.0.0", // Tus protocol version
    extensions: ["creation", "termination"], // Supported extensions
    checksumAlgorithms: ["md5", "sha1"], // Supported checksum algorithms
});
```

### MultipartClient Options

```typescript
const multipartClient = new MultipartClient({
    ...baseConfig,
    maxFileSize: 100 * 1024 * 1024, // Max file size in bytes
});
```

## API Reference

### UploadClient

#### `upload(options: UploadOptions): Promise<Upload>`

Upload a file with automatic protocol selection.

#### `resumeUpload(uploadUrl: string, options: UploadOptions): Promise<Upload>`

Resume an existing Tus upload.

#### `delete(fileUrl: string): Promise<void>`

Delete an uploaded file.

#### `getMetadata(fileUrl: string): Promise<any>`

Get metadata for an uploaded file.

#### `getServerCapabilities(): Promise<ServerCapabilities>`

Get server capabilities for both Tus and multipart uploads.

### TusClient

#### `createUpload(options: TusUploadOptions): Promise<TusUpload>`

Create a new Tus upload.

#### `resumeUpload(uploadUrl: string, options: TusUploadOptions): Promise<TusUpload>`

Resume an existing Tus upload.

#### `getServerCapabilities(endpoint?: string): Promise<TusCapabilities>`

Get Tus server capabilities.

### MultipartClient

#### `upload(options: MultipartUploadOptions): Promise<UploadResult>`

Upload a file using multipart/form-data.

#### `delete(fileUrl: string): Promise<void>`

Delete an uploaded file.

#### `getMetadata(fileUrl: string): Promise<any>`

Get metadata for an uploaded file.

## Browser Support

- Chrome 66+
- Firefox 60+
- Safari 12+
- Edge 79+

## Node.js Support

- Node.js 18+

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima upload client is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/upload-client?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md
[npm-image]: https://img.shields.io/npm/v/@visulima/upload-client/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/upload-client/v/latest "npm"
