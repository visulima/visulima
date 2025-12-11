<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="html" />

</a>

<h3 align="center">Functions for HTML, such as escaping or unescaping HTML entities</h3>

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

---

## Features

### HTML Escaping

- **Fast HTML Escaping**: Optimized HTML escaping function from Svelte
- **Minimal Allocations**: Efficient string escaping with minimal memory allocations
- **Dual Mode**: Supports both content escaping and attribute escaping
- **XSS Protection**: Escapes HTML special characters to prevent XSS attacks
- **TypeScript Support**: Full TypeScript definitions included

### HTML Entity Encoding & Decoding

- **Fastest HTML Entities Library**: High-performance HTML entity encoding and decoding
- **Multiple Standards**: Support for HTML5, HTML4, and XML entity standards
- **Flexible Encoding Modes**:
    - `specialChars`: Encode only HTML special characters (`<`, `>`, `"`, `'`, `&`) - default
    - `nonAscii`: Encode HTML special characters and everything outside the ASCII character range
    - `nonAsciiPrintable`: Encode HTML special characters and everything outside of the ASCII printable characters
    - `nonAsciiPrintableOnly`: Encode everything outside of the ASCII printable characters, keeping HTML special characters intact
    - `extensive`: Encode all non-printable characters, non-ASCII characters and all characters with named references
- **Numeric Encoding**: Support for decimal (`&#169;`) and hexadecimal (`&#xa9;`) numeric entities
- **Comprehensive Character Support**: Handles named entities, numeric entities, and hex entities
- **TypeScript & Flow Types**: Comes with both TypeScript and Flow type definitions

### HTML Tag Lists

- **Standard HTML Tags**: Comprehensive list of all standard HTML tags (excluding obsolete ones)
- **Void Tags**: List of self-closing/void HTML tags (e.g., `br`, `img`, `hr`)
- **TypeScript Support**: Full TypeScript definitions included
- **Useful for Validation**: Perfect for validating HTML tags when working with sanitization

### HTML Sanitization

- **Secure by Default**: Clean up user-submitted HTML by preserving allowlisted elements and attributes
- **Per-Element Configuration**: Fine-grained control over allowed tags and attributes
- **XSS Protection**: Remove potentially dangerous HTML and scripts
- **Customizable**: Extend or override default allowed tags and attributes
- **URL Validation**: Control allowed URL schemes (http, https, mailto, etc.)
- **Iframe Support**: Safe embedding of content from trusted sources

---

## Install

```sh
npm install @visulima/html
```

```sh
yarn add @visulima/html
```

```sh
pnpm add @visulima/html
```

## Usage

### HTML Escaping

The `escapeHtml` function provides fast HTML escaping optimized for performance.

#### Basic Escaping

```typescript
import { escapeHtml } from "@visulima/html";

// Escape HTML content (escapes & and <)
const escaped = escapeHtml('<script>alert("xss")</script>');
// Result: '&lt;script>alert("xss")&lt;/script>'

// Escape HTML attributes (also escapes double quotes)
const attrEscaped = escapeHtml('value="test"', true);
// Result: 'value=&quot;test&quot;'

// Or use boolean for backward compatibility
const attrEscaped2 = escapeHtml('value="test"', true);
// Result: 'value=&quot;test&quot;'
```

#### Content Escaping

```typescript
import { escapeHtml } from "@visulima/html";

// Escape content for HTML body (default mode)
escapeHtml("<div>Hello & World</div>");
// Result: '&lt;div>Hello &amp; World&lt;/div>'

// Handles null/undefined gracefully
escapeHtml(null);
// Result: ''

escapeHtml(undefined);
// Result: ''
```

#### Attribute Escaping

```typescript
import { escapeHtml } from "@visulima/html";

// Escape for HTML attributes (escapes &, <, and ")
const attrValue = escapeHtml('data-value="test"', true);
// Result: 'data-value=&quot;test&quot;'

// Use in HTML attributes
const html = `<div data-content="${escapeHtml(userInput, true)}">Content</div>`;
```

#### Performance

The `escapeHtml` function is optimized for performance:

- Minimal string allocations
- Efficient regex-based pattern matching
- Fast path for strings without special characters

```typescript
import { escapeHtml } from "@visulima/html";

// Fast escaping for user-generated content
const safeHtml = escapeHtml(userInput);

// Safe attribute values
const safeAttr = escapeHtml(userInput, true);
```

> **Note:** This function is based on Svelte's optimized escaping implementation. See the source file for copyright information.

### HTML Entity Encoding & Decoding

The package exports all functions from `html-entities` for encoding and decoding HTML entities.

#### Basic Encoding

```typescript
import { encode } from "@visulima/html";

// Encode HTML special characters
const encoded = encode("< > \" ' & © ∆");
// Result: '&lt; &gt; &quot; &apos; &amp; © ∆'
```

#### Basic Decoding

```typescript
import { decode } from "@visulima/html";

// Decode HTML entities
const decoded = decode("&lt; &gt; &quot; &apos; &amp; &copy; &Delta;");
// Result: '< > " \' & © ∆'
```

