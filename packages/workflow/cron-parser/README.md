<div align="center">
  <h3>Visulima cron-parser</h3>
  <p>
  Parse cron expressions and walk their schedule, with time zone and DST support. ESM only, zero dependencies, runs on Node.js, Deno, Bun and Cloudflare Workers. It calculates run times; it does not run anything.
  </p>
</div>

<br />

<div align="center">

[![typescript-image][typescript-badge]][typescript-url]
[![mit licence][license-badge]][license]
[![npm downloads][npm-downloads-badge]][npm-downloads]
[![Chat][chat-badge]][chat]
[![PRs Welcome][prs-welcome-badge]][prs-welcome]

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
npm install @visulima/cron-parser
```

```sh
yarn add @visulima/cron-parser
```

```sh
pnpm add @visulima/cron-parser
```

## Usage

```ts
import { CronExpressionParser } from "@visulima/cron-parser";

const interval = CronExpressionParser.parse("0 9 * * 1-5", {
    currentDate: "2026-03-06T12:00:00Z",
    tz: "America/New_York",
});

interval.next().toISOString(); // "2026-03-06T14:00:00.000Z"  (09:00 EST)
interval.next().toISOString(); // "2026-03-09T13:00:00.000Z"  (09:00 EDT, after the DST change)
interval.prev().toISOString(); // "2026-03-06T14:00:00.000Z"
```

`next()` and `prev()` move a cursor, so they can be mixed. `take(n)` returns the next `n` runs (a negative `n` walks backwards), and the interval is iterable:

```ts
const days = CronExpressionParser.parse("0 0 * * *", {
    currentDate: "2026-01-01T00:00:00Z",
    endDate: "2026-01-03T12:00:00Z",
    tz: "UTC",
});

[...days].map((date) => date.toISOString());
// ["2026-01-02T00:00:00.000Z", "2026-01-03T00:00:00.000Z"]
```

### Options

| Option        | Description                                                                                                                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `currentDate` | Where iteration starts. A `Date`, epoch milliseconds, a date string or a `CronDate`. Defaults to now.                           |
| `startDate`   | Earliest allowed run. Used as `currentDate` when none is given.                                                                 |
| `endDate`     | Latest allowed run. `next()` throws and iteration ends once it is passed.                                                       |
| `tz`          | IANA time zone the expression is read in, such as `Europe/Berlin`. Defaults to the system zone.                                 |
| `hashSeed`    | Seed for `H` (hashed) values, so the same seed always picks the same minute and hour.                                           |
| `strict`      | Reject an expression that sets both day of month and day of week, has fewer than six fields, or has an unsatisfiable `H` range. |

### Expression syntax

Five or six fields (seconds are optional and come first): `second minute hour day-of-month month day-of-week`.

- `*`, `?`, lists (`1,15`), ranges (`1-5`) and steps (`*/10`, `10-30/5`)
- Month names (`JAN`-`DEC`) and weekday names (`SUN`-`SAT`); `0` and `7` are both Sunday
- `L` for the last day of the month (`0 0 L * *`) and the last given weekday (`0 9 * * 5L`)
- In the day of month field, from Quartz: `15W` (the weekday nearest the 15th, without leaving the month), `LW` (the last weekday of the month) and `L-3` (three days before the last day). See [Beyond the reference implementation](#beyond-the-reference-implementation).
- `#` for the nth weekday of the month (`0 9 * * 2#2` is the second Tuesday)
- `H` for a hashed value: `H`, `H(0-29)`, `H/15`
- `@yearly`, `@annually`, `@monthly`, `@weekly`, `@daily`, `@hourly`, `@minutely`, `@secondly`, `@weekdays`, `@weekends`

When both day of month and day of week are set, a day matching either one runs, as in Vixie cron.

### More on an interval

```ts
interval.hasNext(); // is there another run before endDate?
interval.includesDate(new Date("2026-03-09T13:00:00Z")); // true
interval.reset(new Date("2026-06-01T00:00:00Z")); // move the cursor
interval.stringify(); // "0 9 * * 1-5"
interval.fields.hour.values; // [9]
```

### Crontab files

Reading a crontab file needs `node:fs`, so it lives in its own entry point. The main entry never imports it, which keeps it loadable on Workers.

