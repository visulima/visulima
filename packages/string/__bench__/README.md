# String Benchmarks

This directory contains benchmarks comparing the performance of Visulima string functions against various popular libraries.

## Running the Benchmarks

To run all benchmarks:

```bash
pnpm run test:bench
```

To run a specific benchmark file:

```bash
pnpm run test:bench case/camel-case.bench.ts
pnpm run test:bench string-width.bench.ts
```

## Benchmark Files

### Case Conversion

Compares performance against lodash, case-anything, scule, and change-case:

- `case/camel-case.bench.ts` - camelCase conversion
- `case/capital-case.bench.ts` - Capital Case conversion
- `case/constant-case.bench.ts` - CONSTANT_CASE conversion
- `case/dot-case.bench.ts` - dot.case conversion
- `case/flat-case.bench.ts` - flatcase conversion
- `case/flip-case.bench.ts` - fLiP cAsE conversion
- `case/kebab-case.bench.ts` - kebab-case conversion
- `case/lower-first.bench.ts` - lowerFirst conversion
- `case/no-case.bench.ts` - no case conversion
- `case/pascal-case.bench.ts` - PascalCase conversion
- `case/pascal-snake-case.bench.ts` - Pascal_Snake_Case conversion
- `case/sentence-case.bench.ts` - Sentence case conversion
- `case/snake-case.bench.ts` - snake_case conversion
- `case/split-by-case.bench.ts` - Case-based string splitting
- `case/title-case.bench.ts` - Title Case conversion
- `case/train-case.bench.ts` - Train-Case conversion
- `case/upper-first.bench.ts` - upperFirst conversion

### String Manipulation

Compares performance against various specialized libraries:

- `outdent.bench.ts` - Outdent/dedent with caching vs alternatives
- `slice.bench.ts` - ANSI-aware string slicing vs ansi-slice
- `string-width.bench.ts` - String width calculation vs string-width
- `string-truncated-width.bench.ts` - Truncated width calculation vs fast-string-truncated-width
- `truncate.bench.ts` - String truncation vs cli-truncate and ansi-truncate
- `word-wrap.bench.ts` - Word wrapping performance

## Test Categories

Each benchmark includes tests for:

### String Cases

- Basic transformations
- Cache effectiveness (where applicable)
- Special character handling (ANSI, emoji, Unicode)
- Acronym handling (XML, API, etc.)

### String Manipulation

- ANSI escape sequences
- Unicode characters
- Multi-byte characters
- Whitespace handling
- Edge cases (empty strings, special characters)

## Library Comparisons

Benchmarks compare against popular alternatives:

### Case Conversion

- Lodash
- Scule
- change-case
- case-anything

### String Manipulation

- string-width
- fast-string-truncated-width
- cli-truncate
- ansi-truncate
- ansi-slice

## Performance Characteristics

The implementations are optimized for:

1. Efficient Operations

    - Smart caching for repeated operations
    - Optimized string handling
    - Memory-efficient processing

2. Special Cases

    - ANSI escape sequences
    - Unicode/emoji support
    - Multi-byte characters
    - Whitespace preservation

3. Edge Cases
    - Empty strings
    - Mixed character types
    - Boundary conditions
    - Invalid inputs

### Slugify

Compares performance against:

- [@visulima/string](https://github.com/visulima/packages/tree/main/packages/string) (this package)
- [@sindresorhus/slugify](https://github.com/sindresorhus/slugify)
- [slugify (simov)](https://github.com/simov/slugify)
- [transliteration](https://github.com/yf-hk/transliteration/tree/main)
- [slug](https://www.npmjs.com/package/slug)

The `slug` package is benchmarked for default behavior, separator (using the `replacement` option), and case (using the `lower` option). It is included in all relevant feature blocks for a comprehensive comparison.

Benchmark file: `slugify.bench.ts`

### Transliterate

Compares performance against:

- [@visulima/string](https://github.com/visulima/packages/tree/main/packages/string) (this package)
- [transliteration](https://github.com/yf-hk/transliteration/tree/main)
- [slug](https://www.npmjs.com/package/slug) (where applicable)

Benchmarks focus on the speed and accuracy of converting non-ASCII characters to their closest ASCII equivalents. Each library is tested with a variety of scripts and edge cases.

Benchmark file: `transliterate.bench.ts`

## Notes

- Built with Vitest's bench utilities
- Shared test data in `__fixtures__/test-strings.ts`
- Individual benchmark execution supported
- Comprehensive edge case coverage
