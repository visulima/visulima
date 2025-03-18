<div align="center">
  <h3>visulima string</h3>
  <p>
  A robust string manipulation library providing utilities for common string operations with support for multiple languages.
  </p>
</div>

<br />

<div align="center">

[![typescript-image]][typescript-url] [![npm-image]][npm-url] [![license-image]][license-url]

</div>

---

<div align="center">
    <p>
        <sup>
            Daniel Bannert's open source work is supported by the community on <a href="https://github.com/sponsors/prisis">GitHub Sponsors</a>
        </sup>
    </p>
</div>

## Features

### Case Conversion
- **Multiple Case Styles**:
  - `camelCase`: Convert to camelCase style
  - `PascalCase`: Convert to PascalCase style
  - `snake_case`: Convert to snake_case style
  - `kebab-case`: Convert to kebab-case style
  - `CONSTANT_CASE`: Convert to CONSTANT_CASE style
  - `dot.case`: Convert to dot.case style
  - `path/case`: Convert to path/case style
  - `Sentence case`: Convert to Sentence case style
  - `Title Case`: Convert to Title Case with smart minor word handling

### String Manipulation
- **Smart String Splitting**:
  - Split by case transitions (camelCase → ["camel", "Case"])
  - Split by script boundaries (日本語Text → ["日本語", "Text"])
  - Split by separators (foo-bar → ["foo", "bar"])
  - Preserve known acronyms (XMLHttpRequest → ["XML", "Http", "Request"])
- **Text Indentation**:
  - `outdent`: Remove leading indentation while preserving relative indentation
  - Handles template literals and string inputs
  - Normalizes newlines across platforms
  - Configurable trimming behavior
- **String Width Calculation**:
  - `getStringWidth`: Calculate visual width of strings with Unicode support
  - `getStringTruncatedWidth`: Width calculation with smart truncation
  - Handles CJK characters, emojis, ANSI codes, and more
  - Configurable character width settings
  - Support for zero-width and combining characters
  - Customizable truncation with ellipsis

### Multi-Script Support
- **CJK Scripts**:
  - Japanese (Hiragana, Katakana, Kanji)
  - Korean (Hangul)
  - Chinese (Han characters)
- **European Scripts**:
  - Cyrillic (Russian, Ukrainian, etc.)
  - Greek
  - Latin (with extended characters)
- **RTL Scripts**:
  - Arabic
  - Hebrew
- **Indic Scripts**:
  - Devanagari
  - Bengali
  - Tamil
  - And more...
- **Southeast Asian**:
  - Thai
  - Lao
  - Khmer

### Enhanced Type Safety
- **Native String Type Extensions**:
  - Type-safe string operations
  - Compile-time type checking
  - Improved IDE support
- **Generic Type Parameters**:
  - Flexible type constraints
  - Template literal type support
  - Conditional type inference

### Performance Features
- **Optimized Processing**:
  - Precompiled regex patterns
  - Efficient string manipulation
- **Caching Mechanisms**:
  - Smart caching for repeated operations
  - WeakMap-based caching for template literals
  - Configurable cache options
  - Fast paths for common cases
- **Memory Efficiency**:
  - Minimal string allocations
  - Efficient string splitting
  - Optimized concatenation

### Developer Experience
- **Comprehensive API**:
  - Consistent method signatures
  - Chainable operations
  - Flexible configuration options
- **Robust Error Handling**:
  - Graceful handling of edge cases
  - Clear error messages
  - Type-safe error prevention
- **Full TypeScript Support**:
  - Complete type definitions
  - IntelliSense support
  - Type inference

---

## Install

```sh
npm install @visulima/string
```

```sh
yarn add @visulima/string
```

```sh
pnpm add @visulima/string
```

## Usage

### Outdent (Remove Indentation)

The `outdent` function removes leading indentation from multi-line strings while preserving the relative indentation structure.

```typescript
import { outdent } from '@visulima/string';

// Basic usage with template literals
const text = outdent`
    This text will have its indentation removed
    while preserving relative indentation.
        This line will still be indented relative to the others.
