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

### HTML Entity Encoding & Decoding

- **Fast and Lightweight**: High-performance HTML entity encoding and decoding
- **Multiple Standards**: Support for HTML5, HTML4, and XML entity standards
- **Flexible Encoding Modes**:
    - `specialChars`: Encode only HTML special characters (`<`, `>`, `"`, `'`, `&`)
    - `nonAsciiPrintable`: Encode non-ASCII printable characters
    - `nonAsciiPrintableOnly`: Encode only non-ASCII printable characters
- **Comprehensive Character Support**: Handles named entities, numeric entities, and hex entities

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

### HTML Entity Encoding & Decoding

The package exports all functions from `html-entities` for encoding and decoding HTML entities.

#### Basic Encoding

```typescript
import { encode } from '@visulima/html';

// Encode HTML special characters
const encoded = encode('< > " \' & © ∆');
// Result: '&lt; &gt; &quot; &apos; &amp; © ∆'
```

#### Basic Decoding

```typescript
import { decode } from '@visulima/html';

// Decode HTML entities
const decoded = decode('&lt; &gt; &quot; &apos; &amp; &copy; &Delta;');
// Result: '< > " \' & © ∆'
```

#### Encoding Options

```typescript
import { encode } from '@visulima/html';

// Encode with HTML5 standard (default)
encode('< > " \' &', { level: 'html5' });

// Encode with HTML4 standard
encode('< > " \' &', { level: 'html4' });

// Encode with XML standard
encode('< > " \' &', { level: 'xml' });

// Encode only special characters (default)
encode('< > " \' & ©', { mode: 'specialChars' });
// Result: '&lt; &gt; &quot; &apos; &amp; ©'

// Encode non-ASCII printable characters
encode('< > " \' & ©', { mode: 'nonAsciiPrintable' });
// Result: '< > " \' & &#169;'

// Encode only non-ASCII printable characters
encode('< > " \' & ©', { mode: 'nonAsciiPrintableOnly' });
// Result: '< > " \' & &#169;'
```

#### Decoding Options

```typescript
import { decode } from '@visulima/html';

// Decode with HTML5 standard (default)
decode('&lt; &gt; &copy;', { level: 'html5' });

// Decode with HTML4 standard
decode('&lt; &gt; &copy;', { level: 'html4' });

// Decode with XML standard
decode('&lt; &gt; &apos;', { level: 'xml' });
```

#### Additional Entity Functions

```typescript
import {
    encodeXML,
    decodeXML,
    encodeHTML4,
    decodeHTML4,
    encodeHTML5,
    decodeHTML5
} from '@visulima/html';

// Direct encoding/decoding for specific standards
const xmlEncoded = encodeXML('< > " \' &');
const xmlDecoded = decodeXML('&lt; &gt; &quot; &apos; &amp;');

const html4Encoded = encodeHTML4('< > " \' &');
const html4Decoded = decodeHTML4('&lt; &gt; &quot; &apos; &amp;');

const html5Encoded = encodeHTML5('< > " \' &');
const html5Decoded = decodeHTML5('&lt; &gt; &quot; &apos; &amp;');
```

### HTML Sanitization

The package exports `sanitizeHtml` from `sanitize-html` for cleaning user-submitted HTML.

#### Basic Sanitization

```typescript
import { sanitizeHtml } from '@visulima/html';

// Basic usage - removes potentially dangerous HTML
const dirty = '<p>Hello <script>alert("xss")</script>World</p>';
const clean = sanitizeHtml(dirty);
// Result: '<p>Hello World</p>'
```

#### Custom Allowed Tags and Attributes

```typescript
import { sanitizeHtml } from '@visulima/html';

// Specify allowed tags and attributes
const html = '<p>Hello <a href="http://example.com">Link</a></p>';
const clean = sanitizeHtml(html, {
    allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p'],
    allowedAttributes: {
        'a': ['href']
    }
});
```

#### Extending Default Allowed Tags

```typescript
import { sanitizeHtml } from '@visulima/html';

// Extend the default set of allowed tags
const clean = sanitizeHtml(html, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'iframe'])
});
```

#### Advanced Sanitization Options

```typescript
import { sanitizeHtml } from '@visulima/html';

const clean = sanitizeHtml(html, {
    // Allowed HTML tags
    allowedTags: ['h1', 'h2', 'p', 'a', 'img'],

    // Allowed attributes per tag
    allowedAttributes: {
        'a': ['href', 'name', 'target'],
        'img': ['src', 'alt', 'width', 'height']
    },

    // Self-closing tags
    selfClosing: ['img', 'br', 'hr'],

    // Allowed URL schemes
    allowedSchemes: ['http', 'https', 'mailto'],

    // Allowed schemes for specific tags
    allowedSchemesByTag: {
        'img': ['http', 'https', 'data']
    },

    // Attributes that scheme validation applies to
    allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],

    // Allow protocol-relative URLs
    allowProtocolRelative: true,

    // Allowed iframe hostnames
    allowedIframeHostnames: ['www.youtube.com', 'player.vimeo.com'],

    // Transform tags
    transformTags: {
        'a': (tagName, attribs) => {
            // Transform anchor tags
            return {
                tagName: 'a',
                attribs: {
                    ...attribs,
                    rel: 'nofollow'
                }
            };
        }
    },

    // Text filter
    textFilter: (text) => {
        // Filter or transform text content
        return text.trim();
    }
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
- [DOMPurify](https://github.com/cure53/DOMPurify) - DOM-only, super-fast, uber-tolerant XSS sanitizer
- [xss](https://github.com/leizongmin/js-xss) - XSS filter

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

-   [Daniel Bannert](https://github.com/prisis)
-   [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

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
