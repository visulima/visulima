# AI Integration

Learn how to use AI-powered error analysis and solution generation with `@visulima/error`.

## Overview

The AI integration feature allows you to leverage large language models (LLMs) to:

- Analyze complex errors
- Generate context-aware solutions
- Provide detailed explanations
- Suggest debugging strategies

## Requirements

The AI integration requires the optional `ai` peer dependency:

```bash
# pnpm
pnpm add ai

# npm
npm install ai

# yarn
yarn add ai
```

You'll also need an API key from a supported AI provider:

- OpenAI (GPT-3.5, GPT-4, etc.)
- Anthropic (Claude)
- Google (Gemini)
- Mistral
- Other providers supported by the `ai` package

## Basic Usage

### Using AI Finder

```typescript
import { aiFinder } from "@visulima/error/solution/ai";
import { createOpenAI } from "@ai-sdk/openai";

// Create an OpenAI client
const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Create AI finder
const finder = aiFinder(openai("gpt-4"), {
    temperature: 0  // More deterministic responses
});

// Analyze an error
const error = new Error("Cannot read property 'x' of undefined");

const solution = await finder.handle(error, {
    file: "/app/src/index.ts",
    line: 42,
    language: "typescript",
    snippet: "const value = obj.x;"
});

if (solution) {
    console.log(solution.header); // Optional header
    console.log(solution.body);   // AI-generated solution
}
```

### Different AI Providers

#### OpenAI

```typescript
import { aiFinder } from "@visulima/error/solution/ai";
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const finder = aiFinder(openai("gpt-4"), {
    temperature: 0
});
```

#### Anthropic (Claude)

```typescript
import { aiFinder } from "@visulima/error/solution/ai";
import { createAnthropic } from "@ai-sdk/anthropic";

const anthropic = createAnthropic({
    apiKey: process.env.ANTHROPIC_API_KEY
});

const finder = aiFinder(anthropic("claude-3-5-sonnet-20241022"), {
    temperature: 0
});
```

#### Google (Gemini)

```typescript
import { aiFinder } from "@visulima/error/solution/ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";

const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY
});

const finder = aiFinder(google("gemini-1.5-pro"), {
    temperature: 0
});
```

## AI Prompt Generation

### Manual Prompt Creation

For custom implementations, generate prompts without the finder:

```typescript
import { aiPrompt } from "@visulima/error/solution/ai";

const error = new Error("Database connection failed");

const prompt = aiPrompt({
    error,
    file: {
        file: "/app/database.ts",
        line: 25,
        language: "typescript",
        snippet: "await db.connect();"
    },
    applicationType: "node"  // Optional: helps AI provide relevant advice
});

// Send to your own LLM implementation
const response = await yourLLM.generate(prompt);
```

### Custom Application Context

```typescript
const prompt = aiPrompt({
    error,
    file: fileContext,
    applicationType: "react"  // or "nextjs", "express", "nestjs", etc.
});
```

## Response Formatting

### Format AI Response as HTML

```typescript
import { aiSolutionResponse } from "@visulima/error/solution/ai";

const llmResponse = `
The error occurs because the object is undefined.

## Solution

Check if the object exists before accessing properties:

\`\`\`typescript
if (obj && obj.x) {
  const value = obj.x;
}
\`\`\`
`;

const html = aiSolutionResponse(llmResponse);
// Returns formatted HTML with syntax highlighting
```

## Complete Example

### Error Handler with AI

```typescript
import { aiFinder } from "@visulima/error/solution/ai";
import { renderError, codeFrame } from "@visulima/error";
import { createOpenAI } from "@ai-sdk/openai";
import { readFileSync } from "fs";
import { red, cyan } from "@visulima/colorize";

class AIErrorHandler {
    private finder;
    
    constructor(apiKey: string, model: string = "gpt-4") {
        const openai = createOpenAI({ apiKey });
        this.finder = aiFinder(openai(model), {
            temperature: 0
        });
    }
    
