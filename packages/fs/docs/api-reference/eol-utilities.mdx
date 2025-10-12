# EOL Utilities

Functions and constants for detecting and formatting end-of-line (EOL) characters.

## Constants

### LF

POSIX line ending (Unix, Linux, macOS).

```typescript
const LF: "\n"
```

### Example

```typescript
import { LF } from "@visulima/fs/eol";

console.log(LF); // "\n"
```

### CRLF

Windows line ending.

```typescript
const CRLF: "\r\n"
```

### Example

```typescript
import { CRLF } from "@visulima/fs/eol";

console.log(CRLF); // "\r\n"
```

### EOL

Platform-specific line ending (runtime constant).

```typescript
const EOL: "\n" | "\r\n"
```

### Example

```typescript
import { EOL } from "@visulima/fs/eol";

// On Unix/Linux/macOS
console.log(EOL); // "\n"

// On Windows
console.log(EOL); // "\r\n"
```

## Functions

### detect

Detects the line ending used in a string. Returns `null` if no newline is found.

#### Signature

```typescript
function detect(content: string): "\n" | "\r\n" | null
```

#### Parameters

- `content` (`string`) - String content to analyze

#### Returns

- `"\n"` - LF line ending detected
- `"\r\n"` - CRLF line ending detected
- `null` - No line ending found

#### Examples

```typescript
import { detect } from "@visulima/fs/eol";

// Detect CRLF (Windows)
const windows = detect("Hello\r\nWorld");
console.log(windows); // "\r\n"

// Detect LF (Unix)
const unix = detect("Hello\nWorld");
console.log(unix); // "\n"

// No newline
const none = detect("HelloWorld");
console.log(none); // null

// Mixed line endings (returns most common)
const mixed = detect("Line1\r\nLine2\r\nLine3\nLine4");
console.log(mixed); // "\r\n" (2 CRLF vs 1 LF)
```

#### Algorithm

The function counts occurrences of CRLF and LF and returns the most common:
- If CRLF count > LF count, returns CRLF
- Otherwise, returns LF
- If no line endings found, returns null

### format

Formats a string to use a specific line ending.

#### Signature

```typescript
function format(
    content: string,
    eol: "\n" | "\r\n"
): string
```

#### Parameters

- `content` (`string`) - String content to format
- `eol` (`"\n" | "\r\n"`) - Target line ending

#### Returns

`string` - Formatted string with consistent line endings

#### Examples

```typescript
import { format, LF, CRLF } from "@visulima/fs/eol";

// Convert to Unix line endings
const unix = format("Hello\r\nWorld\nMixed", LF);
console.log(unix); // "Hello\nWorld\nMixed"

// Convert to Windows line endings
const windows = format("Hello\nWorld\r\nMixed", CRLF);
console.log(windows); // "Hello\r\nWorld\r\nMixed"

// Normalize line endings
const normalized = format(mixedContent, LF);
```

## Common Patterns

### Normalizing File Content

```typescript
import { readFile, writeFile } from "@visulima/fs";
import { detect, format, LF } from "@visulima/fs/eol";

async function normalizeLineEndings(filePath: string) {
    const content = await readFile(filePath);
    const currentEol = detect(content);
    
    if (currentEol !== LF) {
        const normalized = format(content, LF);
        await writeFile(filePath, normalized);
        console.log(`Normalized ${filePath} to LF`);
    }
}

await normalizeLineEndings("./script.sh");
```

### Converting Between Platforms

```typescript
import { readFile, writeFile } from "@visulima/fs";
import { format, LF, CRLF } from "@visulima/fs/eol";

async function convertToWindows(inputPath: string, outputPath: string) {
    const content = await readFile(inputPath);
    const windows = format(content, CRLF);
    await writeFile(outputPath, windows);
}

async function convertToUnix(inputPath: string, outputPath: string) {
    const content = await readFile(inputPath);
    const unix = format(content, LF);
    await writeFile(outputPath, unix);
}

await convertToWindows("./unix-file.txt", "./windows-file.txt");
await convertToUnix("./windows-file.txt", "./unix-file.txt");
```

### Detecting Mixed Line Endings