```ts
import { CronFileParser } from "@visulima/cron-parser/file";

const { expressions, variables, errors } = await CronFileParser.parseFile("./crontab");
```

## Time zones and DST

An expression is read on the wall clock of its `tz`, and a run is a real instant whose wall clock time matches it. Around a clock change that gives these rules:

- **A time that does not exist** (02:30 on the spring-forward day) runs after the gap, at the same minute of the first hour after it, when the expression names its hours. An every-hour schedule just skips the missing hour, so it does not run twice. A day that never happened at all (Samoa lost 30 December 2011) is dropped rather than moved.

    ```ts
    CronExpressionParser.parse("30 2 * * *", { currentDate: "2021-03-13T12:00:00Z", tz: "America/New_York" }).next().toISOString();
    // "2021-03-14T07:30:00.000Z"  (03:30 EDT)
    ```

- **A time that happens twice** (01:30 on the fall-back day) runs once, at the first pass, when the expression names its hours, and at both passes for an every-hour schedule. `next()`, `prev()` and `includesDate()` all follow the same rule.
- Zones with 30 and 45 minute offsets, gaps that begin mid-hour and gaps of more than an hour are handled.

`next()` and `prev()` do not step through DST. They list the wall clock times that match, with plain calendar arithmetic that skips whole months and days, and then turn each into the real instants it happens at. A schedule such as the fifth Wednesday of February is found directly, however far away it is.

Everything zone related comes from one primitive, a zone's UTC offset at an instant. It comes from native `Temporal` where the runtime has it (Deno and Bun do today) and from `Intl.DateTimeFormat` everywhere else. Both give the same answers: the test suite runs against each. The DST rules are checked against an independent brute-force model of the clock (it scans a zone minute by minute and inverts it) in 14 zone and date windows, including Samoa's lost day, Troll's two hour jump, Chatham's mid-hour gap and a 1844 Manila offset with seconds in it. Away from clock changes the results are compared with the `cron-parser` package and have to be identical. Native `Temporal` is also the faster backend where it exists: about 2 times the throughput of `Intl` on Bun and about 1.6 to 1.8 times on Deno.

`CronDate` is the date type `next()` and `prev()` return. It reads and moves a point in time on one zone's wall clock, and also exposes `getUTCOffset()`, `toISOString()` (UTC) and `toJSON()` (with the zone's own offset):

```ts
import { CronDate } from "@visulima/cron-parser";

const date = new CronDate("2026-07-01T12:00:00Z", "Europe/Berlin");

date.getHours(); // 14
date.getUTCOffset(); // 120
date.toJSON(); // "2026-07-01T14:00:00.000+02:00"
```

Date strings may be ISO 8601 / SQL, RFC 2822 or HTTP dates. A string without an offset is wall clock time in `tz`.

## Runtimes and size

The main entry uses only `Intl`, optionally `Temporal`, and plain JavaScript, so it runs unchanged on Node.js, Deno, Bun and Cloudflare Workers. It is ESM only, side-effect free, and has no dependencies.

Bundled and minified, `CronExpressionParser.parse(...).next()` is about 31 KB (11 KB gzipped), and a bare `CronDate` is about 10 KB (4 KB gzipped). The same import through `cron-parser` and `luxon` is about 100 KB (31 KB gzipped). `pnpm run build:prod && pnpm run size` prints the figures for this package. Iteration is also faster than that package; `__bench__` compares it with `croner`, `cron-schedule` and `cron-fast` too.

Tree-shaking helps less than the sizes suggest: parsing needs the whole expression engine, so importing `CronExpressionParser` costs nearly the same as importing everything. What it does keep out of your bundle is the crontab reader (a separate entry point) and, if you only need dates, the parser.

## Coming from `cron-parser`

The API is the same shape: `CronExpressionParser.parse`, `CronExpression`, `CronFieldCollection`, `CronDate` and the field classes keep their names and behaviour. What changes:

- ESM only, no `luxon`. Timezone handling is built in.
- `CronFileParser` moves to `@visulima/cron-parser/file`.
- `TimeUnit`, `DateMathOp`, `CronUnit` and the other enums are `as const` objects, so they tree-shake.
- `new CronDate(0)` is the epoch. (Before, any falsy value meant "now".) An empty string throws.
- `toISOString()` and `toJSON()` return `string`, never `null`.
- An unknown `tz` throws `CronDate: unhandled timezone: <name>`.
- `CronDate` reads ISO 8601 / SQL, RFC 2822 and HTTP date strings. Other `luxon`-only forms (ISO week and ordinal dates, `UTC+3` style zone names) are not accepted.