`;

// Output:
// This text will have its indentation removed
// while preserving relative indentation.
//     This line will still be indented relative to the others.

// With string input
const result = outdent.string('
    Hello
    World
');
// Output: "Hello\nWorld"

// With custom options
const customOutdent = outdent({
  trimLeadingNewline: false,  // Keep the leading newline
  trimTrailingNewline: false, // Keep the trailing newline
  newline: '\r\n',           // Normalize all newlines to CRLF
  cache: true                 // Enable caching (default)
});

// Using with interpolation
const name = 'World';
const greeting = outdent`
    Hello ${name}!
    Welcome to outdent.
`;
```

#### Performance Optimization with Caching

The `outdent` function supports caching to improve performance when the same template is used multiple times:

```typescript
// Default behavior - caching enabled
const dedent = outdent();

// Disable caching if memory usage is a concern
const noCacheDedent = outdent({ cache: false });

// Use a custom cache store (advanced usage)
const customCache = new WeakMap();
const customCacheDedent = outdent({ cacheStore: customCache });
```

### Word Wrapping

The `wordWrap` function provides flexible text wrapping with support for ANSI color codes and Unicode.

```typescript
import { wordWrap, WrapMode } from '@visulima/string';

// Basic usage with default options (80 character width, preserve words)
const wrapped = wordWrap('This is a long text that will be wrapped to fit within the specified width limit.');

// With custom width (40 characters)
const narrowWrapped = wordWrap('This text will be wrapped to fit within a 40-character width.', { width: 40 });

// Different wrapping modes
const preserveWords = wordWrap('Long words will stay intact but may exceed the width limit.', {
  width: 20,
  wrapMode: WrapMode.PRESERVE_WORDS // Default - keeps words intact
});

const breakAtCharacters = wordWrap('Words will be broken at character boundaries to fit width.', {
  width: 20,
  wrapMode: WrapMode.BREAK_AT_CHARACTERS // Breaks words to fit width exactly
});

const strictWidth = wordWrap('Text will be broken exactly at the width limit.', {
  width: 20,
  wrapMode: WrapMode.STRICT_WIDTH // Forces strict adherence to width
});

// Handling ANSI color codes
const coloredText = '\u001B[31mThis red text\u001B[0m will be wrapped while preserving the color codes.';
const wrappedColored = wordWrap(coloredText, { width: 20 });
// Color codes are preserved across line breaks

// Additional options
const customWrapped = wordWrap('Text with\u200Bzero-width characters and\u200Btrailing spaces.', {
  width: 30,
  trim: false, // Don't trim whitespace from lines (default: true)
  removeZeroWidthCharacters: false // Don't remove zero-width characters (default: true)
});
```

### String Splitting

The `splitByCase` function is a powerful utility that splits strings based on various patterns:

```typescript
import { splitByCase } from '@visulima/string';

// Basic Case Transitions
splitByCase('camelCase');               // ['camel', 'Case']
splitByCase('PascalCase');              // ['Pascal', 'Case']
splitByCase('snake_case');              // ['snake', 'case']
splitByCase('kebab-case');              // ['kebab', 'case']

// Numbers and Acronyms
splitByCase('XMLHttpRequest');          // ['XML', 'Http', 'Request']
splitByCase('iOS8');                    // ['i', 'OS', '8']
splitByCase('IPv6Address');             // ['IP', 'v6', 'Address']

// Multi-Script Support

// Japanese
splitByCase('ひらがなカタカナABC', { locale: 'ja' });
// ['ひらがな', 'カタカナ', 'ABC']

// Korean
splitByCase('한글Text', { locale: 'ko' });
// ['한글', 'Text']

// Chinese
splitByCase('中文Text', { locale: 'zh' });
// ['中文', 'Text']

// Cyrillic
splitByCase('русскийText', { locale: 'ru' });
// ['русский', 'Text']

// Greek
splitByCase('ελληνικάText', { locale: 'el' });
// ['ελληνικά', 'Text']

// Advanced Options
splitByCase('MyXMLParser', {
    knownAcronyms: ['XML'],              // Preserve known acronyms
    normalize: true,                     // Normalize case
    locale: 'en'                         // Specify locale
});
// ['My', 'XML', 'Parser']

// ANSI and Emoji Handling
splitByCase('🎉HappyBirthday🎂', {
    handleEmoji: true                    // Handle emoji boundaries
});
// ['🎉', 'Happy', 'Birthday', '🎂']
```

