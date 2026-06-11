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
- **HTML Template Tag**: Template literal function for HTML strings with automatic escaping of interpolated values
- **TypeScript Support**: Full TypeScript definitions included

### CSS & JavaScript Escaping

- **CSS Escaping**: Escape strings for safe interpolation into CSS stylesheets, `<style>` elements, or CSS selectors
- **CSS Template Tag**: Template literal function for CSS strings with optional escaping
- **CSS Object Support**: Convert CSS objects (camelCase properties) to CSS strings with full TypeScript autocomplete
- **JavaScript Escaping**: Escape JavaScript objects and data for safe interpolation inside `<script>` tags
- **Injection Prevention**: Prevents CSS injection and JavaScript injection attacks
- **Context-Aware**: Properly handles different escaping requirements for CSS and JavaScript contexts
- **TypeScript Support**: Full TypeScript definitions included

### Custom Element Validation

- **Name Validation**: Check if a string is a valid custom element name per HTML specification
- **Specification Compliant**: Follows the official HTML custom element naming rules
- **Hyphen Requirement**: Validates that custom element names contain required hyphens
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

### HTML Tag Stripping

- **No Parser Required**: Lightweight HTML tag stripping without a full HTML parser
- **Plain Text Extraction**: Removes HTML tags to extract plain text content
- **Prevents Concatenation**: Automatically adds spaces between text nodes to prevent accidental string concatenation
- **Smart Bracket Detection**: Detects raw, legitimate brackets (like comparison operators) and preserves them
- **Configurable Tag Removal**: Strip specific tags together with their contents (e.g., script, style, pre)
- **Mixed Source Support**: Handles mixed HTML and plain text sources gracefully
- **TypeScript Support**: Full TypeScript definitions included

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

### Entry Points

`@visulima/html` exposes focused subpath exports so you only pay for what you import. The aggregate `@visulima/html` entry re-exports everything (including `sanitize-html`, which pulls in `htmlparser2`/`parse5`/`postcss`). If you only need escaping, import the lighter, browser-friendly subpaths instead:

| Import                       | Contents                                                   |
| ---------------------------- | ---------------------------------------------------------- |
| `@visulima/html`             | Everything (escaping, `html`/`css` tags, sanitize, strip…) |
| `@visulima/html/escape`      | `escapeHtml`, `escapeCss`, `escapeJs` (no `sanitize-html`) |
| `@visulima/html/html`        | `html` tag + `html.raw` / `isRawHtml`                      |
| `@visulima/html/css`         | `css` tag + `CSSProperties` / `FlexibleCSSProperties`      |
| `@visulima/html/sanitize`    | `sanitizeHtml`                                             |
| `@visulima/html/strip`       | `stripHtml` + types                                        |

```typescript
// Lightweight, browser-safe — does not load sanitize-html
import { escapeHtml, escapeCss, escapeJs } from "@visulima/html/escape";
import { html } from "@visulima/html/html";
```

### When to Use Escaping vs Sanitization vs Stripping

Understanding when to use **escaping**, **sanitization**, or **stripping** is crucial for web security:

**Use Escaping (`escapeHtml`) when:**

- You're inserting **plain text** into HTML (text content or attribute values)
- The content should be displayed as-is, without any HTML rendering
- You want maximum performance and minimal processing overhead
- You're building HTML strings manually (template literals, string concatenation)
- The input is expected to be plain text (user names, comments, form inputs)

**Example:** User comments, form field values, JSON data displayed in HTML

**Use Sanitization (`sanitizeHtml`) when:**

- Users are allowed to submit **HTML content** that should be rendered
- You need to preserve some HTML tags while removing dangerous ones
- You want to allow rich text formatting (bold, italic, links, etc.)
- The content needs to be displayed as HTML, not as plain text
- You need fine-grained control over which HTML elements and attributes are allowed

**Example:** Rich text editors, blog post content, user-generated HTML content

**Use Stripping (`stripHtml`) when:**

