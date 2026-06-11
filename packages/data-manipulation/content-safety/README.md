<!-- START_PACKAGE_OG_IMAGE_PLACEHOLDER -->

<a href="https://www.anolilab.com/open-source" align="center">

  <img src="__assets__/package-og.svg" alt="content-safety" />

</a>

<h3 align="center">Content safety filtering with multi-language banned word detection. Supports 19 languages with word-boundary matching, match position reporting, and both browser and server runtime compatibility.</h3>

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

### Key Features

- **Multi-Language Support**: 19 languages including English, German, Spanish, French, Italian, Russian, Arabic, Japanese, Korean, Chinese, Hindi, and more
- **High Performance**: Map/Set lookups with lazily-built tables and a single-pass CJK matcher — no giant-regex JIT cost
- **Language Filtering**: Restrict checks to specific languages to avoid cross-language false positives
- **Built-in Censoring**: One-call `censorText()` masks matches without manual index bookkeeping
- **Custom Dictionaries & Allowlists**: `createChecker()` for domain-specific words, the Scunthorpe problem, and `category`/`severity` metadata
- **Precise Position Tracking**: Returns exact indices for highlighting or censoring
- **Unicode-Aware**: Full support for CJK, RTL scripts, complex scripts, and diacritics
- **Case-Insensitive**: Matches regardless of capitalization
- **Multi-Word Phrases**: Detects compound expressions like "white trash"
- **Leet-Speak Detection**: Includes common variants (e.g., "b1tch")
- **Zero Dependencies**: Pure TypeScript, works everywhere (Node.js, browsers, edge functions)

## Install

```sh
npm install @visulima/content-safety
```

```sh
yarn add @visulima/content-safety
```

```sh
pnpm add @visulima/content-safety
```

## Usage

### Basic Usage

```typescript
import { checkBannedWords } from "@visulima/content-safety";

// Check clean text
const result = checkBannedWords("Hello, how are you today?");
console.log(result.hasBannedWords); // false
console.log(result.matches); // []

// Check text with banned words
const result2 = checkBannedWords("This contains badword");
console.log(result2.hasBannedWords); // true
console.log(result2.matches);
// [
//   {
//     word: "badword",
//     startIndex: 14,
//     endIndex: 21,
//     language: "en"
//   }
// ]
```

### Content Moderation

Reject content containing inappropriate language:

```typescript
import { checkBannedWords } from "@visulima/content-safety";

function moderateContent(userInput: string) {
    const result = checkBannedWords(userInput);

    if (result.hasBannedWords) {
        return {
            allowed: false,
            reason: `Content contains ${result.matches.length} inappropriate word(s)`,
        };
    }

    return { allowed: true };
}
```

### Text Censoring

Mask banned words in a single call:

```typescript
import { censorText } from "@visulima/content-safety";

console.log(censorText("This is badword text"));
// "This is ******* text"

// Use a custom mask character
console.log(censorText("This is badword text", { replacement: "#" }));
// "This is ####### text"
```

`censorText` masks overlapping matches once (longest wins), so the output length always equals the input length.

### Restricting Languages

By default every language dictionary is checked, which can cause cross-language false positives
(e.g. Latin transliterations from the Russian or Arabic lists). Restrict the check to the languages
you actually support:

```typescript
import { checkBannedWords } from "@visulima/content-safety";

const result = checkBannedWords("some user text", { languages: ["en"] });
```

### Custom Dictionaries, Allowlists & Severity

`BANNED_WORDS` is frozen — mutating it has no effect. Use `createChecker` to match against your own
dictionary, allowlist domain-specific terms (the Scunthorpe problem), or attach `category`/`severity`
metadata that is surfaced on every match:

```typescript
import { createChecker } from "@visulima/content-safety";

const checker = createChecker({
    words: {
        en: [{ word: "frobnicate", category: "spam", severity: 1 }],
    },
    allowlist: ["scunthorpe"],
});

const result = checker.check("please do not frobnicate");
console.log(result.matches[0]?.category); // "spam"
console.log(result.matches[0]?.severity); // 1

console.log(checker.censor("frobnicate now")); // "********** now"
```

Lookup tables are built lazily on first use, so creating a checker is cheap.

### Highlighting Matches

Create UI highlighting for banned words:

```typescript
import { checkBannedWords } from "@visulima/content-safety";

interface HighlightSegment {
    text: string;
    isBanned: boolean;
    language?: string;
}

function highlightBannedWords(text: string): HighlightSegment[] {
    const result = checkBannedWords(text);

    if (!result.hasBannedWords) {
        return [{ text, isBanned: false }];
    }

    const segments: HighlightSegment[] = [];
    let lastIndex = 0;

    for (const match of result.matches) {
        // Add clean text before match
        if (match.startIndex > lastIndex) {
            segments.push({
                text: text.slice(lastIndex, match.startIndex),
                isBanned: false,
            });
        }

        // Add banned word
        segments.push({
            text: match.word,
            isBanned: true,
            language: match.language,
        });

        lastIndex = match.endIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
        segments.push({
            text: text.slice(lastIndex),
            isBanned: false,
        });
    }

    return segments;
}
```

### Multi-Language Detection

The library automatically checks all 19 languages:

