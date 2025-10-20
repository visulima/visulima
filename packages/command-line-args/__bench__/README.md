# Benchmark Suite

This directory contains performance benchmarks comparing `@visulima/command-line-args` with other popular argument parsing libraries.

## Libraries Compared

- **@visulima/command-line-args** - The library being developed
- **command-line-args** - Original npm command-line-args library
- **jackspeak** - Node.js core argument parser (fastest)
- **yargs-parser** - Popular argument parser from yargs
- **argparse** - Python-style argument parser
- **args** - Simple argument parser
- **args-tokens** - Token-based argument parser
- **node:util.parseArgs** - Built-in Node.js argument parser
- **mri** - Tiny argument parser
- **@bomb.sh/args** - Fast argument parser
- **minimist** - Minimal argument parser

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

- **@bomb.sh/args** is the fastest overall (~1.2x faster than mri, ~4x faster than @visulima/command-line-args)
- **mri** is extremely fast (~1.5x faster than @visulima/command-line-args in boolean scenarios)
- **@visulima/command-line-args** performs well (~3.8x faster than original command-line-args)
- **node:util.parseArgs** and **args-tokens** are solid performers
- **Original command-line-args** is significantly slower than @visulima/command-line-args (~16x slower than @bomb.sh/args)
- **argparse** is by far the slowest (~300x slower than @bomb.sh/args)

## Feature Comparison

@visulima/command-line-args and the original command-line-args library are both **feature-complete** with advanced parsing capabilities. The key difference is **performance** - @visulima/command-line-args is significantly faster while maintaining 100% API compatibility.

### Advanced Features Comparison

| Feature                   | Description                                                            | @visulima/command-line-args | command-line-args | jackspeak | yargs-parser | argparse | args | args-tokens | node:util.parseArgs | mri | @bomb.sh/args | minimist |
| ------------------------- | ---------------------------------------------------------------------- | --------------------------- | ----------------- | --------- | ------------ | -------- | ---- | ----------- | ------------------- | --- | ------------- | -------- |
| **defaultOption**         | Assigns unaccounted values to a specific option (e.g., for file paths) | ✅                          | ✅                | ❌        | ✅           | ✅       | ❌   | ❌          | ✅                  | ❌  | ❌            | ❌       |
| **multiple**              | Options can accept multiple values as arrays                           | ✅                          | ✅                | ❌        | ✅           | ✅       | ❌   | ❌          | ❌                  | ✅  | ❌            | ❌       |
| **lazyMultiple**          | Multiple values with greedy parsing disabled                           | ✅                          | ✅                | ❌        | ❌           | ❌       | ❌   | ❌          | ❌                  | ❌  | ❌            | ❌       |
| **group**                 | Group options for conditional requirements                             | ✅                          | ✅                | ❌        | ❌           | ❌       | ❌   | ❌          | ❌                  | ❌  | ❌            | ❌       |
| **camelCase**             | Auto-convert `option-name` to `optionName`                             | ✅                          | ✅                | ❌        | ✅           | ❌       | ❌   | ❌          | ❌                  | ❌  | ❌            | ❌       |
| **caseInsensitive**       | Case-insensitive option matching                                       | ✅                          | ✅                | ❌        | ❌           | ❌       | ❌   | ❌          | ❌                  | ❌  | ❌            | ❌       |
| **partial**               | Don't throw on unknown options, collect in `_unknown`                  | ✅                          | ✅                | ❌        | ❌           | ❌       | ❌   | ❌          | ❌                  | ❌  | ❌            | ❌       |
| **stopAtFirstUnknown**    | Stop parsing at first unknown argument                                 | ✅                          | ✅                | ❌        | ❌           | ❌       | ❌   | ❌          | ❌                  | ❌  | ❌            | ❌       |
| **Custom type functions** | User-defined type conversion/validation functions                      | ✅                          | ✅                | ❌        | ✅           | ✅       | ❌   | ✅          | ❌                  | ❌  | ❌            | ❌       |
| **defaultValue**          | Initial values for options                                             | ✅                          | ✅                | ✅        | ✅           | ✅       | ✅   | ✅          | ✅                  | ❌  | ✅            | ❌       |
| **Aliases**               | Short and long option aliases                                          | ✅                          | ✅                | ✅        | ✅           | ✅       | ✅   | ✅          | ✅                  | ✅  | ❌            | ✅       |
| **Type coercion**         | Automatic type conversion (String, Number, Boolean)                    | ✅                          | ✅                | ✅        | ✅           | ✅       | ✅   | ✅          | ✅                  | ✅  | ✅            | ✅       |

### Feature Explanations

- **defaultOption**: Allows commands like `myapp --verbose file1.txt file2.txt` where `file1.txt` and `file2.txt` are assigned to a default option without `--files`
- **multiple**: Options like `--file a.txt --file b.txt` result in `{ file: ['a.txt', 'b.txt'] }`
- **lazyMultiple**: Similar to multiple but stops at the next option flag, preventing over-greedy parsing
- **group**: Options can be grouped and made conditionally required (e.g., auth group requires both `--user` and `--pass`)
- **camelCase**: `--option-name` becomes `optionName` in the result object
- **caseInsensitive**: `--Verbose`, `--verbose`, `-V`, `-v` are all treated identically
- **partial**: Unknown options don't throw errors, they're collected in `_unknown` array
- **stopAtFirstUnknown**: Parsing stops at first unknown argument, useful for subcommands
- **Custom type functions**: Define your own validation/conversion logic for option values

## When to Choose Each Library

### Choose @visulima/command-line-args when you need:

- Advanced features like `defaultOption`, `partial`, `stopAtFirstUnknown`
- Case-insensitive parsing or camelCase conversion
- Complex option relationships with groups
- Custom type validation functions
- Multiple values per option with lazy parsing
- You're building a complex CLI tool with many options

### Choose command-line-args (original) when you need:

- A mature, well-tested argument parsing library
- `defaultOption`, `multiple`, and custom type functions
- You're already using it in existing projects
- A good balance of features and simplicity

### Choose @bomb.sh/args when you need:

- Maximum performance for simple use cases
- Basic argument parsing (strings, numbers, booleans)
- Minimal bundle size impact
- No advanced features needed

### Choose mri when you need:

- Very fast parsing for simple cases
- Small bundle size
- Basic type coercion
- Simple API similar to minimist

### Choose minimist when you need:

- Minimal, no-frills argument parsing
- Maximum compatibility/simplicity
- You're already using it in existing projects

### Choose yargs-parser when you need:

- Compatibility with yargs ecosystem
- camelCase conversion
- Custom type functions
- You're migrating from yargs

### Choose args-tokens when you need:

- Token-based parsing approach
- Custom type functions
- Multiple values support

### Choose node:util.parseArgs when you need:

- Zero dependencies (Node.js 18.3+)
- Basic parsing with good performance
- Simple, modern API

### Choose jackspeak when you need:

- Maximum performance
- Simple, modern API
- Zero dependencies

### Choose argparse when you need:

- Python-style argument parsing
- Complex help generation
- Positional arguments
- Subcommands support

### Choose args when you need:

- Simple, fluent API
- Basic argument parsing
- Easy option definition

## Adding New Benchmarks

1. Add new test cases to `benchmark.bench.ts`
2. Ensure all libraries handle the arguments appropriately
3. Use try/catch blocks to prevent benchmark failures from library errors
4. Update the feature comparison table if new libraries have different capabilities
