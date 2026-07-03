# Express REST API Example with Google Cloud Storage

This example demonstrates how to use the REST handler for direct binary file uploads with Express.js and Google Cloud Storage.

## Features

- **Direct binary uploads** - Upload raw binary data without multipart encoding
- **Google Cloud Storage** - Files stored in GCS buckets
- **PUT support** - Create or update files with PUT method
- **Batch delete** - Delete multiple files in one request
- **RESTful API** - Clean REST interface for file operations

## Installation

```bash
cd examples/express-rest-gcs
pnpm install
```

## Configuration

Google Cloud Storage credentials are loaded from:

- Environment variable `GOOGLE_APPLICATION_CREDENTIALS` pointing to a service account key file
- Default credentials when running on Google Cloud (GCE, GKE, Cloud Run, etc.)

Set the following environment variable:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json
```

Or configure the bucket name in the code:

```typescript
const storage = new GCStorage({
    bucket: "your-bucket-name",
    maxUploadSize: "1GB",
});
```

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

## Google Cloud Storage Configuration

The example uses `GCStorage` with the following configuration:

```typescript
const storage = new GCStorage({
    maxUploadSize: "1GB",
    onComplete: (file) => {
        const { uri = "unknown", id } = file;
        console.log(`File upload complete, storage path: ${uri}`);
        return { id, link: uri };
    },
});
```

### Configuration Options

- `bucket` - GCS bucket name (optional, can be set via environment)
- `maxUploadSize` - Maximum file size (e.g., "1GB")
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
- You're using cloud storage like Google Cloud Storage

Use the Multipart handler when:

- Uploading from HTML forms
- You need traditional `multipart/form-data` support
- Working with web browsers and form submissions
