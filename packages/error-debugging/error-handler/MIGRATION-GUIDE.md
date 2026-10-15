# Migration Guide

This guide documents breaking changes and migration steps for the `@visulima/error-handler` package.

## Upgrading: Deno handler subpath removed

`@visulima/error-handler/handler/http/deno` is gone. It was an alias of the fetch handler, and it is the same module as the `edge` and `cloudflare` subpaths.

### Before

```ts
import { createErrorHandler } from "@visulima/error-handler/handler/http/deno";
```

### After

```ts
import { createErrorHandler } from "@visulima/error-handler/handler/http/edge";
```

`@visulima/error-handler/handler/http/cloudflare` resolves to the same file if you prefer that name. The handler and its options are unchanged. Deno itself is no longer a supported runtime.