### Behaviour that differs

These follow from the DST rules above and from defects in `cron-parser` that this package fixes. A schedule that never crosses a clock change is unaffected.

- `prev()` after a spring-forward gap returns the run that was moved after the gap instead of skipping back a day.
- A repeated hour is run once going backwards and in `includesDate()` as well as going forwards, and the result no longer depends on whether the search starts in the first or the second pass.
- A fall-back of less than an hour (`Australia/Lord_Howe`) and a gap that begins mid-hour (`Pacific/Chatham`) no longer make `next()` or `prev()` fail with `Invalid expression, loop limit exceeded`.
- A schedule with no run for decades (the fifth Wednesday of February) no longer hits that limit.
- `CronDate` no longer has `dstStart`, `dstStartLandingHour`, `dstEnd`, `clearDstStart`, `applyDateOperation`, `invokeDateOperation` or `DateMathOp`: they existed to drive the reference implementation's search and always reported nothing on a returned date. `DAYS_IN_MONTH` is no longer exported from the date module.
- `includesDate()` asks only whether the date is one of the schedule's runs; it ignores `startDate` and `endDate`.
- `startDate` and `endDate` are both inclusive: a run exactly on `startDate` is the first one returned, and one exactly on `endDate` the last. A `currentDate` is still excluded, so `next()` never returns the cursor.
- `reset()` without an argument goes back to the starting point, which is `startDate` when there is no `currentDate`.
- A crontab line is a variable only when it looks like `NAME=value`; a command that happens to contain `=` stays a job. `@daily`-style schedules in a crontab file are read, and `@reboot` is reported in `errors`.

The two crontab changes and `reset()` are not tied to DST; the rest are.

### Beyond the reference implementation

These are in this package and not in `cron-parser`. All three are day of month atoms, usable on their own or in a list (`1,15W,LW`), and none of them can be combined with a range or a step.

| Syntax | Meaning                                                                                                                                                                                                                                                                                                |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `15W`  | The weekday (Monday to Friday) nearest the 15th, without leaving the month. A Saturday gives the Friday before, a Sunday the Monday after. The 1st on a Saturday gives Monday the 3rd, and the last day on a Sunday gives the Friday before. A month shorter than the day (`31W` in April) has no run. |
| `LW`   | The last weekday of the month.                                                                                                                                                                                                                                                                         |
| `L-3`  | Three days before the last day of the month. `L-1` to `L-30` are accepted; a month too short for the offset has no run.                                                                                                                                                                                |

```ts
CronExpressionParser.parse("0 0 15W * *", { currentDate: "2026-01-31T00:00:00Z", tz: "UTC" })
    .take(3)
    .map((run) => run.toISOString().slice(0, 10));
// ["2026-02-16", "2026-03-16", "2026-04-15"]   (15 February and March 2026 are Sundays)
```

When the day of week field is also set, a day matching either field runs, as with any other day of month value.

### Open requests this does not cover

Switching the non-standard extensions off, a "this run" accessor and shorter `stringify()` output for stepped ranges are requests upstream has not implemented and this package does not either.

The `temporal-polyfill` package has wrong offsets for `Africa/Casablanca` (Morocco's negative DST); native `Temporal` in Bun and Deno agrees with `Intl` there. The DST model above does not depend on the polyfill's data, but the comparison with `cron-parser` skips that zone when running on the polyfill.

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://nodejs.org/en/past-releases/#release-schedule). Here's [a post on why we think this is important](https://medium.com/the-node-js-collection/maintaining-node-last-release-line-8-dedicated-to-the-ecosystem-8acb1d3bcb8a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guild.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima cron-parser is open-sourced software licensed under the [MIT][license]

[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
[license-badge]: https://img.shields.io/npm/l/@visulima/cron-parser?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE.md
[npm-downloads]: https://www.npmjs.com/package/@visulima/cron-parser
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/cron-parser?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-green.svg?style=for-the-badge
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFm
