# Svelte Example

This example demonstrates how to use `@visulima/storage-client` with SvelteKit.

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

- Svelte stores (`createUpload`, `createMultipartUpload`, `createTusUpload`)
- File upload with progress tracking
- Error handling
- Automatic method selection (multipart vs TUS)

## Notes

- Update the `endpointMultipart` and `endpointTus` in your components to point to your upload APIs
- The example uses Svelte stores for reactive state management
- Check the SvelteKit documentation for routing and API setup
