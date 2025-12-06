<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="string" />

</a>

<h3 align="center">Functions for manipulating strings.</h3>

<!-- END_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<br />

<div align="center">

[![typescript-image][typescript-badge]][typescript-url]
[![mit licence][license-badge]][license]
[![npm downloads][npm-downloads-badge]][npm-downloads]
[![Chat][chat-badge]][chat]
[![PRs Welcome][prs-welcome-badge]][prs-welcome]

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
import { wordWrap, WrapMode } from "@visulima/string";

// Basic usage with default options (80 character width, preserve words)
const wrapped = wordWrap("This is a long text that will be wrapped to fit within the specified width limit.");

// With custom width (40 characters)
const narrowWrapped = wordWrap("This text will be wrapped to fit within a 40-character width.", { width: 40 });

// Different wrapping modes
const preserveWords = wordWrap("Long words will stay intact but may exceed the width limit.", {
    width: 20,
    wrapMode: WrapMode.PRESERVE_WORDS, // Default - keeps words intact
});

const breakAtCharacters = wordWrap("Words will be broken at character boundaries to fit width.", {
    width: 20,
    wrapMode: WrapMode.BREAK_AT_CHARACTERS, // Breaks words to fit width exactly
});

const strictWidth = wordWrap("Text will be broken exactly at the width limit.", {
    width: 20,
    wrapMode: WrapMode.STRICT_WIDTH, // Forces strict adherence to width
});

// Handling ANSI color codes
const coloredText = "\u001B[31mThis red text\u001B[0m will be wrapped while preserving the color codes.";
const wrappedColored = wordWrap(coloredText, { width: 20 });
// Color codes are preserved across line breaks

// Additional options
const customWrapped = wordWrap("Text with\u200Bzero-width characters and\u200Btrailing spaces.", {
    width: 30,
    trim: false, // Don't trim whitespace from lines (default: true)
    removeZeroWidthCharacters: false, // Don't remove zero-width characters (default: true)
});
```

### String Replacement with Ignore Ranges

The `replaceString` function provides advanced string replacement capabilities, allowing multiple search/replace operations (using strings or RegExps) while respecting specified index ranges that should be ignored. It also handles match precedence correctly (earlier start index wins, then longer match wins if starts are identical) and ensures only the highest-priority, non-overlapping, non-ignored match is applied in any given segment.

> **Note:** Use this function when you need fine-grained control over multiple replacements, especially when needing to ignore specific index ranges or handle complex overlapping matches with defined precedence rules. For simple, non-overlapping replacements without ignore ranges, native `String.prototype.replaceAll` might be sufficient.

```typescript
import replaceString from "@visulima/string/replace-string"; // Adjust import path if needed
import type { IntervalArray, OptionReplaceArray } from "@visulima/string";

// Basic Usage
const source1 = "Replace AB and CD";
const searches1: OptionReplaceArray = [
    ["AB", "ab"],
    ["CD", "cd"],
];
const result1 = replaceString(source1, searches1, []);
// result1: "Replace ab and cd"

// With Ignore Ranges
const source2 = "Replace AB and ignore CD and replace XY";
const searches2: OptionReplaceArray = [
    ["AB", "ab"],
    ["CD", "cd"], // This should be ignored by the range
    ["XY", "xy"],
];
// Ignore indices 19-20 (targets "re" in "ignore")
const ignoreRanges2: IntervalArray = [[19, 20]];
const result2 = replaceString(source2, searches2, ignoreRanges2);
// result2: "Replace ab and ignore cd and replace xy"
// Note: "CD" is replaced because it doesn't overlap the ignore range [19, 20].

// With Overlapping Matches (Longer match takes precedence)
const source3 = "abcde";
const searches3: OptionReplaceArray = [
    ["abc", "123"], // Lower precedence
    ["abcde", "54321"], // Higher precedence (longer)
];
const result3 = replaceString(source3, searches3, []);
// result3: "54321"

// With Overlapping Matches (Earlier start index takes precedence)
const source4 = "ababab";
const searches4: OptionReplaceArray = [
    ["aba", "X"], // Starts at 0
    ["bab", "Y"], // Starts at 1
];
const result4 = replaceString(source4, searches4, []);
// result4: "Xbab" (Applies "X" at 0, which covers indices 0-2. Skips "Y" at 1. Appends rest.)

