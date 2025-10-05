# Twitter Post for Visulima Upload Release

## Main Post (Thread Starter)
🚀 Exciting news! We're about to release @visulima/upload - the ultimate file upload library that makes handling uploads in modern web apps a breeze!

Key highlights:
• Framework-agnostic (works with Express, Hono, Next.js, Cloudflare Workers, Bun, Deno)
• Multiple storage backends (AWS S3, Azure, GCS, local filesystem)
• Built-in image processing (resize, crop, rotate)
• Multipart & TUS resumable uploads
• OpenAPI/Swagger documentation
• TypeScript first
• Web API compatible

Perfect for developers building file upload features across any stack! 🔥

#Visulima #FileUpload #TypeScript #WebDev

---

## Follow-up Posts (Thread)

### Post 2
What makes @visulima/upload special:

✅ Zero-config setup with sensible defaults
✅ Automatic image optimization and transformation
✅ Enterprise-grade security features
✅ Comprehensive test coverage
✅ Active maintenance and support

No more wrestling with upload libraries that only work in one framework!

### Post 3
Example usage with Hono (our favorite lightweight framework):

```typescript
import { Multipart, DiskStorage } from "@visulima/upload";

const storage = new DiskStorage({ directory: "./uploads" });
const multipart = new Multipart({ storage });

// That's it! Ready to handle uploads
```

Works the same way with Express, Fastify, or any Web API compatible framework.

### Post 4
Storage backends supported:
• AWS S3 (with presigned URLs)
• Google Cloud Storage
• Azure Blob Storage
• Vercel Blob
• Local filesystem

All with consistent APIs and automatic scaling capabilities.

### Post 5
Built for modern development:
• ESM & CommonJS support
• Tree-shakable imports
• Zero dependencies for core functionality
• Comprehensive TypeScript types
• Extensive documentation and examples

The release is coming very soon! Stay tuned for the full announcement. 🎉

#OpenSource #JavaScript #NodeJS
