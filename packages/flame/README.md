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
  - Built-in rule-based Markdown hints for common issues (ESM/CJS interop, export mismatch, port in use, missing files/case, TS path mapping)
- Raw stack trace panel
- Theme toggle (auto/dark/light) with persistence
- Consistent tooltips (one global script; components only output HTML)

## Quick start (HTTP server)

Use the built-in displayer to render the error page and respond to the request. Optionally add an endpoint to open files in your editor.

```ts
import { createServer } from 'node:http';
import httpDisplayer from '@visulima/flame/displayer/http';
import { createNodeHttpHandler } from '@visulima/flame/server/open-in-editor';

const openInEditor = createNodeHttpHandler({ projectRoot: process.cwd() });

const server = createServer(async (req, res) => {
  if (req.url?.startsWith('/__open-in-editor')) return openInEditor(req, res);

  try {
    // your app logic …
    throw new Error('Boom');
  } catch (err) {
    const handler = await httpDisplayer(err as Error, [], {
      // show editor selector and enable "Open in editor" buttons
      openInEditorUrl: '/__open-in-editor',
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
import express from 'express';
import httpDisplayer from '@visulima/flame/displayer/http';
import { createExpressHandler } from '@visulima/flame/server/open-in-editor';

const app = express();
app.use(express.json());
app.post('/__open-in-editor', createExpressHandler({ projectRoot: process.cwd() }));

app.get('/', async (req, res) => {
  try {
    throw new Error('Example');
  } catch (err) {
    const handler = await httpDisplayer(err as Error, [], { openInEditorUrl: '/__open-in-editor' });
    return handler(req, res);
  }
});

app.listen(3000);
```

## API

### httpDisplayer(error, solutionFinders?, options?) => Promise<(req, res) => Promise<void>>

- **error**: Error
- **solutionFinders**: SolutionFinder[] (optional)
- **options**:
  - `openInEditorUrl?: string` — when provided, the UI shows “Open in editor” and calls this endpoint (POST JSON: `{ file, line, column, editor? }`).
  - `editor?: Editor` — initial editor to show as selected in the header selector (saved to `localStorage` and sent in requests).
  - `theme?: 'dark' | 'light'` — initial theme; users can toggle.

Returns an async request handler compatible with Node http (and usable inside Express routes).

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

- Visible only when `openInEditorUrl` is provided
- Persists user choice in `localStorage` (`flame:editor`)
- Selected editor is sent in the POST body as `editor`

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
