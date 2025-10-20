# Benchmark Suite

This directory contains performance benchmarks comparing `@visulima/command-line-args` with other popular argument parsing libraries.

## Libraries Compared

- **@visulima/command-line-args** - The library being developed
- **jackspeak** - Node.js core argument parser (fastest)
- **yargs-parser** - Popular argument parser from yargs
- **argparse** - Python-style argument parser

## Running Benchmarks

From the package root, run:

```bash
pnpm run bench
```

Or directly with vitest:

```bash
npx vitest bench
```

## Results Summary

Based on recent benchmarks:

- **jackspeak** is ~2x faster than command-line-args
- **command-line-args** performs comparably to yargs-parser
- **argparse** is significantly slower (~28x slower than jackspeak)

## Adding New Benchmarks

1. Add new test cases to `benchmark.bench.ts`
2. Ensure all libraries handle the arguments appropriately
3. Use try/catch blocks to prevent benchmark failures from library errors
