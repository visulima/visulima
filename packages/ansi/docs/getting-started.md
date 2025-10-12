# Getting Started

This guide will help you understand the basics of using `@visulima/ansi` to control your terminal.

## Basic Concepts

ANSI escape codes are special sequences of characters that control terminal behavior. Instead of displaying these characters, terminals interpret them as commands to:

- Move the cursor
- Change text color (when combined with color libraries)
- Clear parts of the screen
- Control terminal modes
- And much more

The `@visulima/ansi` library provides JavaScript functions that generate these ANSI sequences for you.

## Your First Example

Let's start with a simple example that demonstrates cursor movement:

```typescript
import { cursorUp, cursorLeft, eraseLine } from "@visulima/ansi";

console.log("First line");
console.log("Second line");
console.log("Third line");

// Move cursor up 2 lines and erase the line
process.stdout.write(cursorUp(2) + eraseLine);
console.log("This replaces the second line!");
```

**What's happening here:**

1. We print three lines normally
2. We move the cursor up 2 lines (to the second line)
3. We erase that line
4. We print new text, which appears on the second line

## Understanding Output Methods

When using ANSI codes, it's important to understand the difference between `console.log()` and `process.stdout.write()`:

```typescript
// console.log() adds a newline at the end
console.log("Hello"); // Prints "Hello\n"

// process.stdout.write() doesn't add a newline
process.stdout.write("Hello"); // Prints "Hello"
```

ANSI sequences don't produce visible output, so we typically use `process.stdout.write()`:

```typescript
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

Here's a practical example of a simple progress indicator:

```typescript
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

**Important:** Always restore cursor visibility before your program exits, especially if it might exit unexpectedly. Use a cleanup handler:

```typescript
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

1. **Always restore terminal state**: Hide cursor? Show it before exit. Change modes? Reset them.

2. **Use appropriate output methods**: 
   - `process.stdout.write()` for ANSI sequences
   - `console.log()` for content you want on a new line

3. **Test in different terminals**: Not all terminals support all features

4. **Handle errors gracefully**: Terminal operations can fail

5. **Combine operations**: Chain multiple ANSI sequences for efficiency
   ```typescript
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

**Nothing appears to happen**: Make sure you're using `process.stdout.write()` for ANSI sequences

**Cursor stays hidden**: Always show the cursor before your program exits

**Content in wrong position**: Remember that `cursorTo(x, y)` uses 0-indexed coordinates

**Works in one terminal but not another**: Some features are terminal-specific (like iTerm2 images)