- You need to extract **plain text** from HTML content
- You want to completely remove all HTML structure and tags
- You're preparing content for plain text display (emails, SMS, search indexes)
- You need to prevent accidental string concatenation from adjacent text nodes
- You want to preserve legitimate brackets (like comparison operators) while removing HTML tags

**Example:** Email text versions, search result snippets, plain text previews, content summaries

**Key Differences:**

- **Escaping** converts special characters to entities (`<` → `&lt;`), preventing HTML interpretation
- **Sanitization** removes or allows specific HTML tags, enabling safe HTML rendering
- **Stripping** removes all HTML tags and extracts plain text content

> **Security Note:** Never use sanitization on content that has already been escaped, and never render sanitized content without proper escaping in attributes or other contexts.

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

### HTML Template Tag

The `html` function provides a convenient template tag for creating XSS-safe HTML strings. Template strings are used as-is, but all interpolated values are automatically HTML-escaped to prevent XSS attacks.

#### Template Tag Usage

```typescript
import { html } from "@visulima/html";

// Template tag returns HTML as-is (template strings are trusted)
const markup = html`<div class="container">Hello World</div>`;
// Result: '<div class="container">Hello World</div>'

// With template values - interpolations are automatically escaped
const className = "test-class";
const content = "Hello";
const result = html`<div class="${className}">${content}</div>`;
// Result: '<div class="test-class">Hello</div>'

// XSS protection: interpolated values are escaped
const userInput = '<script>alert("xss")</script>';
const safe = html`<div>${userInput}</div>`;
// Result: '<div>&lt;script>alert("xss")&lt;/script></div>'
```

#### Composing Fragments (arrays and `html.raw`)

Interpolated **arrays** are flattened and joined with an empty string (not commas), and each element is escaped. Values wrapped with **`html.raw`** are inlined verbatim, so you can compose already-rendered fragments without double-escaping:

```typescript
import { html } from "@visulima/html";

// Arrays are joined with "" and each element is escaped
html`<p>${["<a>", "<b>"]}</p>`;
// Result: '<p>&lt;a>&lt;b></p>'

// Build a list: wrap each nested fragment with html.raw so it is not re-escaped
const items = ["Apples", "<script>"];
html`<ul>${items.map((item) => html.raw(html`<li>${item}</li>`))}</ul>`;
// Result: '<ul><li>Apples</li><li>&lt;script></li></ul>'

// Inline trusted, pre-sanitized HTML verbatim
const trusted = html.raw("<em>bold</em>");
html`<p>${trusted}</p>`;
// Result: '<p><em>bold</em></p>'
```

> **Security Note:** `html.raw` bypasses escaping entirely. Only ever wrap HTML you fully control or have already sanitized — wrapping untrusted input reintroduces XSS. Use `isRawHtml(value)` to detect a raw marker.

#### Function Usage with Escaping Control

```typescript
import { html } from "@visulima/html";

// Escape HTML (escapes &, <, and ")
const escapedHtml = html('<script>alert("xss")</script>', true);
// Result: '&lt;script>alert(&quot;xss&quot;)&lt;/script>'

// Return HTML as-is (unsafe for untrusted input)
const passthrough = html("<div></div>");
// Result: '<div></div>'
```

> **⚠️ Security caveat:** The `html(string)` function-call form is **not** escaping by default — it only escapes when you pass `true` as the second argument. This differs from the template-tag form, which always escapes interpolations. Prefer the template tag for untrusted data, and only use the function form (without `true`) for HTML you already trust.

#### Use Cases

- **Template Literals**: Use the template tag for HTML with automatic escaping of interpolated values
- **Fragment Composition**: Use arrays and `html.raw` to build lists and compose partials safely
- **Dynamic Content**: Interpolated values are automatically escaped, making it safe for user-generated content
- **Trusted HTML**: Use `html.raw(...)` (or the function form with no second argument) when you need to insert trusted HTML without escaping
- **Performance**: Template tag has minimal overhead, perfect for HTML generation with automatic XSS protection