```typescript
import { readFile } from "@visulima/fs";

async function checkLineEndings(filePath: string) {
    const content = await readFile(filePath);
    
    const hasCRLF = content.includes("\r\n");
    const hasLF = content.replace(/\r\n/g, "").includes("\n");
    
    if (hasCRLF && hasLF) {
        console.warn(`${filePath} has mixed line endings!`);
        return "mixed";
    } else if (hasCRLF) {
        console.log(`${filePath} uses CRLF (Windows)`);
        return "crlf";
    } else if (hasLF) {
        console.log(`${filePath} uses LF (Unix)`);
        return "lf";
    } else {
        console.log(`${filePath} has no line endings`);
        return "none";
    }
}

await checkLineEndings("./file.txt");
```

### Batch Processing

```typescript
import { walk, readFile, writeFile } from "@visulima/fs";
import { detect, format, LF } from "@visulima/fs/eol";

async function normalizeProject(directory: string) {
    let normalized = 0;
    
    for await (const entry of walk(directory, {
        extensions: [".js", ".ts", ".md", ".txt"],
        skip: ["node_modules", ".git"],
    })) {
        if (!entry.isFile) continue;
        
        const content = await readFile(entry.path);
        const currentEol = detect(content);
        
        if (currentEol && currentEol !== LF) {
            const formatted = format(content, LF);
            await writeFile(entry.path, formatted);
            normalized++;
            console.log(`Normalized: ${entry.path}`);
        }
    }
    
    console.log(`Normalized ${normalized} files`);
}

await normalizeProject("./src");
```

### Platform-Specific Output

```typescript
import { EOL } from "@visulima/fs/eol";
import { writeFile } from "@visulima/fs";

async function writeLog(message: string) {
    // Automatically use platform-specific line endings
    const log = `[${new Date().toISOString()}] ${message}${EOL}`;
    await writeFile("./app.log", log, { flag: "a" });
}

await writeLog("Application started");
await writeLog("Processing data");
```

### Git Configuration Helper

```typescript
import { detect, LF, CRLF } from "@visulima/fs/eol";
import { readFile } from "@visulima/fs";

async function checkGitEOL(filePath: string) {
    const content = await readFile(filePath);
    const eol = detect(content);
    
    if (!eol) {
        return "No line endings detected";
    }
    
    const gitConfig = eol === LF ? "lf" : "crlf";
    
    return `File uses ${eol === LF ? "LF" : "CRLF"} line endings.
            Recommended .gitattributes: * text=auto eol=${gitConfig}`;
}

const result = await checkGitEOL("./README.md");
console.log(result);
```

### Validation in CI/CD

```typescript
import { walk, readFile } from "@visulima/fs";
import { detect, LF } from "@visulima/fs/eol";

async function validateLineEndings(directory: string): Promise<boolean> {
    const violations: string[] = [];
    
    for await (const entry of walk(directory, {
        extensions: [".js", ".ts", ".json", ".md"],
        skip: ["node_modules", "dist"],
    })) {
        if (!entry.isFile) continue;
        
        const content = await readFile(entry.path);
        const eol = detect(content);
        
        if (eol && eol !== LF) {
            violations.push(entry.path);
        }
    }
    
    if (violations.length > 0) {
        console.error("Files with incorrect line endings:");
        violations.forEach(file => console.error(`  - ${file}`));
        return false;
    }
    
    console.log("All files have correct line endings (LF)");
    return true;
}

// Usage in CI/CD
const isValid = await validateLineEndings("./src");
if (!isValid) {
    process.exit(1);
}
```

## Platform Considerations

### Windows

- Default line ending: CRLF (`\r\n`)
- Most text editors handle both LF and CRLF
- Git can be configured to auto-convert line endings

### Unix/Linux/macOS

- Default line ending: LF (`\n`)
- CRLF is typically not used
- Some tools may have issues with CRLF

### Git Configuration

Configure Git to handle line endings automatically:

```bash
# Global configuration
git config --global core.autocrlf true  # Windows
git config --global core.autocrlf input # Unix/Mac

# Per-repository (.gitattributes)
* text=auto
*.sh text eol=lf
*.bat text eol=crlf
```

## Best Practices

1. **Consistency**: Use LF for cross-platform compatibility
2. **Git Integration**: Configure `.gitattributes` for automatic handling
3. **Validation**: Check line endings in CI/CD pipelines
4. **Documentation**: Document the project's line ending convention
5. **Editor Configuration**: Set up `.editorconfig` for team consistency

### EditorConfig Example

```ini
# .editorconfig
root = true

[*]
end_of_line = lf
insert_final_newline = true

[*.bat]
end_of_line = crlf
```

## Related

- [File Operations](./file-operations.md)
- [Git Documentation](https://git-scm.com/docs/gitattributes#_end_of_line_conversion)
