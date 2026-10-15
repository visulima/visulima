# Agent Instructions

This file provides guidance to AI coding agents when working with code in this directory.

## Overview

`@visulima/cron-parser` parses cron expressions and iterates their schedule, with time zone and DST support. It is an ESM-only, zero-dependency port of the `cron-parser` v5 API that runs on Node, Bun and workerd.

## Architecture

- `src/zone.ts` is the only place that computes time zone offsets. Everything hangs off one primitive, `zone.offset(epochMs)` (UTC offset in minutes), implemented with native `Temporal` when the runtime has it and `Intl.DateTimeFormat` otherwise, and remembered over stretches where it cannot change (`rememberOffsets`: found by probing outwards, ten days at a time, then narrowing to the second; `zone.rawOffset` is the same lookup without the memory, for checking it). `resolveLocal` and `wallInstants` turn a wall clock time into instants on top of that primitive. Keep wall clock arithmetic out of the backends so they cannot disagree about DST. (`parse-date.ts` also knows the RFC 2822 obsolete zone names such as `EST`; those are fixed offsets in a date string, not zones.)
- `src/schedule.ts` finds runs. `nearestWall` lists the wall clock times that match the expression by calendar arithmetic (skipping whole months and days); `wallInstants` in `zone.ts` turns a wall time into the 0, 1 or 2 instants it happens at; `findRun` applies the DST rules and searches a transition's width either side of the cursor so a landing time or a second pass is never missed. There is no DST bookkeeping and no stepping through hours: keep it that way, every upstream DST defect came from that.
- `src/cron-date.ts` is a mutable date read and moved on one zone's wall clock, kept as the public date type that `next()` and `prev()` return. It no longer carries the reference implementation's DST bookkeeping (`dstStart`, `dstEnd`, `applyDateOperation`): the search that needed it is gone.
- `src/fields/day-of-month-text.ts` reads the day of month atoms that go beyond the reference implementation (`L`, `nL`, `LW`, `L-n`, `nW`). The parser validates and normalises them, the field class accepts them, `cron-expression.ts` turns them into plain data on the `DaySpec`, and `schedule.ts` matches them. A day of month `nL` (`5L`) is normalised to `L` in the parser, the way `cron-parser` reads it. `__tests__/day-of-month-extensions.test.ts` holds a reference that reads the real calendar with `Date` and shares no code with the engine; keep it independent.
- `src/parse-date.ts` parses ISO 8601/SQL, RFC 2822 and HTTP date strings. A string without an offset is wall clock time in the target zone.
- `src/cron-expression-parser.ts` turns an expression into `fields/*` values; `src/cron-expression.ts` owns the cursor, the bounds and the day matching, and asks `schedule.ts` for runs.
- `src/dialect.ts` holds the syntax switches (`CronFeatures`) and the named dialects (`extended`, `cron-parser`, `cloudflare`). `parse()` folds a dialect and per-feature overrides into one `CronFeatures & CronRules` record. The parser rejects what is switched off and collects the extensions an expression uses into `CronExpression#usedFeatures`.
- `CronRules` is how a dialect _reads_ an expression, and a caller cannot override it: `sundayIsOne` (below), `mixedDayOfMonthText` (a day of month text has to stand alone) and `largeSteps` (a step may reach the size of the field).
- `sundayIsOne` (Cloudflare) numbers the weekdays 1 (Sunday) to 7 (Saturday), so `0` is invalid and a bare `L` is Saturday. The day of week field, names included, is parsed on that 1-7 scale and moved to 0-6 once, in `parse()`. Nothing downstream sees the shift.
- `seconds` is `"forbid" | "optional" | "require"`, judged on the expression as written, not on a nickname's expansion (`@daily` does not report `seconds`). `strict` never pads: it needs the field count the grammar defines.
- The `cloudflare` preset is checked against the live validator wrangler deploys through (`cron-triggers.cloudflareworkers.com`, backed by `cloudflare/saffron`).
- The wildcard cache is keyed by field and its min-max range, so one dialect's `*` never reuses another's expansion. The `?` check runs before the cache is consulted, or a `?` in an earlier expression would skip the dialect check.
- `src/file.ts` (crontab file parsing) is its own entry point (`@visulima/cron-parser/file`) because it imports `node:fs`. `src/cloudflare.ts` is another (`@visulima/cron-parser/cloudflare`): the default API with `dialect: "cloudflare"` applied by a `CloudflareCronExpressionParser` subclass that re-exports the rest through `export * from "./index"`, so it must not import a `node:*` module either. Nothing reachable from `src/index.ts` may import a `node:*` module, `process` or `Buffer`: the main entry has to load on workerd.

## Testing

- `vitest.config.ts` runs every suite twice, as the `intl` and `temporal` projects. The `temporal` project installs `temporal-polyfill` on `globalThis` before the code loads, so the Temporal backend gets the same coverage as the Intl one.
- `__tests__/clock-change-oracle.test.ts` checks `next`/`prev` against a brute-force model of the clock-change rules: it scans a zone minute by minute (second by second for Manila) and inverts the clock, using none of the engine's wall clock mapping and reading `zone.rawOffset`, so it does not depend on the offset memory. It shares the offset primitive itself with the engine, so an error in `Intl` or `Temporal` data is not caught here; the comparison with the reference package and the zone tests cover that. 14 windows, including Apia's lost day, Troll's 2h jump, Chatham's mid-hour gap and Manila 1844. A change to `schedule.ts`, `zone.ts` or the DST rules is not done until it passes.
- `__tests__/regressions.test.ts` holds the values reporters gave for the known upstream defects.
- `__tests__/differential.test.ts` compares with the upstream `cron-parser` package (a devDependency used only as an oracle; `luxon` is a devDependency too, used by one ported date test) and requires identical results wherever no clock change is within two days; near one the oracle test judges. Africa/Casablanca is skipped on the `temporal` project (the polyfill's offsets are wrong; native Temporal in Bun matches Intl).
- `__tests__/zone.test.ts` includes the check that the remembered offsets equal the raw ones around every transition of ten zones. Any change to `rememberOffsets` has to keep it green.
- `__tests__/types.test.ts` holds the compile-time checks of the range types; they run as part of `tsc --noEmit`.
- The ported suite is split by area (`cron-expression-parser*.test.ts`) to stay under the 1k-line limit. Where an expectation differs from the reference implementation, the test carries a comment saying why.
- `__tests__/workerd/` runs under `pnpm run test:workerd`.
- `scripts/runtime-smoke.mjs` runs the built `dist` on whichever runtime executes it; `pnpm run test:runtimes` runs it under Node and Bun (build first). Bun ships native `Temporal`, so it exercises the native backend.
- The suite sets `TZ=UTC`, as upstream does.