### CSS Escaping

The `escapeCss` function escapes a string for safe interpolation into an external CSS style sheet, within a `<style>` element, or in a CSS selector. This helps prevent CSS injection vulnerabilities.

#### Basic CSS Escaping

```typescript
import { escapeCss } from "@visulima/html";

// Escape CSS content for safe interpolation
const unsafeCss = "body { background-image: url('http://example.com/foo.jpg?</style><script>alert(1)</script>'); }";
const safeCss = escapeCss(unsafeCss);
// Result: Escaped CSS that prevents injection attacks

// Use in style elements
const html = `<style>${escapeCss(userCss)}</style>`;

// Use in inline styles
const inlineStyle = `background-image: url('${escapeCss(userUrl)}');`;
```

#### CSS Selector Escaping

```typescript
import { escapeCss } from "@visulima/html";

// Escape CSS selector values
const selector = escapeCss(userInput);
const css = `.${selector} { color: red; }`;
```

> **Security Note:** Always use `escapeCss` when interpolating user-generated content into CSS contexts to prevent CSS injection attacks.

### CSS Template Tag

The `css` function provides a convenient template tag for creating CSS strings, with support for CSS objects and optional escaping.

#### Template Tag Usage

```typescript
import { css } from "@visulima/html";

// Template tag returns CSS as-is
const styles = css`
    :where(.UnderlineNav-actions ul) {
        animation: 1ms rgh-selector-observer;
    }
`;
// Result: CSS string with preserved formatting

// With template values
const selector = ".test-class";
const color = "red";
const result = css`
    ${selector} {
        color: ${color};
    }
`;
```

> **Note:** The template tag collapses whitespace into single spaces to produce a one-line string, but it is quote-aware: whitespace inside single- or double-quoted values (e.g. `content: "a   b"`) is preserved verbatim.

#### Function Usage with String Input

```typescript
import { css } from "@visulima/html";

// Return CSS as-is (no escaping)
const cssString = css(":where(.test) { color: red; }", false);
// Result: ':where(.test) { color: red; }'

// Escape CSS for safe interpolation
const escapedCss = css(":where(.test) { color: red; }", true);
// Result: Escaped CSS string

// Default behavior: return as-is
const defaultCss = css(":where(.test) { color: red; }");
// Result: ':where(.test) { color: red; }'
```

#### Function Usage with CSS Object

The `css` function accepts CSS objects with camelCase properties, providing full TypeScript autocomplete support via `csstype`:

```typescript
import { css } from "@visulima/html";

// Convert CSS object to CSS string (no escaping)
const styles = css({ padding: "1px", margin: "2px" }, false);
// Result: 'padding: 1px; margin: 2px;'

// With escaping
const escapedStyles = css({ padding: "1px" }, true);
// Result: Escaped CSS string

// CamelCase properties are automatically converted to kebab-case
const result = css({ paddingTop: "10px", marginBottom: "20px" }, false);
// Result: 'padding-top: 10px; margin-bottom: 20px;'

// Full TypeScript autocomplete for CSS properties
const typedStyles = css(
    {
        padding: "1px",
        margin: "2px",
        color: "red",
        display: "block",
        // TypeScript will autocomplete all valid CSS properties!
    },
    false,
);
```

#### TypeScript Autocomplete

The `css` function uses `csstype` for full TypeScript autocomplete support:

- **All CSS Properties**: Autocomplete for all standard CSS properties
- **Type Safety**: TypeScript will validate CSS property names and values
- **CamelCase Support**: Use camelCase property names (e.g., `paddingTop`) which are automatically converted to kebab-case

#### Use Cases

- **Template Literals**: Use the template tag for static CSS or CSS with template variables
- **CSS Objects**: Use CSS objects when you need TypeScript autocomplete and type safety
- **Dynamic Styles**: Convert JavaScript objects to CSS strings for dynamic styling
- **Safe Interpolation**: Use `escape: true` when interpolating user-generated CSS

