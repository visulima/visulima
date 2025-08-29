<div align="center">
  <h3>Visulima flame</h3>
  <p>
  A modern, delightful error overlay and inspector for Node.js servers and dev tooling.
  </p>
</div>

<br />

<div align="center">

[![typescript-image]][typescript-url] [![npm-image]][npm-url] [![license-image]][license-url]

</div>

---

<div align="center">
    <p>
        <sup>
            Daniel Bannert's open source work is supported by the community on <a href="https://github.com/sponsors/prisis">GitHub Sponsors</a>
        </sup>
    </p>
</div>

---

## Install

```sh
pnpm add @visulima/flame
```

```sh
npm i @visulima/flame
```

```sh
yarn add @visulima/flame
```

## Features

- Pretty, theme‑aware error page
    - Sticky header (shows error name/message while scrolling)
    - One‑click copy for error title (icon feedback)
- Stack trace viewer
    - Shiki‑powered syntax highlighting (singleton highlighter)
    - Tabs for frames; grouping for internal/node_modules/application frames
    - Tooltips and labels to guide usage
    - Optional “Open in editor” button per frame
- Error causes viewer (nested causes, each with its own viewer)
- Solutions panel
    - Default open; smooth expand/collapse without layout jump
    - Animated height/opacity; icon toggles open/close
    - Built-in rule-based Markdown hints for common issues (ESM/CJS interop, export mismatch, port in use, missing files/case, TS path mapping, DNS/connection, React hydration mismatch, undefined property access)
- Raw stack trace panel
- Theme toggle (auto/dark/light) with persistence
- **Copy to Clipboard** - One-click copying for all data sections
- **Responsive Design** - Sticky sidebar navigation with smooth scrolling
- Consistent tooltips (one global script; components only output HTML)

**New in latest version:**

- **Tabbed Interface** - Switch between Stack and Context views
- **Request Context Panel** - Detailed HTTP request debugging information
    - cURL command with proper formatting and copy functionality
    - Headers, cookies, body, and session data
    - App routing, client info, Git status, and version details
    - Smart data sanitization and masking for sensitive information
    - **Flexible Context API** - Add any custom context data via `buildContextPage()`

Accessibility and keyboard UX

- ARIA-correct tabs and panels for stack frames; improved labeling
- Focus trap within the overlay; restores focus on close
- Keyboard shortcuts help dialog (press Shift+/ or “?” button)
- Buttons/controls are keyboard-activatable (Enter/Space)

Editor integration

- Editor selector is always visible; selection persists (localStorage)
- Uses server endpoint when configured; otherwise opens via editor URL scheme (defaults to VS Code)

## Quick start (HTTP server)

Use the built-in displayer to render the error page and respond to the request. Optionally add an endpoint to open files in your editor.

```ts
import { createServer } from "node:http";
import httpDisplayer from "@visulima/flame/displayer/http";
import { createNodeHttpHandler } from "@visulima/flame/server/open-in-editor";

const openInEditor = createNodeHttpHandler({ projectRoot: process.cwd() });

const server = createServer(async (req, res) => {
    if (req.url?.startsWith("/__open-in-editor")) return openInEditor(req, res);

    try {
        // your app logic …
        throw new Error("Boom");
    } catch (err) {
        const handler = await httpDisplayer(err as Error, [], {
            // show editor selector and enable "Open in editor" buttons
            openInEditorUrl: "/__open-in-editor",
            // optional: set initial theme or editor preference
            // theme: 'dark',
            // editor: 'vscode',
        });
        return handler(req, res);
    }
});

server.listen(3000);
```

### Express setup

```ts
import express from "express";
import httpDisplayer from "@visulima/flame/displayer/http";
import { createExpressHandler } from "@visulima/flame/server/open-in-editor";

const app = express();
app.use(express.json());
app.post("/__open-in-editor", createExpressHandler({ projectRoot: process.cwd() }));

app.get("/", async (req, res) => {
    try {
        throw new Error("Example");
    } catch (err) {
        const handler = await httpDisplayer(err as Error, [], { openInEditorUrl: "/__open-in-editor" });
        return handler(req, res);
    }
});

app.listen(3000);
```

