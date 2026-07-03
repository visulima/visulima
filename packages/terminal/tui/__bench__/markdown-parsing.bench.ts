/* eslint-disable import/no-extraneous-dependencies */
import { Lexer } from "marked";
import { bench, describe } from "vitest";

const SMALL_MD = `# Hello

This is **bold** and *italic*.

\`\`\`js
const x = 1;
\`\`\`
`;

const MEDIUM_MD = `# Project README

## Overview

This is a **complex** markdown document with *various* formatting options.
It includes ~~strikethrough~~, \`inline code\`, and [links](https://example.com).

## Features

- Feature one with **bold** text
- Feature two with *italic* text
- Feature three with \`code\`
  - Nested item A
  - Nested item B

## Code Examples

\`\`\`typescript
interface User {
    name: string;
    age: number;
    email?: string;
}

function greet(user: User): string {
    return \`Hello, \${user.name}!\`;
}

const users: User[] = [
    { name: "Alice", age: 30 },
    { name: "Bob", age: 25 },
];
\`\`\`

## Table

| Feature | Status | Notes |
|---------|--------|-------|
| Parsing | Done | Fast |
| Rendering | Done | Clean |
| Streaming | Done | Incremental |

> This is a blockquote with **bold** text inside.
> It spans multiple lines.

---

1. First ordered item
2. Second ordered item
3. Third ordered item

That's the end of the document.
`;

const LARGE_MD = Array.from(
    { length: 20 },
    (_, i) => `## Section ${i + 1}

Paragraph ${i + 1} with **bold**, *italic*, and \`code\`.

\`\`\`js
function section${i + 1}() {
    return ${i + 1};
}
\`\`\`

- Item A in section ${i + 1}
- Item B in section ${i + 1}

`,
).join("\n");

describe("Markdown Lexer.lex()", () => {
    bench.skipIf(process.env.CODSPEED_ENV)("small (~50 chars)", () => {
        Lexer.lex(SMALL_MD);
    });

    bench.skipIf(process.env.CODSPEED_ENV)("medium (~700 chars)", () => {
        Lexer.lex(MEDIUM_MD);
    });

    bench.skipIf(process.env.CODSPEED_ENV)("large (~4000 chars, 20 sections)", () => {
        Lexer.lex(LARGE_MD);
    });
});

describe("Markdown streaming (incremental re-lex)", () => {
    const chunks = MEDIUM_MD.split("\n");

    bench.skipIf(process.env.CODSPEED_ENV)("incremental lex (line-by-line on medium doc)", () => {
        let accumulated = "";

        for (const chunk of chunks) {
            accumulated += `${chunk}\n`;
            Lexer.lex(accumulated);
        }
    });
});