// With Zero-Length Matches (e.g., inserting before each char)
const source5 = "abc";
const searches5: OptionReplaceArray = [[/(?=.)/g, "^"]]; // Lookahead for position before char
const result5 = replaceString(source5, searches5, []);
// result5: "^a^b^c"

// Zero-Length Match at End
const source6 = "abc";
const searches6: OptionReplaceArray = [[/$/g, "$"]]; // Matches end of string
const result6 = replaceString(source6, searches6, []);
// result6: "abc$"

// Using $& and $n replacements
const source7 = "Firstname Lastname";
const searches7: OptionReplaceArray = [[/(\w+)\s+(\w+)/, "$2, $1 ($& - Group 1: $1)"]];
const result7 = replaceString(source7, searches7, []);
// result7: "Lastname, Firstname (Firstname Lastname - Group 1: Firstname)"
```

### String Splitting

The `splitByCase` function is a powerful utility that splits strings based on various patterns:

```typescript
import { splitByCase } from "@visulima/string";

// Basic Case Transitions
splitByCase("camelCase"); // ['camel', 'Case']
splitByCase("PascalCase"); // ['Pascal', 'Case']
splitByCase("snake_case"); // ['snake', 'case']
splitByCase("kebab-case"); // ['kebab', 'case']

// Numbers and Acronyms
splitByCase("XMLHttpRequest"); // ['XML', 'Http', 'Request']
splitByCase("iOS8"); // ['i', 'OS', '8']
splitByCase("IPv6Address"); // ['IP', 'v6', 'Address']

// Multi-Script Support

// Japanese
splitByCase("ひらがなカタカナABC", { locale: "ja" });
// ['ひらがな', 'カタカナ', 'ABC']

// Korean
splitByCase("한글Text", { locale: "ko" });
// ['한글', 'Text']

// Chinese
splitByCase("中文Text", { locale: "zh" });
// ['中文', 'Text']

// Cyrillic
splitByCase("русскийText", { locale: "ru" });
// ['русский', 'Text']

// Greek
splitByCase("ελληνικάText", { locale: "el" });
// ['ελληνικά', 'Text']

// Advanced Options
splitByCase("MyXMLParser", {
    knownAcronyms: ["XML"], // Preserve known acronyms
    normalize: true, // Normalize case
    locale: "en", // Specify locale
});
// ['My', 'XML', 'Parser']