### Runtime handlers (direct)

Use dedicated handlers when you want to plug flame into your framework's native error hooks.

#### Node/Express-like (Express, Connect, Fastify, Koa)

```ts
// Express / Connect
import httpHandler from "@visulima/flame/handler/http/node";

app.use(async (err, req, res, _next) => {
    const handler = await httpHandler(err, [], { showTrace: process.env.NODE_ENV !== "production" });
    await handler(req, res);
});
```

```ts
// Fastify
import httpHandler from "@visulima/flame/handler/http/node";

fastify.setErrorHandler(async (err, request, reply) => {
    const handler = await httpHandler(err, [], { showTrace: true });
    await handler(request.raw, reply.raw);
});
```

```ts
// Koa
import httpHandler from "@visulima/flame/handler/http/node";

app.use(async (ctx, next) => {
    try {
        await next();
    } catch (err) {
        const handler = await httpHandler(err as Error, [], { showTrace: true });
        await handler(ctx.req, ctx.res);
        ctx.respond = false;
    }
});
```

#### Hono (Fetch runtime)

```ts
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import fetchHandler from "@visulima/flame/handler/http/hono";

const app = new Hono();

app.get("/", (c) => c.text("OK"));
app.get("/error", () => {
    throw new Error("Boom from Hono");
});

app.onError(async (err, c) => {
    const handler = await fetchHandler(err as Error, [], { showTrace: true });
    return handler(c.req.raw);
});

serve({ fetch: app.fetch, port: 3000 });
```

#### Fetch-based runtimes (Cloudflare/Deno/Bun/Edge)

```ts
// Cloudflare Workers
import fetchHandler from "@visulima/flame/handler/http/cloudflare";

export default {
    async fetch(request: Request, _env: unknown, _ctx: ExecutionContext): Promise<Response> {
        try {
            throw new Error("Boom");
        } catch (err) {
            const handler = await fetchHandler(err as Error, [], { showTrace: true });
            return handler(request);
        }
    },
};
```

```ts
// Deno (std/serve)
import fetchHandler from "@visulima/flame/handler/http/deno";

Deno.serve(async (request: Request) => {
    try {
        throw new Error("Boom");
    } catch (err) {
        const handler = await fetchHandler(err as Error, [], { showTrace: true });
        return handler(request);
    }
});
```

```ts
// Bun
import fetchHandler from "@visulima/flame/handler/http/bun";

Bun.serve({
    async fetch(request) {
        try {
            throw new Error("Boom");
        } catch (err) {
            const handler = await fetchHandler(err as Error, [], { showTrace: true });
            return handler(request);
        }
    },
    port: 3000,
});
```

### Using the HTML displayer directly (advanced)

If you don’t need the full displayer and want to mount just the HTML error handler, use `htmlErrorHandler`.

```ts
import { createServer } from "node:http";
import { htmlErrorHandler } from "@visulima/flame";

const server = createServer(async (req, res) => {
    try {
        throw new Error("Boom");
    } catch (error) {
        const html = htmlErrorHandler([], {
            // Enable "Open in editor" buttons
            openInEditorUrl: "/__open-in-editor",
            // Attach request context (improves the Context tab)
            context: {
                request: {
                    method: req.method,
                    url: req.url,
                    status: 500,
                    headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v : (v ?? "")])),
                },
            },
            // Control when to render the rich inspector (true | false | "auto")
            // auto => show when NODE_ENV !== 'production' or DEBUG is set
            debug: "auto",
            // Optional production fallback page (string or async function)
            // errorPage: ({ error, statusCode }) => `<h1>${statusCode}</h1><p>${error.message}</p>`,
        });

        await html(error as Error, req, res);
    }
});
```

Optional: content negotiation (serve Problem JSON, JSON:API, or HTML based on `Accept` header):

