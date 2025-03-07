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

## Quick Examples


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