// ANSI and Emoji Handling
splitByCase("🎉HappyBirthday🎂", {
    handleEmoji: true, // Handle emoji boundaries
});
// ['🎉', 'Happy', 'Birthday', '🎂']
```

### Case Conversion Functions

#### camelCase

Converts a string to camelCase.

```typescript
camelCase("foo bar"); // 'fooBar'
camelCase("foo-bar"); // 'fooBar'
camelCase("foo_bar"); // 'fooBar'
camelCase("XMLHttpRequest"); // 'xmlHttpRequest'
camelCase("AJAXRequest"); // 'ajaxRequest'
camelCase("QueryXML123String"); // 'queryXml123String'
```

#### pascalCase

Converts a string to PascalCase.

```typescript
pascalCase("foo bar"); // 'FooBar'
pascalCase("foo-bar"); // 'FooBar'
pascalCase("foo_bar"); // 'FooBar'
pascalCase("XMLHttpRequest"); // 'XmlHttpRequest'
pascalCase("AJAXRequest"); // 'AjaxRequest'
pascalCase("QueryXML123String"); // 'QueryXml123String'
```

#### snakeCase

Converts a string to snake_case.

```typescript
snakeCase("fooBar"); // 'foo_bar'
snakeCase("foo bar"); // 'foo_bar'
snakeCase("foo-bar"); // 'foo_bar'
snakeCase("XMLHttpRequest"); // 'xml_http_request'
snakeCase("AJAXRequest"); // 'ajax_request'
snakeCase("QueryXML123String"); // 'query_xml_123_string'
```

#### kebabCase

Converts a string to kebab-case.

```typescript
kebabCase("fooBar"); // 'foo-bar'
kebabCase("foo bar"); // 'foo-bar'
kebabCase("foo_bar"); // 'foo-bar'
kebabCase("XMLHttpRequest"); // 'xml-http-request'
kebabCase("AJAXRequest"); // 'ajax-request'
kebabCase("QueryXML123String"); // 'query-xml-123-string'
```

#### titleCase

Converts a string to Title Case, with smart handling of minor words.

```typescript
titleCase("this-IS-aTitle"); // 'This is a Title'
titleCase("XMLHttpRequest"); // 'XML Http Request'
titleCase("AJAXRequest"); // 'AJAX Request'
titleCase("QueryXML123String"); // 'Query XML 123 String'
```

#### pathCase

Converts a string to path/case.

```typescript
pathCase("foo bar"); // 'foo/bar'
pathCase("foo-bar"); // 'foo/bar'
pathCase("foo_bar"); // 'foo/bar'
pathCase("XMLHttpRequest"); // 'xml/http/request'
pathCase("AJAXRequest"); // 'ajax/request'
pathCase("QueryXML123String"); // 'query/xml/123/string'
```

#### dotCase

Converts a string to dot.case.

```typescript
dotCase("foo bar"); // 'foo.bar'
dotCase("foo-bar"); // 'foo.bar'
dotCase("foo_bar"); // 'foo.bar'
dotCase("XMLHttpRequest"); // 'xml.http.request'
dotCase("AJAXRequest"); // 'ajax.request'
dotCase("QueryXML123String"); // 'query.xml.123.string'
```

#### constantCase

Converts a string to CONSTANT_CASE.

```typescript
constantCase("foo bar"); // 'FOO_BAR'
constantCase("foo-bar"); // 'FOO_BAR'
constantCase("foo_bar"); // 'FOO_BAR'
constantCase("XMLHttpRequest"); // 'XML_HTTP_REQUEST'
constantCase("AJAXRequest"); // 'AJAX_REQUEST'
constantCase("QueryXML123String"); // 'QUERY_XML_123_STRING'
```

#### sentenceCase

Converts a string to Sentence case.

```typescript
sentenceCase("foo bar"); // 'Foo bar'
sentenceCase("foo-bar"); // 'Foo bar'
sentenceCase("foo_bar"); // 'Foo bar'
sentenceCase("XMLHttpRequest"); // 'Xml http request'
sentenceCase("AJAXRequest"); // 'Ajax request'
sentenceCase("QueryXML123String"); // 'Query xml 123 string'
```

### String Width Calculation

The package provides two functions for calculating string widths: `getStringWidth` for basic width calculation and `getStringTruncatedWidth` for width calculation with truncation support.

#### Basic Width Calculation

The `getStringWidth` function calculates the visual width of strings, taking into account various Unicode characters, emojis, ANSI escape codes, and more:

```typescript
import { getStringWidth } from "@visulima/string";

// Basic usage
getStringWidth("hello"); // => 5
getStringWidth("👋 hello"); // => 7 (emoji is width 2)
getStringWidth("あいう"); // => 6 (each character is width 2)

// With custom options
getStringWidth("hello", { regularWidth: 2 }); // => 10
getStringWidth("あいう", { ambiguousIsNarrow: true }); // => 3

// ANSI escape codes
getStringWidth("\u001B[31mRed\u001B[39m"); // => 3
getStringWidth("\u001B[31mRed\u001B[39m", { countAnsiEscapeCodes: true }); // => 11

// Advanced Unicode support
getStringWidth("한글"); // => 4 (Korean characters)
getStringWidth("你好"); // => 4 (Chinese characters)
getStringWidth("👨‍👩‍👧‍👦"); // => 2 (family emoji with ZWJ sequences)
```

#### Configuration Options

```typescript
interface StringWidthOptions {
    ambiguousIsNarrow?: boolean; // Treat ambiguous-width characters as narrow
    ansiWidth?: number; // Width of ANSI escape sequences (default: 0)
    controlWidth?: number; // Width of control characters (default: 0)
    countAnsiEscapeCodes?: boolean; // Include ANSI escape codes in width (default: false)
    emojiWidth?: number; // Width of emoji characters (default: 2)
    fullWidth?: number; // Width of full-width characters (default: 2)
    regularWidth?: number; // Width of regular characters (default: 1)
    tabWidth?: number; // Width of tab characters (default: 8)
    wideWidth?: number; // Width of wide characters (default: 2)
}
```

#### Width Calculation with Truncation

The `getStringTruncatedWidth` function extends the basic width calculation with truncation support:

```typescript
import { getStringTruncatedWidth } from "@visulima/string";