```ts
import { createServer } from "node:http";
import { htmlErrorHandler, problemErrorHandler, createNegotiatedErrorHandler } from "@visulima/flame";

const html = htmlErrorHandler([], { openInEditorUrl: "/__open-in-editor" });
const negotiated = createNegotiatedErrorHandler([], process.env.NODE_ENV !== "production", html);

createServer(async (req, res) => {
    try {
        throw new Error("Boom");
    } catch (error) {
        await negotiated(error, req, res);
    }
}).listen(3000);
```

## API

### httpDisplayer(error, solutionFinders?, options?) => Promise<(req, res) => Promise<void>>

- **error**: Error
- **solutionFinders**: SolutionFinder[] (optional)
- **options**:
    - `openInEditorUrl?: string` — when provided, “Open in editor” posts to this endpoint (JSON: `{ file, line, column, editor? }`). When omitted, flame uses a client-side editor URL scheme fallback to open files (defaults to VS Code).
    - `context?: Record<string, unknown> & { request?: RequestContext }` — optional context information for the Request panel and debugging. You can add any custom context data as key-value pairs.
        - `request?: { method, url, status?, route?, timings?, headers?, body?, cookies?, session? }` — HTTP request information (special key)
        - Any other keys will be automatically rendered as sections in the Context tab (e.g., `app`, `user`, `git`, `versions`, `database`, `cache`, etc.)
    - `requestPanel?: { headerAllowlist?: string[]; headerDenylist?: string[]; totalCapBytes?: number; previewBytes?: number; maskValue?: string; }` — control masking/truncation for the Request panel.
    - `content?: Array<{ id: string; name: string; defaultSelected?: boolean; code: { html: string; script?: string } }>` — supply extra pages as tabs. Flame always renders the "Stack" page; additional pages render after it. **Note:** Use `buildContextPage()` to create a Context tab with your context data.

Example (Node http) with enhanced Context:

```ts
const ctx = {
    method: req.method,
    url: req.url,
    status: res.statusCode,
    headers: Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v : (v ?? "")])),
    timings: { start: startTime, end: Date.now(), elapsedMs: Date.now() - startTime },
    body: safeBodyPreview,
    cookies: parseCookies(req.headers.cookie),
    session: { demo: true },
};

const handler = await httpDisplayer(err, [], {
    openInEditorUrl: "/__open-in-editor",
    context: {
        request: ctx,
        app: { routing: { route: req.url, params: {}, query: {} } },
        user: { client: { ip: req.socket.remoteAddress, userAgent: req.headers["user-agent"] } },
        git: { branch: "main", commit: "abc123", dirty: false },
        versions: { node: process.version, flame: "1.0.0" },
        // Add any custom context you want
        database: {
            connection: "active",
            queries: ["SELECT * FROM users", "INSERT INTO logs"],
            pools: {
                read: { active: 5, idle: 3, max: 10 },
                write: { active: 2, idle: 1, max: 5 },
            },
            metrics: {
                queries: { total: 1250, slow: 23, errors: 2 },
                connections: { current: 8, peak: 12 },
            },
        },
        cache: {
            status: "healthy",
            keys: 1250,
            memory: "45MB",
            layers: {
                l1: { type: "memory", hitRate: 0.95, size: "10MB" },
                l2: { type: "redis", hitRate: 0.87, size: "100MB" },
            },
            patterns: ["user:*", "session:*", "api:*"],
        },
        environment: {
            NODE_ENV: process.env.NODE_ENV,
            PORT: process.env.PORT,
            features: {
                auth: true,
                caching: true,
                monitoring: false,
            },
        },
    },
    requestPanel: { headerAllowlist: ["content-type", "accept", "user-agent"] },
});
```

    - `editor?: Editor` — initial editor selection (persisted). Affects both server opener and client-side fallback.
        - `theme?: 'dark' | 'light'` — initial theme; users can toggle.

Returns an async request handler compatible with Node http (and usable inside Express routes).

