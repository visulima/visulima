# String Case Functions Benchmarks

This directory contains benchmarks comparing the performance of Visulima string case functions against Lodash and native JavaScript implementations.

## Running the Benchmarks

To run all benchmarks:

```bash
pnpm run bench
```

To run a specific benchmark file:

```bash
pnpm run bench case-functions.bench.ts
pnpm run bench case-utils.bench.ts
```

## What's Being Measured

### Case Functions Benchmark (`case-functions.bench.ts`)

Compares the performance of Visulima case conversion functions against Lodash:

- `camelCase`
- `kebabCase`
- `snakeCase`

Tests include:
- Basic case conversions
- Locale-aware conversions (German)
- Special character handling (ANSI, emojis)
- Known acronym handling

### Case Utilities Benchmark (`case-utils.bench.ts`)

Compares the performance of Visulima's optimized case utilities against native JavaScript:

- `toLowerCase` vs `fastLowerCase`
- `toUpperCase` vs `fastUpperCase`
- Locale-aware case conversions
- Cache effectiveness with repeated strings
- Special character handling

## Test Data

The benchmarks use a variety of test strings to cover different scenarios:
- Mixed case strings
- Hyphenated strings
- Underscored strings
- Strings with special characters (ANSI, emojis)
- Common acronyms
- Repeated strings (for cache testing)

## Expected Results

The Visulima implementations should show performance advantages in:
1. Repeated operations (due to caching)
2. Special character handling (ANSI, emojis)
3. Locale-aware operations
4. Known acronym handling

Native operations may be faster for:
1. Single, simple case conversions
2. Basic ASCII strings without special handling

## Notes

- The benchmarks use Vitest's bench utilities
- Each operation is run multiple times with different input strings
- Cache size is limited to prevent memory issues
- Special attention is paid to locale-aware operations and special character handling
