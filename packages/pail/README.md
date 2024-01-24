<div align="center">
  <h3>Visulima Pail</h3>
  <p>
  Highly configurable Logger for Node.js and Browser, built on top of

[@visulima/fmt](https://github.com/visulima/visulima/tree/main/packages/fmt),
[string-length](),
[strip-ansi](),
[terminal-size]() and
[wrap-ansi]()

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

## Why Pail?

-   Easy to use
-   Hackable to the core
-   Integrated timers
-   Custom pluggable processors, reporters and serializers
-   TypeScript support
-   Interactive and regular modes
-   Secrets & sensitive information filtering (soon)
-   Filename, date and timestamp support
-   Scoped loggers and timers
-   Scaled logging levels mechanism
-   String interpolation support
-   Object and error interpolation
-   Stack trace and pretty errors
-   Simple and minimal syntax
-   Spam prevention by throttling logs
-   Browser support
-   Redirect console and stdout/stderr to pail and easily restore redirect.
-   `Pretty` or `JSON` output
-   CJS & ESM with tree shaking support
-   Supports circular structures
-   Fast and powerful

## Install

```sh
npm install @visulima/pail
```

```sh
yarn add @visulima/pail
```

```sh
pnpm add @visulima/pail
```

## Concepts

> Most importantly, `pail` adheres to the log levels defined in [RFC 5424][rfc-5424].
> This means that you can use the log levels to filter out messages that are not important to you.

### Log Levels

Pail supports the logging levels described by [RFC 5424][rfc-5424].

-   `DEBUG`: Detailed debug information.

-   `INFO`: Interesting events. Examples: User logs in, SQL logs.

-   `NOTICE`: Normal but significant events.

-   `WARNING`: Exceptional occurrences that are not errors. Examples: Use of deprecated APIs, poor use of an API, undesirable things that are not necessarily wrong.

-   `ERROR`: Runtime errors that do not require immediate action but should typically be logged and monitored.

-   `CRITICAL`: Critical conditions. Example: Application component unavailable, unexpected exception.

-   `ALERT`: Action must be taken immediately. Example: Entire website down, database unavailable, etc. This should trigger the SMS alerts and wake you up.

-   `EMERGENCY`: Emergency: system is unusable.

### Reporters

Reporters are responsible for writing the log messages to the console or a file. `pail` comes with a few built-in reporters:

| Browser (console.{function}) | Server (stdout or stderr) |
| ---------------------------- | ------------------------- |
| `JsonReporter`               | `JsonReporter`            |
| `PrettyReporter`             | `PrettyReporter`          |
| x                            | `FileReporter`            |

### Processors

Processors are responsible for processing the log message (Meta Object) before it's written to the console or a file.
This usually means that they add some metadata to the record's `context` property.

A processor can be added to a logger directly (and is subsequently applied to log records before they reach any handler).

`pail` comes with a few built-in processors:

-   `CallerProcessor` - adds the caller information to the log message
    -   The Meta Object is extended with a file name, line number and column number
-   `RedactProcessor` - redacts sensitive information from the log message (Soon)

### Serializers

Serializers are responsible for serializing the log message (Meta Object) before it's written to the console or a file.

`pail` comes with a few built-in serializers:

-   `errorWithCauseSerializer` - serializes the error with cause object to a std error object that can be serialized.

## Usage

```typescript
import { pail } from "@visulima/pail";

pail.info("Hello World");
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

## License

The visulima pail is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: "typescript"
[license-image]: https://img.shields.io/npm/l/@visulima/pail?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/pail/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/pail/v/latest "npm"
[rfc-5424]: https://datatracker.ietf.org/doc/html/rfc5424#page-36