### Request Context Panel

Use `buildContextPage()` to create a "Context" tab with comprehensive debugging information:

- **Request Overview** - cURL command with proper formatting and copy functionality
- **Headers** - HTTP headers with smart masking for sensitive data
- **Body** - Request body content with proper formatting
- **Session** - Session data in organized key-value tables
- **Cookies** - Cookie information in readable format
- **Dynamic Context Sections** - Any additional context keys you provide are automatically rendered as sections with:
    - Proper titles (capitalized)
    - Copy buttons for JSON data
    - Organized key-value tables
    - Sticky sidebar navigation

**Built-in sections** (when data is provided):

- `app` - Application routing details (route, params, query)
- `user` - Client information (IP, User-Agent, geo)
- `git` - Repository status (branch, commit, tag, dirty state)
- `versions` - Package versions and dependencies

**Custom sections** - Add any context data you want:

- `database` - Database connection info, queries, etc.
- `cache` - Cache status and keys
- `environment` - Environment variables
- `performance` - Performance metrics
- And more!

**Deep Object & Array Support** - The context panel intelligently renders:

- Nested objects with proper indentation and visual hierarchy
- Arrays with indexed items and collapsible structure
- Complex data types (strings, numbers, booleans, null, undefined)
- Performance-optimized rendering with depth limits (max 3 levels)
- Smart truncation for large datasets (shows first 10 items/keys)

All sections include copy buttons for easy data extraction and debugging.

### Copy to Clipboard

All data sections in the Request Context Panel include copy buttons that:

- Copy data in JSON format for easy debugging
- Provide visual feedback (button changes to "Copied!" with green styling)
- Support both modern `navigator.clipboard` API and fallback methods
- Work across all browsers and environments

### buildContextPage(request, options) => Promise<ContentPage | undefined>

Creates a Context tab with comprehensive debugging information. Pass any context data you want to display:

```ts
import { buildContextPage } from "@visulima/flame/template";

const contextPage = await buildContextPage(requestData, {
    context: {
        request: requestData,
        app: { routing: { route: "/api/users", params: {}, query: {} } },
        user: { client: { ip: "127.0.0.1", userAgent: "Mozilla/5.0..." } },
        database: { connection: "active", queries: ["SELECT * FROM users"] },
        cache: { status: "healthy", keys: 1250 },
        environment: { NODE_ENV: "production" },
        // Add any custom context you want
    },
    requestPanel: { headerAllowlist: ["content-type", "accept"] },
});
```

### Adding custom pages/tabs via `options.content`

You can add any number of custom pages, including the built-in Context page:

```ts
import { buildContextPage } from "@visulima/flame/template";

// Create a context page with your data
const contextPage = await buildContextPage(requestData, {
    context: {
        request: requestData,
        app: { routing: { route: "/api/users", params: {}, query: {} } },
        user: { client: { ip: "127.0.0.1", userAgent: "Mozilla/5.0..." } },
        database: { connection: "active", queries: ["SELECT * FROM users"] },
        // Add any custom context you want
    },
    requestPanel: { headerAllowlist: ["content-type", "accept"] },
});

await httpDisplayer(err, finders, {
    content: [
        contextPage, // Add the context page
        { id: "perf", name: "Performance", code: { html: "<div>...</div>" } },
        { id: "custom", name: "Custom", code: { html: "<div>Custom content</div>" } },
    ],
});
```

### template(error, solutionFinders?, options?) => Promise<string>

Low-level HTML rendering API if you want full control of the response.

### Server helpers

From `@visulima/flame/server/open-in-editor`:

- `openInEditor(request, options)` — core function (uses `open-editor` under the hood)
- `createNodeHttpHandler(options)` — returns `(req, res) => void` for Node http servers
- `createExpressHandler(options)` — returns `(req, res) => void` for Express/Connect

Options:

- `projectRoot?: string` — defaults to `process.cwd()`
- `allowOutsideProject?: boolean` — defaults to `false`

### Editor selector

