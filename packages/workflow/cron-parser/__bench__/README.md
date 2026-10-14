# Benchmark

Compare `@visulima/cron-parser` with the most used cron libraries: [`cron-parser`](https://www.npmjs.com/package/cron-parser), [`croner`](https://www.npmjs.com/package/croner), [`cron-schedule`](https://www.npmjs.com/package/cron-schedule), [`cron-fast`](https://www.npmjs.com/package/cron-fast) and, for validation and parsing, [`cron-validate`](https://www.npmjs.com/package/cron-validate).

## Run benchmark

Build the package first, the benchmark imports its `dist`:

```bash
pnpm --filter "@visulima/cron-parser" run build:prod
pnpm --filter "cron-parser-bench" run test:bench
```

## What is measured

| File                    | Operation                                                                  |
| ----------------------- | -------------------------------------------------------------------------- |
| `next-run.bench.ts`     | The next run after a date, for seven common expressions                    |
| `previous-run.bench.ts` | The previous run before a date                                             |
| `next-runs.bench.ts`    | The next 100 runs                                                          |
| `parsing.bench.ts`      | Turning an expression into a parsed schedule                               |
| `validation.bench.ts`   | Checking an expression, including 44 640 distinct ones that defeat caching |
| `timezone.bench.ts`     | 30 daily runs across a DST change in three zones                           |

The scheduling cases and the validation cases follow the ones `cron-fast` publishes, so the numbers are comparable. The timezone case is added because most of the work in this package is there.

## Reading the results

- The libraries do not do the same amount of work. `cron-fast` and `cron-schedule` take five fields and no seconds; `@visulima/cron-parser` and `cron-parser` also handle seconds, `L`, `#`, `H`, strict mode and the wall-clock DST rules, and return a stateful iterator. A smaller feature set is faster by construction.
- `cron-schedule` has no time zone option, so it is left out of `timezone.bench.ts`.
- The process runs with `TZ=UTC` so libraries that read the system zone are compared fairly.
- On CodSpeed only `@visulima/cron-parser` runs. The others are skipped (`CODSPEED_ENV`) so that a release of a competitor cannot move the tracked numbers.