    async handle(error: Error, filePath: string, line: number) {
        // Display the error
        console.error(renderError(error, {
            color: {
                title: red,
                message: red
            }
        }));
        
        // Read source code
        const source = readFileSync(filePath, "utf-8");
        const snippet = codeFrame(source, {
            start: { line, column: 1 }
        });
        
        // Get AI solution
        console.log(cyan("\nAnalyzing error with AI...\n"));
        
        const solution = await this.finder.handle(error, {
            file: filePath,
            line,
            language: this.getLanguage(filePath),
            snippet
        });
        
        if (solution) {
            console.log(cyan("AI Suggestion:"));
            console.log(solution.body);
        }
    }
    
    private getLanguage(filePath: string): string {
        if (filePath.endsWith(".ts")) return "typescript";
        if (filePath.endsWith(".tsx")) return "tsx";
        if (filePath.endsWith(".js")) return "javascript";
        if (filePath.endsWith(".jsx")) return "jsx";
        return "javascript";
    }
}

// Usage
const handler = new AIErrorHandler(process.env.OPENAI_API_KEY);

try {
    // Application code
} catch (error) {
    await handler.handle(error, __filename, 42);
}
```

## Combining with Other Finders

### Hybrid Approach

Use rule-based finders first, fall back to AI:

```typescript
import { ruleBasedFinder, errorHintFinder } from "@visulima/error";
import { aiFinder } from "@visulima/error/solution/ai";
import { createOpenAI } from "@ai-sdk/openai";

class HybridFinder {
    private aiFinder;
    
    constructor(apiKey: string) {
        const openai = createOpenAI({ apiKey });
        this.aiFinder = aiFinder(openai("gpt-4"), { temperature: 0 });
    }
    
    async findSolution(error: Error, fileContext: SolutionFinderFile) {
        // Try error hints first (fast, no API call)
        let solution = await errorHintFinder.handle(error, fileContext);
        if (solution) {
            return { ...solution, source: "hint" };
        }
        
        // Try rule-based finder (fast, no API call)
        solution = await ruleBasedFinder.handle(error, fileContext);
        if (solution) {
            return { ...solution, source: "rules" };
        }
        
        // Fall back to AI (slower, costs API credits)
        solution = await this.aiFinder.handle(error, fileContext);
        if (solution) {
            return { ...solution, source: "ai" };
        }
        
        return undefined;
    }
}
```

## Cost Optimization

### Cache AI Responses

```typescript
import { aiFinder } from "@visulima/error/solution/ai";
import type { Solution, SolutionFinderFile } from "@visulima/error";

class CachedAIFinder {
    private cache = new Map<string, Solution | undefined>();
    private finder;
    
    constructor(apiKey: string) {
        const openai = createOpenAI({ apiKey });
        this.finder = aiFinder(openai("gpt-4"), { temperature: 0 });
    }
    
    private getCacheKey(error: Error, file: SolutionFinderFile): string {
        return `${error.name}:${error.message}:${file.file}:${file.line}`;
    }
    
    async handle(error: Error, file: SolutionFinderFile) {
        const key = this.getCacheKey(error, file);
        
        if (this.cache.has(key)) {
            return this.cache.get(key);
        }
        
        const solution = await this.finder.handle(error, file);
        this.cache.set(key, solution);
        
        return solution;
    }
}
```

### Use Only in Development

```typescript
import { aiFinder } from "@visulima/error/solution/ai";

const useAI = process.env.NODE_ENV === "development" && 
              process.env.OPENAI_API_KEY;

const finder = useAI 
    ? aiFinder(openai("gpt-4"), { temperature: 0 })
    : undefined;

// Only use AI in development
if (finder) {
    const solution = await finder.handle(error, fileContext);
}
```

### Use Cheaper Models

```typescript
// Use GPT-3.5-turbo for common errors (cheaper)
const cheapFinder = aiFinder(openai("gpt-3.5-turbo"), {
    temperature: 0
});

// Use GPT-4 only for complex errors
const advancedFinder = aiFinder(openai("gpt-4"), {
    temperature: 0
});

function selectFinder(error: Error) {
    if (isComplexError(error)) {
        return advancedFinder;
    }
    return cheapFinder;
}
```

## Best Practices

### 1. Provide Rich Context

```typescript
// Good - Include source code and details
const solution = await finder.handle(error, {
    file: "/app/src/database.ts",
    line: 42,
    language: "typescript",
    snippet: codeFrame(source, { start: { line: 42, column: 1 } })
});