// Basic truncation
getStringTruncatedWidth("hello world", {
    limit: 8,
    ellipsis: "...",
}); // => { width: 8, truncated: true, ellipsed: true, index: 5 }

// Custom character widths with truncation
getStringTruncatedWidth("あいうえお", {
    limit: 6,
    ellipsis: "...",
    fullWidth: 2,
}); // => { width: 6, truncated: true, ellipsed: true, index: 2 }

// ANSI codes with truncation
getStringTruncatedWidth("\u001B[31mRed Text\u001B[39m", {
    limit: 5,
    ellipsis: "...",
    countAnsiEscapeCodes: true,
}); // => { width: 5, truncated: true, ellipsed: true, index: 4 }

// Complex Unicode with truncation
getStringTruncatedWidth("👨‍👩‍👧‍👦 Family", {
    limit: 7,
    ellipsis: "...",
}); // => { width: 7, truncated: true, ellipsed: true, index: 11 }
```

### String Truncation

The `truncate` function provides a convenient way to truncate strings with support for different positions, Unicode characters, ANSI escape codes, and more.

```typescript
import { truncate } from "@visulima/string";

// Basic truncation (end position)
truncate("unicorn", 4); // => 'un…'
truncate("unicorn", 4, { position: "end" }); // => 'un…'

// Different positions
truncate("unicorn", 5, { position: "start" }); // => '…orn'
truncate("unicorn", 5, { position: "middle" }); // => 'un…n'

// With custom ellipsis
truncate("unicorns", 5, { ellipsis: "." }); // => 'unic.'
truncate("unicorns", 5, { ellipsis: " ." }); // => 'uni .'

// Smart truncation on spaces
truncate("dragons are awesome", 15, { position: "end", preferTruncationOnSpace: true }); // => 'dragons are…'
truncate("unicorns rainbow dragons", 20, { position: "middle", preferTruncationOnSpace: true }); // => 'unicorns…dragons'

// With ANSI escape codes
truncate("\u001B[31municorn\u001B[39m", 4); // => '\u001B[31mun\u001B[39m…'

// With Unicode characters
truncate("안녕하세요", 3, { width: { fullWidth: 2 } }); // => '안…'
```

#### Truncation Options

```typescript
interface TruncateOptions {
    // String to append when truncation occurs
    ellipsis?: string; // default: ''

    // Width of the ellipsis string
    // If not provided, it will be calculated using getStringTruncatedWidth
    ellipsisWidth?: number;

    // The position to truncate the string
    position?: "end" | "middle" | "start"; // default: 'end'

    // Truncate the string from a whitespace if it is within 3 characters
    // from the actual breaking point
    preferTruncationOnSpace?: boolean; // default: false

    // Width calculation options
    width?: Omit<StringTruncatedWidthOptions, "ellipsis" | "ellipsisWidth" | "limit">;
}

interface StringTruncatedWidthOptions extends StringWidthOptions {
    // Truncation-specific options
    ellipsis?: string; // String to append when truncation occurs (default: '')
    ellipsisWidth?: number; // Width of ellipsis, auto-calculated if not provided
    limit?: number; // Maximum width limit for the string (default: Infinity)
}