### Case Conversion Functions

#### camelCase

Converts a string to camelCase.

```typescript
camelCase('foo bar');           // 'fooBar'
camelCase('foo-bar');           // 'fooBar'
camelCase('foo_bar');           // 'fooBar'
camelCase('XMLHttpRequest');     // 'xmlHttpRequest'
camelCase('AJAXRequest');       // 'ajaxRequest'
camelCase('QueryXML123String'); // 'queryXml123String'
```

#### pascalCase

Converts a string to PascalCase.

```typescript
pascalCase('foo bar');           // 'FooBar'
pascalCase('foo-bar');           // 'FooBar'
pascalCase('foo_bar');           // 'FooBar'
pascalCase('XMLHttpRequest');     // 'XmlHttpRequest'
pascalCase('AJAXRequest');       // 'AjaxRequest'
pascalCase('QueryXML123String'); // 'QueryXml123String'
```

#### snakeCase

Converts a string to snake_case.

```typescript
snakeCase('fooBar');             // 'foo_bar'
snakeCase('foo bar');            // 'foo_bar'
snakeCase('foo-bar');            // 'foo_bar'
snakeCase('XMLHttpRequest');      // 'xml_http_request'
snakeCase('AJAXRequest');        // 'ajax_request'
snakeCase('QueryXML123String');  // 'query_xml_123_string'
```

#### kebabCase

Converts a string to kebab-case.

```typescript
kebabCase('fooBar');             // 'foo-bar'
kebabCase('foo bar');            // 'foo-bar'
kebabCase('foo_bar');            // 'foo-bar'
kebabCase('XMLHttpRequest');      // 'xml-http-request'
kebabCase('AJAXRequest');        // 'ajax-request'
kebabCase('QueryXML123String');  // 'query-xml-123-string'
```

#### titleCase

Converts a string to Title Case, with smart handling of minor words.

```typescript
titleCase('this-IS-aTitle');      // 'This is a Title'
titleCase('XMLHttpRequest');      // 'XML Http Request'
titleCase('AJAXRequest');        // 'AJAX Request'
titleCase('QueryXML123String');  // 'Query XML 123 String'
```

#### pathCase

Converts a string to path/case.

```typescript
pathCase('foo bar');             // 'foo/bar'
pathCase('foo-bar');             // 'foo/bar'
pathCase('foo_bar');             // 'foo/bar'
pathCase('XMLHttpRequest');      // 'xml/http/request'
pathCase('AJAXRequest');        // 'ajax/request'
pathCase('QueryXML123String');  // 'query/xml/123/string'
```

#### dotCase

Converts a string to dot.case.

```typescript
dotCase('foo bar');             // 'foo.bar'
dotCase('foo-bar');             // 'foo.bar'
dotCase('foo_bar');             // 'foo.bar'
dotCase('XMLHttpRequest');      // 'xml.http.request'
dotCase('AJAXRequest');        // 'ajax.request'
dotCase('QueryXML123String');  // 'query.xml.123.string'
```

#### constantCase

Converts a string to CONSTANT_CASE.

```typescript
constantCase('foo bar');             // 'FOO_BAR'
constantCase('foo-bar');             // 'FOO_BAR'
constantCase('foo_bar');             // 'FOO_BAR'
constantCase('XMLHttpRequest');      // 'XML_HTTP_REQUEST'
constantCase('AJAXRequest');        // 'AJAX_REQUEST'
constantCase('QueryXML123String');  // 'QUERY_XML_123_STRING'
```

#### sentenceCase

Converts a string to Sentence case.

```typescript
sentenceCase('foo bar');             // 'Foo bar'
sentenceCase('foo-bar');             // 'Foo bar'
sentenceCase('foo_bar');             // 'Foo bar'
sentenceCase('XMLHttpRequest');      // 'Xml http request'
sentenceCase('AJAXRequest');        // 'Ajax request'
sentenceCase('QueryXML123String');  // 'Query xml 123 string'
```

