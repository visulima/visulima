# React Example

This example demonstrates how to use `@visulima/storage-client` with React and Vite.

## Setup

```bash
pnpm install
```

## Run

```bash
pnpm dev
```

Visit [http://localhost:5173](http://localhost:5173)

## Features

- React hooks (`useUpload`, `useMultipartUpload`, `useTusUpload`)
- File upload with progress tracking
- Error handling
- Automatic method selection (multipart vs TUS)

## Notes

- Update the `endpointMultipart` and `endpointTus` in `src/App.tsx` to point to your upload APIs
- The example automatically selects between multipart and TUS based on file size when both endpoints are provided