### JavaScript Escaping

The `escapeJs` function escapes a JavaScript object or other data for safe interpolation inside a `<script>` tag. This ensures that the data does not break the JavaScript context or introduce security risks.

#### Basic JavaScript Escaping

```typescript
import { escapeJs } from "@visulima/html";

// Escape JavaScript content for safe interpolation
const unsafeJs = "console.log('Hello, world!');</script><script>alert('XSS');</script>";
const safeJs = escapeJs(unsafeJs);
// Result: Escaped JavaScript that prevents script injection

// Use in script tags
const html = `<script>const data = ${escapeJs(userData)};</script>`;

// Escape JSON data for inline scripts
const jsonData = { name: "John", value: "</script><script>alert(1)" };
const safeJson = escapeJs(JSON.stringify(jsonData));
const script = `<script>window.config = ${safeJson};</script>`;
```

#### Escaping JavaScript Objects

```typescript
import { escapeJs } from "@visulima/html";

// Escape complex objects for safe interpolation
const config = {
    apiUrl: "https://api.example.com",
    userInput: userProvidedValue,
};

const escapedConfig = escapeJs(JSON.stringify(config));
const html = `<script>window.appConfig = ${escapedConfig};</script>`;
```

> **Security Note:** Always use `escapeJs` when interpolating user-generated content into JavaScript contexts to prevent XSS attacks and script injection.

### Custom Element Name Validation