- Always visible
- Persists user choice in `localStorage` (`flame:editor`)
- Used for both the server opener (sent as `editor` in the POST body) and the client-side fallback

### Client-side fallback editor links

- If `openInEditorUrl` is not set, clicking “Open in editor” uses editor URL schemes on the client. The default editor is VS Code. The selected editor in the header is respected.
- Supported editors and templates (placeholders: `%f` = file, `%l` = line, `%c` = column when supported):
    - textmate: `txmt://open?url=file://%f&line=%l`
    - macvim: `mvim://open?url=file://%f&line=%l`
    - emacs: `emacs://open?url=file://%f&line=%l`
    - sublime: `subl://open?url=file://%f&line=%l`
    - phpstorm: `phpstorm://open?file=%f&line=%l`
    - atom: `atom://core/open/file?filename=%f&line=%l`
    - atom-beta: `atom-beta://core/open/file?filename=%f&line=%l`
    - brackets: `brackets://open?url=file://%f&line=%l`
    - clion: `clion://open?file=%f&line=%l`
    - code (VS Code): `vscode://file/%f:%l:%c`
    - code-insiders: `vscode-insiders://file/%f:%l:%c`
    - codium (VSCodium): `vscodium://file/%f:%l:%c`
    - cursor: `cursor://file/%f:%l:%c`
    - emacs: `emacs://open?url=file://%f&line=%l`
    - idea: `idea://open?file=%f&line=%l`
    - intellij: `idea://open?file=%f&line=%l`
    - macvim: `mvim://open?url=file://%f&line=%l`
    - notepad++: `notepad-plus-plus://open?file=%f&line=%l`
    - phpstorm: `phpstorm://open?file=%f&line=%l`
    - pycharm: `pycharm://open?file=%f&line=%l`
    - rider: `rider://open?file=%f&line=%l`
    - rubymine: `rubymine://open?file=%f&line=%l`
    - sublime: `subl://open?url=file://%f&line=%l`
    - textmate: `txmt://open?url=file://%f&line=%l`
    - vim: `vim://open?url=file://%f&line=%l`
    - visualstudio: `visualstudio://open?file=%f&line=%l`
    - vscode: `vscode://file/%f:%l:%c`
    - vscodium: `vscodium://file/%f:%l:%c`
    - webstorm: `webstorm://open?file=%f&line=%l`
    - xcode: `xcode://open?file=%f&line=%l`
    - zed: `zed://open?file=%f&line=%l&column=%c`
    - android-studio: `idea://open?file=%f&line=%l`

### Keyboard shortcuts

- Shift+/ (or ?) — Open shortcuts help dialog
- Esc — Close dialogs
- Enter/Space — Activate focused control (e.g., toggles, tabs)

### Examples

The Node example includes routes illustrating common hints:

- `/esm-cjs` — ESM/CJS interop
- `/export-mismatch` — default vs named export
- `/enoent` — missing file or case issue
- `/ts-paths` — TypeScript path mapping
- `/dns` — DNS/connection issue
- `/hydration` — React hydration mismatch
- `/undefined-prop` — accessing property of undefined

### Tooltips

- Components emit HTML with `data-tooltip-trigger`; a single script exported by the tooltip module is imported once by the layout (so there’s no duplication).

### Extend the VisulimaError

```ts
import { VisulimaError } from "@visulima/error";

class MyError extends VisulimaError {
    constructor(message: string) {
        super({
            name: "MyError",
            message,
        });
    }
}

throw new MyError("My error message");

// or

const error = new MyError("My error message");

error.hint = "My error hint";

throw error;
```

### Pretty code frame

```ts
import { codeFrame } from "@visulima/error";

const source = "const x = 10;\nconst error = x.y;\n";
const loc = { column: 16, line: 2 };

const frame = codeFrame(source, loc);

console.log(frame);
//   1 | const x = 10;
// > 2 | const error = x.y;
//     |                ^
```

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima error is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/error?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/error/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/flame/v/latest "npm"
