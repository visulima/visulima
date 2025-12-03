# Pail Next.js Edge Runtime Example

This example demonstrates how to use Pail for logging in Next.js Edge Runtime API routes.

## Features

- **Edge Runtime**: API routes run on Vercel's Edge Network for global distribution and fast cold starts
- **Browser-Compatible**: Uses browser-compatible Pail reporters suitable for edge environments
- **Structured Logging**: Demonstrates different log levels and structured data logging
- **Interactive UI**: Web interface to test edge API logging functionality

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the development server:

```bash
npm run dev
```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Edge API Routes

The example includes an Edge API route at `/api/logger` that demonstrates:

- **GET requests**: Log messages with different levels (info, success, warn, error)
- **POST requests**: Log structured data objects
- **Edge runtime execution**: All logging happens in the Edge Runtime environment

### Client Interface

The main page provides buttons to:

- Test different log levels via GET requests
- Send structured data via POST requests
- View API responses

### Viewing Logs

Check your terminal/console where the Next.js dev server is running to see the Pail logs from the Edge API routes.

## Edge Runtime Considerations

When using Pail in Edge Runtime:

1. **Browser-Compatible Reporters**: Use reporters from `@visulima/pail/reporter` (browser exports)
2. **Limited File System**: Cannot write to local files (JsonFileReporter won't work in edge)
3. **Web Standards**: All APIs must be web-compatible
4. **Global Scope**: Edge functions run in a global, stateless environment

## API Examples

### Log a simple message

```bash
curl "http://localhost:3000/api/logger?message=Hello%20Edge&level=info"
```

### Log an error

```bash
curl "http://localhost:3000/api/logger?message=Something%20failed&level=error"
```

### Send structured data

```bash
curl -X POST http://localhost:3000/api/logger \
  -H "Content-Type: application/json" \
  -d '{"user":"test","action":"login","timestamp":"2024-01-01T00:00:00Z"}'
```

## Pail Configuration for Edge

```typescript
import { createPail } from "@visulima/pail";

// For Edge Runtime, use browser-compatible reporters
const edgeLogger = createPail({
    scope: "edge-api",
    reporters: [
        // Browser-compatible reporters only
    ],
});
```

## Deployment

Deploy to Vercel for true Edge Runtime execution:

```bash
npm run build
vercel --prod
```

The Edge API routes will run on Vercel's global Edge Network, providing fast response times worldwide.
