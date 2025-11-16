# Express REST API Example with Azure Blob Storage

This example demonstrates how to use the REST handler for direct binary file uploads with Express.js and Azure Blob Storage.

## Features

- **Direct binary uploads** - Upload raw binary data without multipart encoding
- **Azure Blob Storage** - Files stored in Azure Storage containers
- **PUT support** - Create or update files with PUT method
- **Batch delete** - Delete multiple files in one request
- **RESTful API** - Clean REST interface for file operations

## Installation

```bash
cd examples/express-rest-azure
pnpm install
```

## Configuration

Update the Azure Storage configuration in `index.ts`:

```typescript
const storage = new AzureStorage({
    containerName: "upload",
    accountName: "your-account-name",
    accountKey: "your-account-key",
    maxUploadSize: "1GB",
});
```

Or use environment variables:

```bash
export AZURE_STORAGE_ACCOUNT_NAME=your-account-name
export AZURE_STORAGE_ACCOUNT_KEY=your-account-key
export AZURE_STORAGE_CONTAINER_NAME=upload
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

## Azure Storage Configuration

The example uses `AzureStorage` with the following configuration:

```typescript
const storage = new AzureStorage({
    containerName: "upload",
    accountName: "your-account-name",
    accountKey: "your-account-key",
    maxUploadSize: "1GB",
    onComplete: (file) => {
        const { uri = "unknown", id } = file;
        console.log(`File upload complete, storage path: ${uri}`);
        return { id, link: uri };
    },
});
```

### Configuration Options

- `containerName` - Azure Storage container name (required)
- `accountName` - Azure Storage account name (required)
- `accountKey` - Azure Storage account key (required)
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
- You're using cloud storage like Azure Blob Storage

Use the Multipart handler when:

- Uploading from HTML forms
- You need traditional `multipart/form-data` support
- Working with web browsers and form submissions