// Less effective - Minimal context
const solution = await finder.handle(error, {
    file: "",
    line: 0
});
```

### 2. Handle API Failures Gracefully

```typescript
async function getAISolution(error: Error, fileContext: SolutionFinderFile) {
    try {
        const solution = await aiFinder.handle(error, fileContext);
        return solution;
    } catch (apiError) {
        console.error("AI analysis failed:", apiError.message);
        return undefined;
    }
}
```

### 3. Set Appropriate Timeouts

```typescript
async function getAISolutionWithTimeout(
    error: Error,
    fileContext: SolutionFinderFile,
    timeoutMs: number = 10000
) {
    const timeoutPromise = new Promise<undefined>((resolve) =>
        setTimeout(() => resolve(undefined), timeoutMs)
    );
    
    return Promise.race([
        finder.handle(error, fileContext),
        timeoutPromise
    ]);
}
```

### 4. Temperature Settings

```typescript
// Deterministic, consistent answers (recommended)
aiFinder(model, { temperature: 0 });

// More creative, varied responses
aiFinder(model, { temperature: 0.7 });

// Very creative (not recommended for errors)
aiFinder(model, { temperature: 1.0 });
```

## Privacy Considerations

### Sanitize Error Data

```typescript
function sanitizeError(error: Error): Error {
    const sanitized = new Error(error.message);
    sanitized.name = error.name;
    
    // Remove potentially sensitive information
    if (error.stack) {
        sanitized.stack = error.stack
            .replace(/\/home\/[^\/]+/g, "/home/user")
            .replace(/\/Users\/[^\/]+/g, "/Users/user")
            .replace(/token=[^&\s]+/gi, "token=REDACTED")
            .replace(/key=[^&\s]+/gi, "key=REDACTED");
    }
    
    return sanitized;
}

// Use sanitized error with AI
const solution = await finder.handle(sanitizeError(error), fileContext);
```

### Local AI Models

For maximum privacy, use local models:

```typescript
import { aiFinder } from "@visulima/error/solution/ai";
import { createOpenAI } from "@ai-sdk/openai";

// Point to local Ollama instance
const local = createOpenAI({
    baseURL: "http://localhost:11434/v1",
    apiKey: "ollama"  // Not needed for local
});

const finder = aiFinder(local("llama2"), {
    temperature: 0
});
```

## Development Workflow Integration

### VS Code Error Lens

```typescript
import { aiFinder } from "@visulima/error/solution/ai";
import vscode from "vscode";

async function provideAISuggestion(diagnostic: vscode.Diagnostic) {
    const error = new Error(diagnostic.message);
    const document = vscode.window.activeTextEditor?.document;
    
    if (!document) return;
    
    const solution = await finder.handle(error, {
        file: document.fileName,
        line: diagnostic.range.start.line + 1,
        language: document.languageId,
        snippet: document.getText(diagnostic.range)
    });
    
    if (solution) {
        vscode.window.showInformationMessage(solution.body);
    }
}
```

### CLI Tool

```typescript
#!/usr/bin/env node
import { aiFinder } from "@visulima/error/solution/ai";
import { createOpenAI } from "@ai-sdk/openai";

const openai = createOpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

const finder = aiFinder(openai("gpt-4"), { temperature: 0 });

async function main() {
    const errorMessage = process.argv[2];
    const filePath = process.argv[3];
    const line = parseInt(process.argv[4]) || 0;
    
    const error = new Error(errorMessage);
    
    console.log("Analyzing error with AI...\n");
    
    const solution = await finder.handle(error, {
        file: filePath,
        line
    });
    
    if (solution) {
        console.log(solution.body);
    } else {
        console.log("No solution found");
    }
}

main();
```

## TypeScript Types

```typescript
import type { LanguageModel } from "ai";
import type { Solution, SolutionFinderFile } from "@visulima/error";

// AI Finder options
interface AIFinderOptions {
    temperature?: number;
}

// Create typed finder
function createAIFinder(
    model: LanguageModel,
    options?: AIFinderOptions
): (error: Error, file: SolutionFinderFile) => Promise<Solution | undefined>;
```

## See Also

- [Solution Finders](./solution-finders.md)
- [API Reference](./api-reference.md)
- [Examples](./examples.md)
- [ai SDK Documentation](https://sdk.vercel.ai/)