#### Encoding Options

```typescript
import { encode } from "@visulima/html";

// Encode with HTML5 standard (default)
encode("< > \" ' & ©", { level: "html5" });
// Result: '&lt; &gt; &quot; &apos; &amp; ©'

// Encode with HTML4 standard
encode("< > \" ' & ©", { level: "html4" });
// Result: '&lt; &gt; &quot; &apos; &amp; ©'

// Encode with XML standard
encode("< > \" ' & ©", { level: "xml" });
// Result: '&lt; &gt; &quot; &apos; &amp; &#169;'

// Encode only special characters (default mode)
encode("< > \" ' & ©", { mode: "specialChars" });
// Result: '&lt; &gt; &quot; &apos; &amp; ©'

// Encode HTML special characters and everything outside ASCII
encode("< ©", { mode: "nonAscii" });
// Result: '&lt; &copy;'

// Encode HTML special characters and everything outside ASCII printable
encode("< ©", { mode: "nonAsciiPrintable" });
// Result: '&lt; &copy;'

// Encode with XML level and non-ASCII printable mode
encode("< ©", { mode: "nonAsciiPrintable", level: "xml" });
// Result: '&lt; &#169;'

// Encode only non-ASCII printable characters (keep HTML special chars intact)
encode("< > \" ' & ©", { mode: "nonAsciiPrintableOnly", level: "xml" });
// Result: '< > " \' & &#169;'

// Encode extensively (all non-printable, non-ASCII, and named references)
encode("< > \" ' & ©", { mode: "extensive" });
// Result: '&lt; &gt; &quot; &apos; &amp; &copy;'

// Use hexadecimal numeric entities
encode("< ©", { mode: "nonAsciiPrintable", level: "xml", numeric: "hexadecimal" });
// Result: '&lt; &#xa9;'
```

**Encode Options:**

- `level`: `'all'` (alias to `'html5'`) | `'html5'` (default) | `'html4'` | `'xml'` - Specifies the standard to use for named character references
- `mode`: `'specialChars'` (default) | `'nonAscii'` | `'nonAsciiPrintable'` | `'nonAsciiPrintableOnly'` | `'extensive'` - Determines which characters to encode
- `numeric`: `'decimal'` (default) | `'hexadecimal'` - Uses decimal (`&#169;`) or hexadecimal (`&#xa9;`) numbers when encoding entities

#### Decoding Options

```typescript
import { decode } from "@visulima/html";

// Decode with HTML5 standard (default)
decode("&lt; &gt; &quot; &apos; &amp; &#169; &#8710;");
// Result: '< > " \' & © ∆'

// Decode with HTML5 level
decode("&copy;", { level: "html5" });
// Result: '©'

// Decode with XML level (doesn't recognize &copy;)
decode("&copy;", { level: "xml" });
// Result: '&copy;' (unknown entity left as is)

// Decode with body scope (default) - emulates browser parsing tag bodies
decode("&lt &gt", { scope: "body" });
// Result: '< >' (entities without semicolon are replaced)

// Decode with attribute scope - emulates browser parsing tag attributes
decode("&lt &gt", { scope: "attribute" });
// Result: '< >' (entities without semicolon replaced when not followed by =)

// Decode with strict scope - ignores entities without semicolon
decode("&lt &gt", { scope: "strict" });
// Result: '&lt &gt' (entities without semicolon ignored)
```

**Decode Options:**

- `level`: `'all'` (alias to `'html5'`) | `'html5'` (default) | `'html4'` | `'xml'` - Specifies the standard to use for named character references
- `scope`: `'body'` (default) | `'attribute'` | `'strict'` - Controls how entities without semicolons are handled
    - `'body'`: Emulates browser behavior when parsing tag bodies - entities without semicolon are also replaced
    - `'attribute'`: Emulates browser behavior when parsing tag attributes - entities without semicolon are replaced when not followed by equality sign `=`
    - `'strict'`: Ignores entities without semicolon

#### Decode Single Entity

```typescript
import { decodeEntity } from "@visulima/html";

// Decode a single HTML entity
decodeEntity("&lt;");
// Result: '<'

// Decode with HTML5 level
decodeEntity("&copy;", { level: "html5" });
// Result: '©'

// Decode with XML level (doesn't recognize &copy;)
decodeEntity("&copy;", { level: "xml" });
// Result: '&copy;' (unknown entity left as is)
```

**DecodeEntity Options:**

- `level`: `'all'` (alias to `'html5'`) | `'html5'` (default) | `'html4'` | `'xml'` - Specifies the standard to use for named character references

### HTML Tag Lists

The package exports `htmlTags` and `voidHtmlTags` from `html-tags` for working with HTML tag lists.

#### Standard HTML Tags

```typescript
import { htmlTags } from "@visulima/html";

// Get all standard HTML tags
console.log(htmlTags);
// => ['a', 'abbr', 'acronym', 'address', 'applet', 'area', 'article', ...]

// Check if a tag is a standard HTML tag
const isValidTag = htmlTags.includes("div");
// => true

const isInvalidTag = htmlTags.includes("custom-tag");
// => false

// Use with sanitizeHtml to validate allowed tags
import { sanitizeHtml, htmlTags } from "@visulima/html";

const clean = sanitizeHtml(dirtyHtml, {
    allowedTags: htmlTags.filter((tag) => ["p", "a", "img", "div"].includes(tag)),
});
```