// Return value structure
interface StringTruncatedWidthResult {
    width: number; // The calculated visual width of the string
    truncated: boolean; // Whether the string was truncated
    ellipsed: boolean; // Whether an ellipsis was added
    index: number; // The index at which truncation occurred (if any)
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
splitByCase(""); // []

// Invalid input
splitByCase(null); // []
splitByCase(undefined); // []

// Single characters
splitByCase("A"); // ['A']

// All uppercase
splitByCase("URL", { knownAcronyms: ["URL"] }); // ['URL']
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
const str = "Hello, World!";

// charAt with type inference
str.charAt<typeof str, 0>(); // type: 'H'
str.charAt<typeof str, 1>(); // type: 'e'

// concat with type inference
str.concat<typeof str, "Hi">(); // type: 'Hello, World!Hi'

// endsWith with literal type checking
str.endsWith<typeof str, "World!">(); // type: true
str.endsWith<typeof str, "Hello">(); // type: false

// includes with position
str.includes<typeof str, "World", 0>(); // type: true
str.includes<typeof str, "World", 7>(); // type: false

// length with type inference
type Length = (typeof str)["length"]; // type: 13

// padStart/padEnd with type inference
str.padStart<typeof str, 15, "_">(); // type: '_Hello, World!'
str.padEnd<typeof str, 15, "_">(); // type: 'Hello, World!__'

// replace with type inference
str.replace<typeof str, "World", "TypeScript">(); // type: 'Hello, TypeScript!'

// replaceAll with type inference
str.replaceAll<typeof str, "l", "L">(); // type: 'HeLLo, WorLd!'

// slice with type inference
str.slice<typeof str, 0, 5>(); // type: 'Hello'

// split with type inference
str.split<typeof str, ", ">(); // type: ['Hello', 'World!']

// startsWith with type inference
str.startsWith<typeof str, "Hello">(); // type: true

// toLowerCase/toUpperCase with type inference
str.toLowerCase<typeof str>(); // type: 'hello, world!'
str.toUpperCase<typeof str>(); // type: 'HELLO, WORLD!'

// trim/trimStart/trimEnd with type inference
const paddedStr = "  hello  ";
paddedStr.trim<typeof paddedStr>(); // type: 'hello'
paddedStr.trimStart<typeof paddedStr>(); // type: 'hello  '
paddedStr.trimEnd<typeof paddedStr>(); // type: '  hello'
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
const result = "Hello, World!".toLowerCase<string>().replace<string, "hello", "hi">().split<string, " ">().join("-");

// TypeScript knows the exact type at each step
```

## Testing Utilities

The package includes specialized utilities for testing ANSI colored strings, making it easier to write tests for terminal output and colored text.

### ANSI String Formatting and Comparison

The `formatAnsiString` function helps format ANSI strings for test output, providing multiple representations:

```typescript
import { formatAnsiString } from "@visulima/string/test/utils";
import { red } from "@visulima/colorize";

const coloredText = red("Error message");
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
import { compareAnsiStrings } from "@visulima/string/test/utils";
import { red, blue } from "@visulima/colorize";

const string1 = red("Error");
const string2 = blue("Error");

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
import { expect, describe, it } from "vitest";
import { toEqualAnsi } from "@visulima/string/test/vitest";
import { red, green } from "@visulima/colorize";

// Extend Vitest with the custom matcher
expect.extend({ toEqualAnsi });

describe("colored output tests", () => {
    it("should display the correct error message", () => {
        const actual = getErrorMessage(); // Returns colored string
        const expected = red("Error: ") + green("File not found");

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

### `replaceString(source, searches, ignoreRanges?)`

Replaces occurrences of search patterns within a string, respecting ignored ranges.
This function is designed to handle overlapping matches and ignore ranges correctly.
It prioritizes matches that start earlier and, for matches starting at the same position,
prefers longer matches. Replacements within ignored ranges are skipped.

**Parameters:**

- `source`: The input string.
- `searches`: An array of search pairs. Each pair can be:
    - `[string | RegExp, string]`: A literal string or regex to search for, and its replacement string.
      Regex flags like `g` (global) are respected.
- `ignoreRanges?`: Optional. An array of `[start, end]` index pairs (inclusive) specifying ranges within the
  `source` string that should be ignored during replacement.

**Returns:**

- `string`: The string with replacements applied, respecting ignore ranges.

**Usage:**

```typescript
import { replaceString } from "@visulima/string";

const text = "abc abc abc";
const searches = [
    [/a/g, "X"],
    ["abc", "YYY"],
];
const ignoreRanges = [[4, 6]]; // Ignore the second "abc"

const result = replaceString(text, searches, ignoreRanges);
// result will be: "YYY abc YYY"
// First 'abc' is replaced by 'YYY' (longer match takes precedence over 'X').
// Second 'abc' is ignored.
// Third 'abc' is replaced by 'YYY'.
```

### `transliterate(source, options?)`

Performs transliteration of characters in a string based on an extensive character map and provided options. This function is useful for converting characters from one script to another (e.g., Latin with diacritics to basic Latin, Cyrillic to Latin) or for custom character replacements.

**Parameters:**

- `source: string`: The input string to transliterate.
- `options?`: Optional `OptionsTransliterate` object:
    - `fixChineseSpacing?: boolean`: If `true`, adds a space between transliterated Chinese Pinyin syllables. (Default: `true`).
    - `ignore?: string[]`: An array of strings or characters to ignore during transliteration. These segments will be preserved in their original form. (Default: `[]`).
    - `replaceBefore?: Array<[string | RegExp, string]> | Record<string, string>`: Custom replacement rules to apply _before_ the main character map transliteration. (Default: `[]`).
    - `replaceAfter?: Array<[string | RegExp, string]> | Record<string, string>`: Custom replacement rules to apply _after_ the main character map transliteration. (Default: `[]`).
    - `trim?: boolean`: If `true`, trims whitespace from the beginning and end of the result. (Default: `false`).
    - `unknown?: string`: The character or string to use for characters that are not found in the character map and are not covered by other rules. (Default: `""` - removes unknown characters).

**Returns:**

- `string`: The transliterated string.

**Usage:**

```typescript
import { transliterate } from "@visulima/string"; // Assuming named export from package root

// Basic transliteration
transliterate("Crème brûlée"); // Expected: 'Creme brulee'
transliterate("你好世界"); // Expected: 'Ni Hao Shi Jie' (due to fixChineseSpacing: true)
transliterate("你好世界", { fixChineseSpacing: false }); // Expected: 'NiHaoShiJie'

// Using ignore
transliterate("Don't change THIS, but change that.", { ignore: ["THIS"] });
// Expected: 'Dont change THIS, but change that.'

// Using replaceBefore
transliterate("Replace C++ before map.", { replaceBefore: { "C++": "cpp" } });
// Expected: 'Replace cpp before map.'

// Using replaceAfter
// Example: charmap turns é -> e, then replaceAfter turns e -> E
transliterate("café", { replaceAfter: { e: "E" } });
// Expected: 'cafE'

// Handling unknown characters
transliterate("a🚀b", { unknown: "[?]" }); // Expected: 'a[?]b'
```

### `slugify(input, options?)`

Converts a string into a URL-friendly slug.

It transliterates non-ASCII characters using the `transliterate` function (if enabled), optionally converts case, removes disallowed characters (replacing with separator), and collapses separators.

**Parameters:**

- `input`: The string to convert.
- `options?`: Optional `SlugifyOptions` object:
    - `allowedChars?: string`: Characters allowed in the slug. Others are replaced by `separator`. (Default: `"a-zA-Z0-9-_.~"`)
    - `fixChineseSpacing?: boolean`: Passed to `transliterate`. Determines if a space is added between transliterated Chinese characters (default: `true`).
    - `ignore?: string[]`: Passed to `transliterate`. Characters/strings to ignore during the initial transliteration phase (default: `[]`).
    - `lowercase?: boolean`: Convert to lowercase. (Default: `true`). Cannot be true if `uppercase` is true.
    - `replaceAfter?: OptionReplaceCombined`: Passed to `transliterate`. Search/replace pairs to apply _after_ the character map transliteration but _before_ slugification logic (default: `[]`).
    - `replaceBefore?: OptionReplaceCombined`: Passed to `transliterate`. Search/replace pairs to apply _before_ any transliteration (default: `[]`).
    - `separator?: string`: Custom separator. (Default: `"-"`).
    - `transliterate?: boolean`: Whether to perform the initial transliteration of non-ASCII characters. If `false`, only case conversion and character filtering/replacement are performed on the input string. (Default: `true`).
    - `unknown?: string`: Passed to `transliterate`. Character to use for unknown characters during transliteration (default: `""`).
    - `uppercase?: boolean`: Convert to uppercase. (Default: `false`). Cannot be true if `lowercase` is true.

**Returns:**

- `string`: The generated slug.

**Usage:**

```typescript
import { slugify } from "@visulima/string";

slugify("你好 World!"); // 'ni-hao-world' (fixChineseSpacing=true by default)
slugify("你好World!", { fixChineseSpacing: false }); // 'nihaoworld'
slugify("Crème Brûlée"); // 'creme-brulee'
slugify("foo & bar * baz"); // 'foo-bar-baz' (&, *, space are disallowed)
slugify("FOO BAR", { lowercase: false, uppercase: true }); // 'FOO-BAR'
slugify("foo bar baz", { separator: "_", allowedChars: "a-z_" }); // 'foo_bar_baz'
slugify("Keep C++", { replaceBefore: { "C++": "cpp" } }); // 'keep-cpp'
slugify("Keep !@#$", { allowedChars: "a-z!@$" }); // 'keep!@$'
```

### Text Alignment

The `alignText` function aligns text (including multi-line strings and strings with ANSI escape codes) to the left, center, or right. It can handle both single strings (which can be split into lines based on the `split` option) and arrays of strings.

```typescript
import { alignText } from "@visulima/string";
// For type information, you might also import:
// import type { AlignTextOptions, StringWidthOptions } from "@visulima/string";

// Example 1: Aligning a single multi-line string to the right
const text1 = "First line\nSecond, much longer line";
const alignedText1 = alignText(text1, { align: "right" });
// alignedText1 (string output, exact padding depends on calculated widths):
// "          First line\nSecond, much longer line"

// Example 2: Aligning an array of strings to the center
const textArray = ["Short", "Medium length", "A very very long line indeed"];
const alignedArray = alignText(textArray, { align: "center" });
// alignedArray (array output, exact padding depends on calculated widths):
// [
//   "           Short            ",
//   "        Medium length       ",
//   "A very very long line indeed"
// ]

// Example 3: Custom padding, split, and stringWidthOptions for emojis
const emojiText = "Line1😊*WiderLine😊😊";
const alignedEmojiText = alignText(emojiText, {
    align: "center",
    split: "*",
    pad: "-",
    stringWidthOptions: { emojiWidth: 2 } // Crucial for correct width calculation with emojis
});
// alignedEmojiText (string output, exact padding depends on calculated widths):
// "--Line1😊---\nWiderLine😊😊"
```

#### Alignment Options

The `alignText` function accepts an `options` object of type `AlignTextOptions` with the following properties:

-   `align?: "center" | "left" | "right"`: Specifies the alignment direction. Defaults to `"center"`. Note: `left` alignment primarily ensures line splitting if `text` is a single string; it doesn't typically add padding on the left unless the string was not pre-split.
-   `pad?: string`: The character or string to use for padding. Defaults to `" "`.
-   `split?: string`: The character or string used to split the input `text` into multiple lines if it's provided as a single string. Defaults to `"\n"`.
-   `stringWidthOptions?: StringWidthOptions`: Options passed to an internal string width calculation function (similar to `getStringWidth`) for determining the visual width of each line. This is important for accurately handling ANSI escape codes, CJK characters, emojis, etc. Refer to the `getStringWidth` documentation for details on `StringWidthOptions`.

## Related

- [change-case](https://github.com/blakeembrey/change-case) - Simple string case utilities
- [lodash](https://lodash.com/) - Comprehensive utility library with string manipulation
- [scule](https://github.com/unjs/scule) - 🧵 String Case Utils
- [case-anything](https://github.com/mesqueeb/case-anything) - camelCase, kebab-case, PascalCase... a simple integration with nano package size. (SMALL footprint!)
- [cli-truncate](https://github.com/sindresorhus/cli-truncate) - Truncate strings for terminal output
- [string-width](https://github.com/sindresorhus/string-width) - Measure string width
- [ansi-slice](https://github.com/sindresorhus/ansi-slice) - Slice strings with ANSI escape codes
- [fast-string-truncated-width](https://github.com/fabiospampinato/fast-string-truncated-width) - Fast string truncated width
- [ansi-truncate](https://github.com/fabiospampinato/ansi-truncate) - Truncate strings with ANSI escape codes
- [string-ts](https://github.com/gustavoguichard/string-ts) - Strongly typed string functions
- [@sindresorhus/slugify](https://github.com/sindresorhus/slugify) - Slugify a string
- [slugify](https://github.com/simov/slugify) - Slugify a string
- [@sindresorhus/transliterate](https://github.com/sindresorhus/transliterate) - Convert Unicode characters to Latin characters using transliteration
- [transliteration](https://github.com/yf-hk/transliteration/tree/main) - UTF-8 to ASCII transliteration / slugify module for node.js, browser, Web Worker, React Native, Electron and CLI.
- [unidecode](https://github.com/FGRibreau/node-unidecode) - 📃 ASCII transliterations of Unicode text

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).
Here's [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help, take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima string is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/string?style=for-the-badge

[license]: https://github.com/visulima/visulima/blob/main/LICENSE

[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/string?style=for-the-badge

[npm-downloads]: https://www.npmjs.com/package/@visulima/string

[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge

[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md

[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge

[chat]: https://discord.gg/TtFJY8xkFK

[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript

[typescript-url]: https://www.typescriptlang.org/