### String Width Calculation

The package provides two functions for calculating string widths: `getStringWidth` for basic width calculation and `getStringTruncatedWidth` for width calculation with truncation support.

#### Basic Width Calculation

The `getStringWidth` function calculates the visual width of strings, taking into account various Unicode characters, emojis, ANSI escape codes, and more:

```typescript
import { getStringWidth } from '@visulima/string';

// Basic usage
getStringWidth('hello');               // => 5
getStringWidth('👋 hello');            // => 7 (emoji is width 2)
getStringWidth('あいう');               // => 6 (each character is width 2)

// With custom options
getStringWidth('hello', { regularWidth: 2 });  // => 10
getStringWidth('あいう', { ambiguousIsNarrow: true }); // => 3

// ANSI escape codes
getStringWidth('\u001B[31mRed\u001B[39m');  // => 3
getStringWidth('\u001B[31mRed\u001B[39m', { countAnsiEscapeCodes: true }); // => 11

// Advanced Unicode support
getStringWidth('한글');  // => 4 (Korean characters)
getStringWidth('你好');  // => 4 (Chinese characters)
getStringWidth('👨‍👩‍👧‍👦');  // => 2 (family emoji with ZWJ sequences)
```

#### Configuration Options

```typescript
interface StringWidthOptions {
    ambiguousIsNarrow?: boolean;    // Treat ambiguous-width characters as narrow
    ambiguousWidth?: number;        // Width of ambiguous-width characters (default: 1)
    ansiWidth?: number;             // Width of ANSI escape sequences (default: 0)
    controlWidth?: number;          // Width of control characters (default: 0)
    countAnsiEscapeCodes?: boolean; // Include ANSI escape codes in width (default: false)
    emojiWidth?: number;            // Width of emoji characters (default: 2)
    fullWidth?: number;        // Width of full-width characters (default: 2)
    regularWidth?: number;          // Width of regular characters (default: 1)
    tabWidth?: number;              // Width of tab characters (default: 8)
    wideWidth?: number;             // Width of wide characters (default: 2)
}
```

#### Width Calculation with Truncation

The `getStringTruncatedWidth` function extends the basic width calculation with truncation support:

```typescript
import { getStringTruncatedWidth } from '@visulima/string';

// Basic truncation
getStringTruncatedWidth('hello world', {
    limit: 8,
    ellipsis: '...'
}); // => { width: 8, truncated: true, ellipsed: true, index: 5 }

// Custom character widths with truncation
getStringTruncatedWidth('あいうえお', {
    limit: 6,
    ellipsis: '...',
    fullWidth: 2
}); // => { width: 6, truncated: true, ellipsed: true, index: 2 }

// ANSI codes with truncation
getStringTruncatedWidth('\u001B[31mRed Text\u001B[39m', {
    limit: 5,
    ellipsis: '...',
    countAnsiEscapeCodes: true
}); // => { width: 5, truncated: true, ellipsed: true, index: 4 }

// Complex Unicode with truncation
getStringTruncatedWidth('👨‍👩‍👧‍👦 Family', {
    limit: 7,
    ellipsis: '...'
}); // => { width: 7, truncated: true, ellipsed: true, index: 11 }
```

#### Truncation Options

```typescript
interface StringTruncatedWidthOptions extends StringWidthOptions {
    // Truncation-specific options
    ellipsis?: string;           // String to append when truncation occurs (default: '')
    ellipsisWidth?: number;      // Width of ellipsis, auto-calculated if not provided
    limit?: number;              // Maximum width limit for the string (default: Infinity)
}

// Return value structure
interface StringTruncatedWidthResult {
    width: number;      // The calculated visual width of the string
    truncated: boolean; // Whether the string was truncated
    ellipsed: boolean; // Whether an ellipsis was added
    index: number;     // The index at which truncation occurred (if any)
}
```

### Common Options

All case conversion functions accept these common options:

