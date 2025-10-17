---
title: Getting Started
description: Learn the basics of using @visulima/ansi for terminal control
---

import { Callout } from 'fumadocs-ui/components/callout';
import { Steps, Step } from 'fumadocs-ui/components/steps';
import { Accordions, Accordion } from 'fumadocs-ui/components/accordion';

## Basic Concepts

<Callout>
ANSI escape codes are special character sequences that control terminal behavior. The `@visulima/ansi` library provides JavaScript functions that generate these sequences for you.
</Callout>

**What ANSI codes can do:**
- Move the cursor
- Clear parts of the screen
- Control terminal modes
- Handle mouse events
- Create hyperlinks

## Your First Example

```typescript title="first-example.ts"
import { cursorUp, cursorLeft, eraseLine } from "@visulima/ansi";

console.log("First line");
console.log("Second line");
console.log("Third line");

// Move cursor up 2 lines and erase the line
process.stdout.write(cursorUp(2) + eraseLine);
console.log("This replaces the second line!");
```

<Steps>

### Print three lines
We output three lines normally using `console.log()`

### Move cursor up
We move the cursor up 2 lines (to the second line)

### Erase and replace
We erase that line and print new text in its place

</Steps>

## Output Methods

<Callout type="warn">
Understanding the difference between `console.log()` and `process.stdout.write()` is crucial.
</Callout>

```typescript title="output-methods.ts"
// console.log() adds a newline at the end
console.log("Hello"); // Prints "Hello\n"

// process.stdout.write() doesn't add a newline
process.stdout.write("Hello"); // Prints "Hello"
```

**For ANSI sequences:**

```typescript title="ansi-output.ts"
import { cursorTo, eraseLine } from "@visulima/ansi";

// Move cursor and erase (no visible output yet)
process.stdout.write(cursorTo(0, 0) + eraseLine);

// Now print visible content
console.log("Content at top-left corner");
```

## Common Use Cases

### Cursor Positioning

Move the cursor to specific positions:

```typescript
import { cursorTo } from "@visulima/ansi";

// Move to column 10, row 5 (0-indexed)
process.stdout.write(cursorTo(10, 5));
console.log("Text at position (10, 5)");

// Move to column 20 on the current line
process.stdout.write(cursorTo(20));
console.log("Text at column 20");
```

### Clearing Screen Content

```typescript
import { clearScreen, eraseLine, eraseDown } from "@visulima/ansi";

// Clear the entire screen
process.stdout.write(clearScreen);

// Clear from cursor to end of line
process.stdout.write(eraseLine);

// Clear from cursor to end of screen
process.stdout.write(eraseDown);
```

### Creating a Progress Indicator

```typescript title="progress.ts"
import { cursorTo, eraseLine, cursorHide, cursorShow } from "@visulima/ansi";

async function showProgress() {
    process.stdout.write(cursorHide);
    
    for (let i = 0; i <= 100; i++) {
        process.stdout.write(cursorTo(0) + eraseLine);
        process.stdout.write(`Progress: ${"█".repeat(i / 2)}${" ".repeat(50 - i / 2)} ${i}%`);
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    process.stdout.write("\n" + cursorShow);
}

showProgress();
```

### Interactive Menu

Create a simple interactive menu:

```typescript
import { cursorUp, cursorTo, eraseLine } from "@visulima/ansi";

function displayMenu(selectedIndex: number) {
    const options = ["Option 1", "Option 2", "Option 3", "Exit"];
    
    // Move cursor to menu start
    if (selectedIndex > 0) {
        process.stdout.write(cursorUp(options.length));
    }
    
    // Display options
    options.forEach((option, index) => {
        process.stdout.write(cursorTo(0) + eraseLine);
        const prefix = index === selectedIndex ? "> " : "  ";
        console.log(`${prefix}${option}`);
    });
}

// Display initial menu
displayMenu(0);

// Simulate selection change
setTimeout(() => displayMenu(1), 1000);
setTimeout(() => displayMenu(2), 2000);
```

## Cursor Visibility

Control cursor visibility for cleaner output:

```typescript
import { cursorHide, cursorShow } from "@visulima/ansi";

// Hide cursor during operations
process.stdout.write(cursorHide);

console.log("Doing something...");
// ... perform operations ...

// Show cursor again
process.stdout.write(cursorShow);
```

<Callout type="warn">
Always restore cursor visibility before your program exits!
</Callout>

```typescript title="cleanup.ts"
import { cursorShow } from "@visulima/ansi";
import { restoreCursor } from "@visulima/ansi/cursor";

// Ensure cursor is shown on exit
process.on("exit", () => {
    process.stdout.write(cursorShow);
});

// Or use the restore-cursor utility
restoreCursor();
```

## Working with Hyperlinks

Create clickable links in supported terminals:

```typescript
import hyperlink from "@visulima/ansi/hyperlink";

const link = hyperlink("Visit Visulima", "https://visulima.com");
console.log(`Documentation: ${link}`);
```

## Stripping ANSI Codes

Remove ANSI codes from strings:

```typescript
import strip from "@visulima/ansi/strip";

const styledText = "\x1b[32mHello\x1b[0m \x1b[1mWorld\x1b[0m";
const plainText = strip(styledText);

console.log(plainText); // Output: "Hello World"
```

This is useful for:
- Calculating actual string length
- Logging to files
- Sending to systems that don't support ANSI

## Combining with Color Libraries

`@visulima/ansi` focuses on terminal control, not colors. Combine it with color libraries:

```typescript
import { cursorTo, eraseLine } from "@visulima/ansi";
import chalk from "chalk";

process.stdout.write(cursorTo(0, 0) + eraseLine);
console.log(chalk.green("Success:") + " Operation completed!");
```

Or use `@visulima/colorize`:

```typescript
import { cursorTo } from "@visulima/ansi";
import { green, bold } from "@visulima/colorize";

process.stdout.write(cursorTo(0, 0));
console.log(green("Success:"), bold("Operation completed!"));
```

## Best Practices

<Callout>
Follow these guidelines for reliable terminal applications.
</Callout>

1. **Always restore terminal state** - Reset cursor visibility and modes before exit
2. **Use appropriate output methods** - `process.stdout.write()` for ANSI, `console.log()` for content
3. **Test in different terminals** - Not all terminals support all features
4. **Handle errors gracefully** - Terminal operations can fail
5. **Combine operations** - Chain sequences for efficiency

```typescript title="best-practice.ts"
// Good - single write
process.stdout.write(cursorTo(0, 0) + eraseLine);

// Less efficient - multiple writes
process.stdout.write(cursorTo(0, 0));
process.stdout.write(eraseLine);
```

## Next Steps

- Explore [Examples](./examples.md) for real-world use cases
- Check the [API Reference](./api-reference.md) for all available functions
- Read [Advanced Usage](./advanced.md) for complex scenarios

## Troubleshooting

<Accordions>
  <Accordion title="Nothing appears to happen">
    Make sure you're using `process.stdout.write()` for ANSI sequences.
  </Accordion>
  
  <Accordion title="Cursor stays hidden">
    Always show the cursor before your program exits using `cursorShow` or `restoreCursor()`.
  </Accordion>
  
  <Accordion title="Content in wrong position">
    Remember that `cursorTo(x, y)` uses 0-indexed coordinates.
  </Accordion>
  
  <Accordion title="Works in one terminal but not another">
    Some features are terminal-specific (like iTerm2 images). Always test across different terminals.
  </Accordion>
</Accordions>
