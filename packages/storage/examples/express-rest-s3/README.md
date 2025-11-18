# Express REST API Example with AWS S3

This example demonstrates how to use the REST handler for direct binary file uploads with Express.js and AWS S3 storage.

## Features

- **Direct binary uploads** - Upload raw binary data without multipart encoding
- **AWS S3 Storage** - Files stored in AWS S3 buckets
- **PUT support** - Create or update files with PUT method
- **Batch delete** - Delete multiple files in one request
- **RESTful API** - Clean REST interface for file operations
- **Expiration support** - Automatic file expiration and cleanup

## Installation

```bash
cd examples/express-rest-s3
pnpm install
```

## Configuration

Set the following environment variables:

```bash
export S3_BUCKET=your-bucket-name
export S3_ENDPOINT=https://s3.amazonaws.com  # Optional, for custom endpoints
```

AWS credentials are loaded from:

- Environment variables (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`)
- Shared credentials file (`~/.aws/credentials`)
- IAM role (when running on EC2/ECS/Lambda)

## Usage

```bash
pnpm run dev
```

The server will start on `http://localhost:3003`.

## Endpoints

- `POST /files` - Upload file with raw binary data
- `PUT /files/:id` - Create or update file (requires ID in URL)
- `GET /files` - List all files
- `GET /files/:id` - Download file
- `HEAD /files/:id` - Get file metadata
- `DELETE /files/:id` - Delete single file
- `DELETE /files?ids=id1,id2,id3` - Batch delete multiple files

## Example Usage

### Upload a file

```bash
curl -X POST http://localhost:3003/files \
  -H "Content-Type: image/jpeg" \
  -H "Content-Disposition: attachment; filename=\"photo.jpg\"" \
  -H "X-File-Metadata: {\"description\":\"My photo\"}" \
  --data-binary @/path/to/your/file.jpg
```

### Create or update a file with PUT

```bash
curl -X PUT http://localhost:3003/files/your-file-id \
  -H "Content-Type: image/png" \
  --data-binary @/path/to/your/file.png
```

### List all files

```bash
curl http://localhost:3003/files
```

### Download a file

```bash
curl http://localhost:3003/files/your-file-id -o downloaded.jpg
```

### Get file metadata

```bash
curl -X HEAD http://localhost:3003/files/your-file-id -v
```

### Delete a single file

```bash
curl -X DELETE http://localhost:3003/files/your-file-id
```

### Batch delete multiple files

```bash
# Via query parameter
curl -X DELETE "http://localhost:3003/files?ids=id1,id2,id3"

# Via JSON body
curl -X DELETE http://localhost:3003/files \
  -H "Content-Type: application/json" \
  -d '{"ids": ["id1", "id2", "id3"]}'
```

## Headers

### Upload Headers

- `Content-Type` - MIME type of the file (e.g., `image/jpeg`, `application/pdf`)
- `Content-Length` - Size of the file in bytes (required)
- `Content-Disposition` - Optional filename (e.g., `attachment; filename="photo.jpg"`)
- `X-File-Metadata` - Optional JSON metadata (e.g., `{"description":"My photo"}`)

### Response Headers

- `Location` - URL of the uploaded file
- `X-Upload-Expires` - Expiration timestamp (if applicable)
- `ETag` - Entity tag for caching

## S3 Storage Configuration

The example uses `S3Storage` with the following configuration:

```typescript
const storage = new S3Storage({
    bucket: process.env.S3_BUCKET,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    expiration: { maxAge: "1h", purgeInterval: "15min" },
    onComplete: (file) => console.log("File upload complete: ", file),
});
```

### Configuration Options

- `bucket` - S3 bucket name (required)
- `endpoint` - Custom S3 endpoint (optional, for S3-compatible services)
- `forcePathStyle` - Use path-style URLs instead of virtual-hosted-style
- `expiration` - Automatic file expiration and cleanup
- `onComplete` - Callback when file upload completes

## Differences from Multipart Handler

- **No multipart encoding** - Upload raw binary data directly
- **PUT support** - Create or update files with PUT method
- **Batch delete** - Delete multiple files in one request
- **Simpler API** - Clean REST interface without form encoding overhead

## When to Use REST Handler

Use the REST handler when:

- Building API-first applications
- Uploading files programmatically (not from HTML forms)
- You need PUT support for create/update operations
- You want direct binary uploads without multipart encoding
- You need batch delete operations
- You're using cloud storage like S3

Use the Multipart handler when:

- Uploading from HTML forms
- You need traditional `multipart/form-data` support
- Working with web browsers and form submissions