```typescript
interface CaseOptions {
    // Enable caching for better performance
    cache?: boolean;

    // Maximum size of the cache (default: 1000)
    cacheMaxSize?: number;

    // Custom cache store
    cacheStore?: Map<string, string>;

    // Known acronyms to preserve
    knownAcronyms?: ReadonlyArray<string>;

    // Locale for script-aware case conversion
    locale?: string;
}
```

### String Splitting

The `splitByCase` function accepts these configuration options:

```typescript
interface SplitOptions {
    // Locale for script-aware splitting (e.g., 'ja', 'ko', 'zh')
    locale?: string;

    // Known acronyms to preserve (e.g., ['XML', 'HTTP'])
    knownAcronyms?: ReadonlyArray<string>;

    // Handle ANSI escape sequences
    handleAnsi?: boolean;

    // Handle emoji sequences
    handleEmoji?: boolean;

    // Normalize case (convert all-upper tokens to title case)
    normalize?: boolean;

    // Custom separators (string[] or RegExp)
    separators?: ReadonlyArray<string> | RegExp;

    // Strip ANSI sequences
    stripAnsi?: boolean;

    // Strip emoji sequences
    stripEmoji?: boolean;
}
```

### Supported Scripts

The library provides comprehensive support for various scripts and writing systems:

- **Latin**: Standard ASCII and extended Latin characters
- **CJK**:
  - Japanese (Hiragana, Katakana, Kanji)
  - Korean (Hangul)
  - Chinese (Han characters)
- **Cyrillic**: Russian, Ukrainian, Bulgarian, etc.
- **Greek**: Modern Greek script
- **RTL Scripts**: Arabic, Hebrew
- **Indic Scripts**: Devanagari, Bengali, Tamil, etc.
- **Southeast Asian**: Thai, Lao, Khmer

### Performance Optimization

The library includes several optimizations:

- Precompiled regex patterns for script detection
- Fast paths for single-script strings
- Efficient handling of case transitions
- Smart caching of character type checks

### Error Handling

The library handles various edge cases gracefully:

```typescript
// Empty strings
splitByCase('');  // []

// Invalid input
splitByCase(null);        // []
splitByCase(undefined);   // []

// Single characters
splitByCase('A');  // ['A']

// All uppercase
splitByCase('URL', { knownAcronyms: ['URL'] });  // ['URL']
```

### Native String Types

The library provides enhanced TypeScript type definitions for native string methods. These types provide better type inference and compile-time checks.

#### Configuration

Configure your `tsconfig.json` file to include the types:

```json
{
    "compilerOptions": {
        "types": ["@visulima/string/native-string-types"]
    }
}
```

Alternatively, you can add a triple-slash reference in your TypeScript files:

```typescript
/// <reference types="@visulima/string/native-string-types" />
```

#### Usage Examples


```typescript
// Type-safe string operations
const str = 'Hello, World!';

// charAt with type inference
str.charAt<typeof str, 0>();  // type: 'H'
str.charAt<typeof str, 1>();  // type: 'e'

// concat with type inference
str.concat<typeof str, 'Hi'>(); // type: 'Hello, World!Hi'

// endsWith with literal type checking
str.endsWith<typeof str, 'World!'>(); // type: true
str.endsWith<typeof str, 'Hello'>(); // type: false

// includes with position
str.includes<typeof str, 'World', 0>(); // type: true
str.includes<typeof str, 'World', 7>(); // type: false

// length with type inference
type Length = typeof str['length']; // type: 13

// padStart/padEnd with type inference
str.padStart<typeof str, 15, '_'>(); // type: '_Hello, World!'
str.padEnd<typeof str, 15, '_'>();   // type: 'Hello, World!__'

// replace with type inference
str.replace<typeof str, 'World', 'TypeScript'>(); // type: 'Hello, TypeScript!'

// replaceAll with type inference
str.replaceAll<typeof str, 'l', 'L'>(); // type: 'HeLLo, WorLd!'

// slice with type inference
str.slice<typeof str, 0, 5>();  // type: 'Hello'

// split with type inference
str.split<typeof str, ', '>();  // type: ['Hello', 'World!']

// startsWith with type inference
str.startsWith<typeof str, 'Hello'>(); // type: true

// toLowerCase/toUpperCase with type inference
str.toLowerCase<typeof str>();  // type: 'hello, world!'
str.toUpperCase<typeof str>();  // type: 'HELLO, WORLD!'

// trim/trimStart/trimEnd with type inference
const paddedStr = '  hello  ';
paddedStr.trim<typeof paddedStr>();      // type: 'hello'
paddedStr.trimStart<typeof paddedStr>(); // type: 'hello  '
paddedStr.trimEnd<typeof paddedStr>();   // type: '  hello'
```