#### Void HTML Tags

```typescript
import { voidHtmlTags } from "@visulima/html";

// Get all void/self-closing HTML tags
console.log(voidHtmlTags);
// => ['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', ...]

// Check if a tag is a void tag
const isVoidTag = voidHtmlTags.includes("br");
// => true

const isNotVoidTag = voidHtmlTags.includes("div");
// => false

// Use with sanitizeHtml to configure self-closing tags
import { sanitizeHtml, voidHtmlTags } from "@visulima/html";

const clean = sanitizeHtml(html, {
    allowedTags: ["p", "br", "img"],
    selfClosing: voidHtmlTags.filter((tag) => ["br", "img"].includes(tag)),
});
```

### HTML Sanitization

The package exports `sanitizeHtml` from `sanitize-html` for cleaning user-submitted HTML.

#### Basic Sanitization

```typescript
import { sanitizeHtml } from "@visulima/html";

// Basic usage - removes potentially dangerous HTML
const dirty = '<p>Hello <script>alert("xss")</script>World</p>';
const clean = sanitizeHtml(dirty);
// Result: '<p>Hello World</p>'
```

#### Custom Allowed Tags and Attributes

```typescript
import { sanitizeHtml } from "@visulima/html";

// Specify allowed tags and attributes
const html = '<p>Hello <a href="http://example.com">Link</a></p>';
const clean = sanitizeHtml(html, {
    allowedTags: ["b", "i", "em", "strong", "a", "p"],
    allowedAttributes: {
        a: ["href"],
    },
});
```

#### Extending Default Allowed Tags

```typescript
import { sanitizeHtml } from "@visulima/html";

// Extend the default set of allowed tags
const clean = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img", "iframe"]),
});
```

#### Advanced Sanitization Options

```typescript
import { sanitizeHtml } from "@visulima/html";

const clean = sanitizeHtml(html, {
    // Allowed HTML tags
    allowedTags: ["h1", "h2", "p", "a", "img"],

    // Allowed attributes per tag
    allowedAttributes: {
        a: ["href", "name", "target"],
        img: ["src", "alt", "width", "height"],
    },

    // Self-closing tags
    selfClosing: ["img", "br", "hr"],

    // Allowed URL schemes
    allowedSchemes: ["http", "https", "mailto"],

    // Allowed schemes for specific tags
    allowedSchemesByTag: {
        img: ["http", "https", "data"],
    },

    // Attributes that scheme validation applies to
    allowedSchemesAppliedToAttributes: ["href", "src", "cite"],

    // Allow protocol-relative URLs
    allowProtocolRelative: true,

    // Allowed iframe hostnames
    allowedIframeHostnames: ["www.youtube.com", "player.vimeo.com"],

    // Transform tags
    transformTags: {
        a: (tagName, attribs) => {
            // Transform anchor tags
            return {
                tagName: "a",
                attribs: {
                    ...attribs,
                    rel: "nofollow",
                },
            };
        },
    },

    // Text filter
    textFilter: (text) => {
        // Filter or transform text content
        return text.trim();
    },
});
```

#### Default Configuration

The default configuration includes:

- **allowedTags**: `['h3', 'h4', 'h5', 'h6', 'blockquote', 'p', 'a', 'ul', 'ol', 'nl', 'li', 'b', 'i', 'strong', 'em', 'strike', 'code', 'hr', 'br', 'div', 'table', 'thead', 'caption', 'tbody', 'tr', 'th', 'td', 'pre']`
- **allowedAttributes**: `{ a: ['href', 'name', 'target'], img: ['src'] }`
- **allowedSchemes**: `['http', 'https', 'ftp', 'mailto']`
- **allowProtocolRelative**: `true`
- **allowedIframeHostnames**: `['www.youtube.com', 'player.vimeo.com']`

## Related

- [sanitize-html](https://github.com/apostrophecms/sanitize-html) - HTML sanitizer with a clear API
- [html-entities](https://github.com/mdevils/html-entities) - Fast HTML entity encoding/decoding
- [html-tags](https://github.com/sindresorhus/html-tags) - List of standard HTML tags
- [Svelte](https://github.com/sveltejs/svelte) - Cybernetically enhanced web apps (escapeHtml function source)
- [DOMPurify](https://github.com/cure53/DOMPurify) - DOM-only, super-fast, uber-tolerant XSS sanitizer
- [xss](https://github.com/leizongmin/js-xss) - XSS filter

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## Made with ❤️ at Anolilab

This is an open source project and will always remain free to use. If you think it's cool, please star it 🌟. [Anolilab](https://www.anolilab.com/open-source) is a Development and AI Studio. Contact us at [hello@anolilab.com](mailto:hello@anolilab.com) if you need any help with these technologies or just want to say hi!

## License

The visulima html is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/html?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/html?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/html
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
