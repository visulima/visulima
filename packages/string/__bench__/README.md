# String Case Functions Benchmarks

This directory contains benchmarks comparing the performance of Visulima string case functions against Lodash, Scule, change-case, and native JavaScript implementations.

## Running the Benchmarks

To run all benchmarks:

```bash
pnpm run bench
```

To run a specific benchmark file:

```bash
pnpm run bench camel-case.bench.ts
pnpm run bench case-utils.bench.ts
```

## Benchmark Files

### Case Functions

Each case function has its own benchmark file for focused testing and comparison:

- `camel-case.bench.ts` - Tests camelCase conversions
- `kebab-case.bench.ts` - Tests kebab-case conversions
- `snake-case.bench.ts` - Tests snake_case conversions
- `constant-case.bench.ts` - Tests CONSTANT_CASE conversions
- `pascal-case.bench.ts` - Tests PascalCase conversions
- `title-case.bench.ts` - Tests Title Case conversions
- `train-case.bench.ts` - Tests Train-Case conversions
- `split-by-case.bench.ts` - Tests case-based string splitting
- `flat-case.bench.ts` - Tests flatcase conversions
- `dot-case.bench.ts` - Tests dot.case conversions
- `sentence-case.bench.ts` - Tests Sentence case conversions
- `flip-case.bench.ts` - Tests fLiP cAsE conversions
- `no-case.bench.ts` - Tests no case conversions
- `pascal-snake-case.bench.ts` - Tests Pascal_Snake_Case conversions
- `capital-case.bench.ts` - Tests Capital Case conversions
- `upper-first.bench.ts` - Tests upperFirst conversions
- `lower-first.bench.ts` - Tests lowerFirst conversions

### Utilities

- `case-utils.bench.ts` - Tests case utility functions (toLowerCase, toUpperCase)
- `test-strings.ts` - Shared test data used across all benchmarks

## Test Categories

Each case function benchmark includes tests for:

1. Standard Case Conversions

    - Basic string transformations
    - Cache effectiveness
    - Comparison with other libraries

2. Special Character Handling

    - ANSI escape sequences
    - Emoji characters
    - Unicode characters

3. Acronym Handling
    - Common programming acronyms (XML, API, etc.)
    - Custom acronym lists
    - Mixed case acronyms

## Library Comparisons

Benchmarks compare Visulima against:

- Lodash (where available)
- Scule
- change-case
- case-anything
- Native JavaScript methods

## Performance Characteristics

The Visulima implementations are optimized for:

1. Cached Operations

    - Efficient handling of repeated strings
    - Limited cache size to prevent memory issues

2. Special Cases

    - ANSI escape sequences
    - Emoji characters
    - Locale-aware operations
    - Acronym preservation

3. Edge Cases
    - Mixed case strings
    - Multiple separators
    - Leading/trailing separators
    - Empty strings

## Notes

- All benchmarks use Vitest's bench utilities
- Test data is shared via `test-strings.ts`
- Each benchmark can be run independently
- Cache behavior is tested with both cold and warm caches
- Special focus on real-world use cases and edge cases