These enhanced types provide several benefits:

1. **Compile-Time Type Safety**:
   - Catch type errors before runtime
   - Get accurate type inference for method results
   - Validate string operations at compile time

2. **Better IDE Support**:
   - Improved autocompletion
   - More accurate type hints
   - Better refactoring support

3. **Type-Level String Manipulation**:
   - Perform string operations at the type level
   - Get literal type results for string operations
   - Chain operations with type safety

4. **Advanced Type Features**:
   - Generic type parameters for flexible usage
   - Conditional type inference
   - Template literal type support

```typescript
// Example of chaining operations with type safety
const result = 'Hello, World!'
    .toLowerCase<string>()
    .replace<string, 'hello', 'hi'>()
    .split<string, ' '>()
    .join('-');

// TypeScript knows the exact type at each step
```

## Testing Utilities

The package includes specialized utilities for testing ANSI colored strings, making it easier to write tests for terminal output and colored text.

### ANSI String Formatting and Comparison

The `formatAnsiString` function helps format ANSI strings for test output, providing multiple representations:

```typescript
import { formatAnsiString } from '@visulima/string/test/utils';
import { red } from '@visulima/colorize';

const coloredText = red('Error message');
const formatted = formatAnsiString(coloredText);

// Returns an object with:
// - ansi: Original string with ANSI codes
// - stripped: String with ANSI codes removed
// - visible: String with escape codes shown as visible characters
// - json: JSON stringified version
// - lengthDifference: Difference between ANSI and stripped length
```

### Comparing ANSI Strings

The `compareAnsiStrings` function provides detailed comparison between two ANSI strings:

```typescript
import { compareAnsiStrings } from '@visulima/string/test/utils';
import { red, blue } from '@visulima/colorize';

const string1 = red('Error');
const string2 = blue('Error');

const result = compareAnsiStrings(string1, string2);
// Returns comparison details including:
// - ansiEqual: Whether the strings are identical including ANSI codes
// - strippedEqual: Whether the visible content is the same
// - summary: Length information and comparison results
// - actual/expected: Formatted representations of both strings
```

### Vitest Integration

The package includes a custom matcher for [Vitest](https://vitest.dev/) that makes testing ANSI strings straightforward:

```typescript
import { expect, describe, it } from 'vitest';
import { toEqualAnsi } from '@visulima/string/test/vitest';
import { red, green } from '@visulima/colorize';

// Extend Vitest with the custom matcher
expect.extend({ toEqualAnsi });

describe('colored output tests', () => {
  it('should display the correct error message', () => {
    const actual = getErrorMessage(); // Returns colored string
    const expected = red('Error: ') + green('File not found');

    // Compare ANSI strings with detailed error messages on failure
    expect(actual).toEqualAnsi(expected);
  });
});
```

The custom matcher provides detailed error messages when tests fail, showing:
- The visible content of both strings
- The ANSI escape codes in both strings
- Whether the visible content matches but the colors differ
- Length information for both strings

## Related

- [change-case](https://github.com/blakeembrey/change-case) - Simple string case utilities
- [lodash](https://lodash.com/) - Comprehensive utility library with string manipulation
- [scule](https://github.com/unjs/scule) - 🧵 String Case Utils
- [case-anything](https://github.com/mesqueeb/case-anything) - camelCase, kebab-case, PascalCase... a simple integration with nano package size. (SMALL footprint!)

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help, take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

-   [Daniel Bannert](https://github.com/prisis)
-   [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima string is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/ "TypeScript"
[license-image]: https://img.shields.io/npm/l/@visulima/string?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/string/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/string/v/latest "npm"