```typescript
import { checkBannedWords } from "@visulima/content-safety";

const result = checkBannedWords(`
  English bad word
  German bad word
  日本語 bad word
`);

// All languages detected automatically
result.matches.forEach((match) => {
    console.log(`Found "${match.word}" from ${match.language}`);
});
```

### Access Word Lists

```typescript
import { BANNED_WORDS } from "@visulima/content-safety";

// View available languages
console.log(Object.keys(BANNED_WORDS));
// ['ar', 'az', 'de', 'en', 'es', 'fa', 'fr', 'ga', 'hi', 'it', 'ja', 'ko', 'nl', 'pl', 'pt', 'ru', 'sv', 'tr', 'zh']

// Check English word count
console.log(BANNED_WORDS.en.length);
```

## API

### checkBannedWords(text: string, options?: CheckOptions): BannedWordsResult

Checks text for banned words across the configured languages.

**Parameters:**

- `text` (string): The text to check
- `options` (`CheckOptions`, optional): `{ languages?: string[] }` — restrict the check to specific language codes

**Returns:** `BannedWordsResult`

```typescript
interface BannedWordsResult {
    hasBannedWords: boolean; // true if any banned words found
    matches: BannedWordMatch[]; // Array of matches
}

interface BannedWordMatch {
    word: string; // Matched word/phrase
    startIndex: number; // Start position (inclusive)
    endIndex: number; // End position (exclusive)
    language: string; // ISO 639-1 language code
    category?: string; // Optional moderation category (custom dictionaries)
    severity?: number; // Optional severity score (custom dictionaries)
}
```

### censorText(text: string, options?: CensorOptions): string

Masks banned words in `text`. Returns the input unchanged when nothing matches.

**Parameters:**

- `text` (string): The text to censor
- `options` (`CensorOptions`, optional): `{ replacement?: string; languages?: string[] }` — mask character (defaults to `"*"`) and optional language restriction

### createChecker(options?: CreateCheckerOptions): Checker

Creates a reusable checker bound to a custom dictionary and/or allowlist.

**Parameters:**

- `options` (`CreateCheckerOptions`, optional):
    - `words?: BannedWordDictionary` — `Record<string, (string | BannedWordEntry)[]>`; defaults to the built-in lists
    - `allowlist?: string[]` — words that are never reported (case-insensitive)

**Returns:** `Checker` with `check(text, options?)` and `censor(text, options?)` methods.

```typescript
interface BannedWordEntry {
    word: string;
    category?: string;
    severity?: number;
}
```

### BANNED_WORDS: Record<string, readonly string[]>

Dictionary of banned words organized by language code.

**Structure:**

```typescript
{
  en: ["word1", "word2", ...],  // English
  de: ["word1", "word2", ...],  // German
  ja: ["word1", "word2", ...],  // Japanese
  // ... 19 languages total
}
```

## Supported Languages

The library includes banned word lists for **19 languages**:

| Code | Language      | Script                  |
| ---- | ------------- | ----------------------- |
| ar   | Arabic        | Arabic (RTL)            |
| az   | Azerbaijani   | Latin                   |
| de   | German        | Latin                   |
| en   | English       | Latin                   |
| es   | Spanish       | Latin                   |
| fa   | Persian/Farsi | Perso-Arabic (RTL)      |
| fr   | French        | Latin                   |
| ga   | Irish         | Latin                   |
| hi   | Hindi         | Devanagari              |
| it   | Italian       | Latin                   |
| ja   | Japanese      | Hiragana/Katakana/Kanji |
| ko   | Korean        | Hangul                  |
| nl   | Dutch         | Latin                   |
| pl   | Polish        | Latin                   |
| pt   | Portuguese    | Latin                   |
| ru   | Russian       | Cyrillic                |
| sv   | Swedish       | Latin                   |
| tr   | Turkish       | Latin                   |
| zh   | Chinese       | Simplified/Traditional  |

## Browser & Runtime Support

Works in all modern environments:

- Node.js 18+
- Browsers (Chrome, Firefox, Safari, Edge)
- Deno
- Bun
- Edge Functions (Vercel, Cloudflare Workers)
- React Native
- Electron

## Documentation

For detailed documentation, visit the [documentation site](https://visulima.com/docs/package/content-safety).

## Related

- [@visulima/string](https://www.npmjs.com/package/@visulima/string) - String manipulation utilities
- [@visulima/redact](https://www.npmjs.com/package/@visulima/redact) - Redact sensitive information from strings

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

The visulima content-safety is open-sourced software licensed under the [MIT][license]

<!-- badges -->

[license-badge]: https://img.shields.io/npm/l/@visulima/content-safety?style=for-the-badge
[license]: https://github.com/visulima/visulima/blob/main/LICENSE
[npm-downloads-badge]: https://img.shields.io/npm/dm/@visulima/content-safety?style=for-the-badge
[npm-downloads]: https://www.npmjs.com/package/@visulima/content-safety
[prs-welcome-badge]: https://img.shields.io/badge/PRs-welcome-brightgreen.svg?style=for-the-badge
[prs-welcome]: https://github.com/visulima/visulima/blob/main/.github/CONTRIBUTING.md
[chat-badge]: https://img.shields.io/discord/932323359193186354.svg?style=for-the-badge
[chat]: https://discord.gg/TtFJY8xkFK
[typescript-badge]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/
