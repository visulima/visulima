# Next.js Example

This example demonstrates how to use `@visulima/storage-client` with Next.js 15 (App Router).

## Setup

```bash
pnpm install
```

## Run

```bash
pnpm dev
```

Visit [http://localhost:3000](http://localhost:3000)

## Features

- React hooks (`useUpload`, `useMultipartUpload`, `useTusUpload`)
- Client-side upload component
- Progress tracking
- Error handling

## Notes

- This example uses the App Router (Next.js 13+)
- Upload components are marked with `"use client"` directive
- Update the `endpointMultipart` and `endpointTus` in `app/page.tsx` to point to your upload APIs