The `isValidCustomElementName` function checks whether a given string is a valid custom element name according to the [HTML specification](https://html.spec.whatwg.org/multipage/custom-elements.html#valid-custom-element-name).

#### Basic Validation

```typescript
import { isValidCustomElementName } from "@visulima/html";

// Valid custom element names (must contain a hyphen)
console.log(isValidCustomElementName("my-element")); // true
console.log(isValidCustomElementName("my-custom-element")); // true
console.log(isValidCustomElementName("app-header")); // true

// Invalid custom element names
console.log(isValidCustomElementName("MyElement")); // false (no hyphen)
console.log(isValidCustomElementName("my_element")); // false (underscore not allowed)
console.log(isValidCustomElementName("myelement")); // false (no hyphen)
console.log(isValidCustomElementName("div")); // false (standard HTML tag)
```

#### Using with Custom Element Registration

```typescript
import { isValidCustomElementName } from "@visulima/html";

function registerCustomElement(name: string, constructor: CustomElementConstructor) {
    if (!isValidCustomElementName(name)) {
        throw new Error(`Invalid custom element name: ${name}. Custom element names must contain a hyphen.`);
    }

    customElements.define(name, constructor);
}

// Valid usage
registerCustomElement("my-component", class extends HTMLElement {});

// Invalid usage - will throw error
registerCustomElement("MyComponent", class extends HTMLElement {}); // Error!
```

#### Custom Element Name Rules

According to the HTML specification, a valid custom element name must:

- Contain a hyphen (`-`) to separate words
- Start with an ASCII lowercase letter
- Contain at least one hyphen
- Not be a standard HTML tag name
- Not start with certain reserved prefixes (like `html-`, `xml-`, etc.)

> **Note:** Custom element names are case-sensitive and must follow the naming conventions defined in the HTML specification to ensure proper browser support.

### HTML Detection

The `isHtml` function checks whether a string contains HTML markup. It is a thin re-export of [`is-html`](https://github.com/sindresorhus/is-html).

```typescript
import { isHtml } from "@visulima/html";

isHtml("<p>hello</p>"); // true
isHtml("<br/>"); // true
isHtml("just plain text"); // false
isHtml("1 < 2 and 3 > 2"); // false
```

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

### HTML Tag Stripping

The package exports `stripHtml` from `string-strip-html` for removing HTML tags and extracting plain text.

#### Basic Stripping

```typescript
import { stripHtml } from "@visulima/html";

// Strip HTML tags from string
const result = stripHtml("Some text <b>and</b> text.");
console.log(result.result); // 'Some text and text.'

// Prevents accidental string concatenation
const result2 = stripHtml("aaa<div>bbb</div>ccc");
console.log(result2.result); // 'aaa bbb ccc'

// Access the stripped text
const plainText = stripHtml("<div>Hello <strong>World</strong></div>").result;
// plainText: 'Hello World'
```

#### Tag Pairs with Content

```typescript
import { stripHtml } from "@visulima/html";

// Strip tags together with their contents
const result = stripHtml("a <pre><code>void a;</code></pre> b", {
    stripTogetherWithTheirContents: ["script", "style", "xml", "pre"],
});
console.log(result.result); // 'a b'

// Script and style tags are stripped by default
const result2 = stripHtml("Text <script>alert('xss')</script> more text");
console.log(result2.result); // 'Text more text'

// Strip style tags with their content
const result3 = stripHtml("Text <style>body { color: red; }</style> more text");
console.log(result3.result); // 'Text more text'
```

#### Raw Bracket Detection

```typescript
import { stripHtml } from "@visulima/html";

// Detects raw, legit brackets and preserves them
const result = stripHtml("a < b and c > d");
console.log(result.result); // 'a < b and c > d'

// Handles comparison operators in text
const result2 = stripHtml("5 < 10 and 20 > 15");
console.log(result2.result); // '5 < 10 and 20 > 15'

// Handles mixed HTML tags and comparison operators
const result3 = stripHtml("Value <b>5</b> < 10");
console.log(result3.result); // 'Value 5 < 10'
```

#### Advanced Options

```typescript
import { stripHtml } from "@visulima/html";

// Custom tag stripping configuration
const result = stripHtml(html, {
    // Strip these tags together with their contents
    stripTogetherWithTheirContents: ["script", "style", "xml", "pre", "code"],

    // Other options available from string-strip-html
    // See: https://codsen.com/os/string-strip-html/
});

// Access the stripped text
const plainText = result.result;

// The result object also contains other metadata
// See: https://codsen.com/os/string-strip-html/ for full API
```

#### Edge Cases

```typescript
import { stripHtml } from "@visulima/html";

// Handles empty strings
const result1 = stripHtml("");
console.log(result1.result); // ''

// Handles strings with only HTML tags
const result2 = stripHtml("<div><span></span></div>");
console.log(result2.result); // ''

// Handles strings with no HTML tags
const result3 = stripHtml("Plain text without tags");
console.log(result3.result); // 'Plain text without tags'

// Handles nested HTML tags
const result4 = stripHtml("<div><p>Text <b>bold</b></p></div>");
console.log(result4.result); // 'Text bold'

// Handles self-closing tags
const result5 = stripHtml("Line 1<br/>Line 2<br />Line 3");
console.log(result5.result); // 'Line 1 Line 2 Line 3'

// Handles HTML entities (they are decoded)
const result6 = stripHtml("<p>Hello &amp; World</p>");
console.log(result6.result); // 'Hello & World'
```

**When to Use Stripping vs Sanitization:**

- **Use `stripHtml`** when you need plain text output and want to completely remove HTML structure
- **Use `sanitizeHtml`** when you need to preserve some HTML structure while removing dangerous elements

## Related

- [sanitize-html](https://github.com/apostrophecms/sanitize-html) - HTML sanitizer with a clear API
- [string-strip-html](https://github.com/codsen/codsen/tree/main/packages/string-strip-html) - Strip HTML tags from strings
- [html-entities](https://github.com/mdevils/html-entities) - Fast HTML entity encoding/decoding
- [html-tags](https://github.com/sindresorhus/html-tags) - List of standard HTML tags
- [DOMPurify](https://github.com/cure53/DOMPurify) - DOM-only, super-fast, uber-tolerant XSS sanitizer
- [xss](https://github.com/leizongmin/js-xss) - XSS filter
- [htmlnano](https://github.com/maltsev/htmlnano) - HTML minifier
- [cssnano](https://github.com/cssnano/cssnano) - CSS minifier

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
