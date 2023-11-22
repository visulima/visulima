<div align="center">
  <h3>Visulima error</h3>
  <p>
  Error with more than just a message.
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
npm install @visulima/error
```

```sh
yarn add @visulima/error
```

```sh
pnpm add @visulima/error
```

## Usage

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

## Stacktrace

> Browser older than 6 years are not supported.

Currently supported browsers/platforms:

- Firefox
- Chrome
- Webkit / Safari
- Edge
- Node / Node V8
- Opera (Chromium based)

```ts
import { parseStack } from "@visulima/error";

const error = new Error("My error message");

const stack = parseStack(error);

console.log(stack);

// [
//     {
//         column: 16,
//         file: "file:///Users/danielbannert/Projects/visulima/packages/error/src/index.ts",
//         line: 2,
//         method: "Object.<anonymous>",
//     },
//     ...and so on
// ];
```

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

-   [Daniel Bannert](https://github.com/prisis)
-   [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## About

### Related Projects

- [baseerr](https://github.com/tjmehta/baseerr): merge another error with additional properties.
- [callsite-record](https://github.com/inikulin/callsite-record): create a fancy log entries for errors and function call sites.
- [callsites](https://github.com/sindresorhus/callsites): get callsites from the V8 stack trace API.
- [explain-error](https://github.com/dominictarr/explain-error): wrap an error with additional explanation.
- [error-wrapper](https://github.com/spudly/error-wrapper): merges the stack of another error to its own.
- [errwischt/stacktrace-parser](https://github.com/errwischt/stacktrace-parser)
- [trace](https://github.com/AndreasMadsen/trace): create super long stack traces.
- [clarify](https://github.com/AndreasMadsen/clarify): remove node related stack trace noise.
- [piotr-szewczyk/stacktrace-parser-node](https://github.com/piotr-szewczyk/stacktrace-parser-node)
- [pretty-error](https://github.com/AriaMinaei/pretty-error): make the call stacks clear.
- [ono](https://github.com/bigstickcarpet/ono): allow different types of error to be thrown.
- [ololog](https://github.com/xpl/ololog): another logger with a similar motivation but only support console.log as its sole transport.
- [stacktracejs/error-stack-parser](https://github.com/stacktracejs/error-stack-parser)
- [marvinhagemeister/errorstacks](https://github.com/marvinhagemeister/errorstacks) Tiny library to parse error stack traces
- [getsentry/sentry-javascript](https://github.com/getsentry/sentry-javascript)

## License

The visulima error is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/error?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/error/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/error/v/latest "npm"
