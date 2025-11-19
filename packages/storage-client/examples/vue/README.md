# Vue Example

This example demonstrates how to use `@visulima/storage-client` with Vue 3 and Vite.

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

- Vue composables (`useUpload`, `useMultipartUpload`, `useTusUpload`)
- File upload with progress tracking
- Error handling
- Automatic method selection (multipart vs TUS)

## Notes

- Update the `endpoint` in `src/App.vue` to point to your upload API
- The example uses `method: "auto"` which automatically selects between multipart and TUS based on file size
