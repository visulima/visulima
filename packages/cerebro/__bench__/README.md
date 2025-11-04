# Cerebro CLI Framework Benchmarks

This directory contains comprehensive performance benchmarks comparing the `@visulima/cerebro` CLI framework with other popular CLI libraries in realistic, real-world scenarios.

## Libraries Compared

- **@visulima/cerebro** - Full-featured TypeScript-first CLI framework with plugins
- **CAC** - Super lightweight CLI framework with zero dependencies (Command And Conquer)
- **Cleye** - Intuitive TypeScript-first CLI with strongly typed parameters and minimal API
- **Commander** - Popular, mature Node.js CLI framework (most widely used)
- **Yargs** - Flexible command-line argument parser with extensive features
- **Oclif** - Enterprise-grade Open CLI Framework by Salesforce
- **Gunshi** - Modern TypeScript-first CLI library with universal runtime support
- **Meow** - Lightweight CLI helper with zero dependencies (by Sindre Sorhus)

## Benchmark Philosophy

These benchmarks focus on **real-world performance characteristics** that matter most to CLI tool users and developers:

### Why These Benchmarks Matter

1. **CLIs start fresh every time** - Unlike long-running servers, CLI tools are invoked repeatedly, so startup time is critical
2. **Users care about responsiveness** - Every millisecond counts when running commands frequently
3. **Real usage patterns** - We test scenarios that mirror actual CLI usage, not synthetic benchmarks

## Benchmark Categories

### 1. Cold Start / Initialization ⚡ **MOST CRITICAL**

Measures the time to create and set up a basic CLI instance. This is the most important metric for CLI tools since they start fresh with every invocation.

**What we test:**

- Basic CLI instantiation
- Plugin/extension loading
- Initial setup overhead

**Why it matters:** Users experience this every single time they run your CLI.

### 2. Single Command Registration

Measures the time to register one command with multiple options.

**What we test:**

- Adding a command with 3 flags/options
- Command metadata setup
- Option/flag definition overhead

**Why it matters:** Affects development experience and CLI startup when commands are defined.

### 3. Multiple Command Registration

Measures the time to register multiple commands (realistic CLI scenario).

**What we test:**

- Registering 5 commands at once
- Each command with multiple options
- Simulates a real CLI with subcommands

**Why it matters:** Most real CLIs have 5-20+ commands. This tests how frameworks scale.

### 4. Simple Argument Parsing

Measures basic command parsing with a few flags.

**What we test:**

- Single command: `build --verbose`
- Pre-initialized CLI instances (realistic scenario)

**Why it matters:** The most common use case - users running simple commands.

### 5. Complex Argument Parsing

Measures parsing performance with many flags (8+).

**What we test:**

- Command with 8 different flags
- Mix of strings, numbers, and booleans
- Complex flag combinations

**Why it matters:** Power users and complex commands need to parse quickly even with many options.

### 6. Mixed Positional + Flag Arguments

Measures parsing of positional arguments combined with flags.

**What we test:**

- Commands like: `process file1.txt file2.txt --output result.txt --format json`
- Real-world file processing patterns

**Why it matters:** Common pattern in file processing, git-like CLIs, and batch operations.

### 7. Help Text Generation

Measures the time to generate and display help text.

**What we test:**

- Full help text with descriptions
- Multiple options with detailed descriptions
- Formatted output generation

**Why it matters:** `--help` is often the first command users run. Should be instant.

### 8. Version Display

Measures the time to display version information.

**What we test:**

- Parsing `--version` flag
- Displaying version number
- Quick exit path

**Why it matters:** Common command for checking CLI version, should be instantaneous.

### 9. Error Handling Performance

Measures how quickly errors are caught and displayed.

**What we test:**

- Unknown commands
- Invalid flags
- Error message generation

**Why it matters:** Good CLIs fail fast with clear messages. Error paths should be as fast as success paths.

### 10. Full Lifecycle (Init + Register + Parse)

Measures the complete flow from creation to execution.

**What we test:**

- Initialize CLI
- Register command with options
- Parse arguments
- Complete end-to-end flow

**Why it matters:** This is what users actually experience - the total time from CLI start to execution.

## Running Benchmarks

From the package root:

```bash
pnpm run bench:cerebro
```

Or directly with vitest:

```bash
cd packages/cerebro/__bench__
pnpm run test:bench
```

## Expected Performance Characteristics

Based on architecture and design philosophy:

- **Cerebro**: Balanced performance with rich features (plugins, TypeScript, logging)
- **CAC**: Very fast and lightweight (zero dependencies, single file, minimal API)
- **Cleye**: Fast with strong typing (TypeScript-first, type-flag powered parsing)
- **Commander**: Very fast, lightweight, battle-tested (minimal overhead)
- **Yargs**: Flexible but heavier due to extensive feature set
- **Oclif**: Enterprise-grade but higher overhead (class-based, many abstractions)
- **Gunshi**: Modern and fast, TypeScript-first, universal runtime support
- **Meow**: Fastest for simple cases (zero dependencies, minimal features)

## Performance Considerations

### Cerebro's Design Trade-offs

Cerebro prioritizes:

- **Type safety** - Full TypeScript support with proper typing
- **Extensibility** - Plugin system for custom functionality
- **Developer experience** - Clear APIs, good error messages
- **Rich features** - Built-in logging, validation, help generation

This comes with overhead compared to minimal parsers like Meow, but provides a complete CLI development experience similar to Oclif with better performance.

### Fair Comparisons

When comparing results:

1. **Apples to apples** - Some frameworks are minimal parsers, others are full frameworks
2. **Feature parity** - More features = more overhead (but more value)
3. **Real-world context** - 1-2ms difference rarely matters in CLI tools
4. **Startup time** - This is where CLI performance matters most

## Interpreting Results

When analyzing benchmark results, consider:

1. **Cold start time** - The #1 most important metric for CLIs
2. **Scaling behavior** - How does performance change with complexity?
3. **Consistency** - Are results stable across runs?
4. **Real-world impact** - Will users notice the difference?

### Performance Targets

For good CLI tool experience:

- **Cold start**: < 50ms (imperceptible)
- **Simple parsing**: < 10ms (instant)
- **Complex parsing**: < 25ms (very fast)
- **Help generation**: < 50ms (acceptable)

## Contributing

To add new benchmarks:

1. **Focus on real-world scenarios** - Test what users actually do
2. **Document the "why"** - Explain why the benchmark matters
3. **Ensure fairness** - All frameworks handle equivalent scenarios
4. **Use try/catch** - Prevent benchmark failures from stopping the suite
5. **Update this README** - Document new categories clearly

### Benchmark Design Principles

- Test complete flows, not isolated functions
- Pre-initialize when that's what users experience
- Measure user-facing performance, not internal APIs
- Include both simple and complex scenarios
- Test error paths, not just happy paths

## Further Reading

- [CAC Documentation](https://github.com/cacjs/cac)
- [Cleye Documentation](https://github.com/privatenumber/cleye)
- [Commander Documentation](https://github.com/tj/commander.js)
- [Yargs Documentation](https://yargs.js.org/)
- [Oclif Documentation](https://oclif.io/)
- [Gunshi Documentation](https://github.com/so1ve/gunshi)
- [Meow Documentation](https://github.com/sindresorhus/meow)
