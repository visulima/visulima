# Cerebro CLI Framework Benchmarks

This directory contains performance benchmarks comparing the `@visulima/cerebro` CLI framework with other popular CLI libraries.

## Libraries Compared

- **@visulima/cerebro** - The CLI framework being developed
- **Commander** - Popular Node.js CLI framework
- **Yargs** - Command line argument parser
- **Oclif** - Open CLI Framework (enterprise-grade framework)
- **Gunshi** - Modern TypeScript-first CLI library with universal runtime support

## Benchmark Categories

### 1. CLI Initialization
Measures the time to create and set up a basic CLI instance.

### 2. Command Registration
Measures the time to register commands with options and descriptions.

### 3. Command Parsing Performance
Measures the time to parse command line arguments and execute commands.

### 4. Help Generation
Measures the time to generate and display help text.

### 5. Version Display
Measures the time to display version information.

## Running Benchmarks

From the package root, run:

```bash
pnpm run bench:cerebro
```

Or directly with vitest:

```bash
cd packages/cerebro/__bench__
pnpm run test:bench
```

## Performance Considerations

Cerebro is designed to be a full-featured CLI framework with:
- Built-in logging (via Pail)
- Advanced command-line argument parsing
- Automatic help generation
- Extension system
- Update notifier support
- TypeScript-first design

While this adds overhead compared to minimal parsers, it provides a complete CLI development experience.

## Expected Performance Characteristics

- **Cerebro**: Balanced performance with rich features
- **Commander**: Fast, lightweight, mature framework
- **Yargs**: Flexible but potentially slower due to extensive features
- **Oclif**: Enterprise-grade but heavier framework with more overhead
- **Gunshi**: Modern TypeScript-first framework with universal runtime support

## Interpreting Results

When analyzing benchmark results, consider:
1. **Initialization time**: How quickly the CLI framework sets up
2. **Registration time**: How efficiently commands are added
3. **Parsing time**: How fast arguments are processed
4. **Help generation**: How quickly help text is produced

## Contributing

To add new benchmarks:
1. Add test cases to `index.bench.ts`
2. Ensure all frameworks handle equivalent scenarios
3. Use try/catch blocks to prevent benchmark failures
4. Update this README with new categories or frameworks
