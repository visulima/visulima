# FAQ and Troubleshooting

Common questions, solutions, and troubleshooting tips for Boxen.

## Frequently Asked Questions

### General Questions

#### What is Boxen used for?

Boxen is used to create visually appealing boxes around text in terminal applications. It's perfect for:

- CLI application interfaces
- Highlighting important messages (errors, warnings, success)
- Creating menus and interactive prompts
- Displaying formatted data and reports
- Adding visual structure to terminal output

#### How is this different from other box libraries?

Boxen offers:

- Modern TypeScript support with full type definitions
- Flexible color functions instead of simple color strings
- Advanced features like fullscreen boxes and responsive sizing
- Active maintenance and regular updates
- Integration with the Visulima ecosystem

#### Can I use Boxen in production?

Yes! Boxen is production-ready and is used in many CLI applications. It has:

- Comprehensive test coverage
- Stable API
- Active maintenance
- Battle-tested dependencies

### Installation and Setup

#### Which package manager should I use?

Any modern package manager works:

- **npm**: Most widely used, comes with Node.js
- **yarn**: Fast and reliable
- **pnpm**: Efficient disk space usage
- **bun**: Fastest option

Choose based on your project's existing setup.

#### Do I need to install additional dependencies?

No, Boxen includes all required dependencies. However, for colors, we recommend installing `@visulima/colorize`:

```bash
npm install @visulima/colorize
```

#### What Node.js version do I need?

Node.js 20.18 or higher (up to version 24.x). You can check your version with:

```bash
node --version
```

### Usage Questions

#### How do I add colors to my boxes?

Use a color library like `@visulima/colorize` with the color callback functions:

```typescript
import { boxen } from "@visulima/boxen";
import { red, bold } from "@visulima/colorize";

console.log(
    boxen("Error message", {
        textColor: (text) => red(text),
        borderColor: (border) => bold(red(border))
    })
);
```

#### Can I nest boxes inside boxes?

While you can't directly nest boxes, you can create this effect by boxing pre-boxed content:

```typescript
const inner = boxen("Inner", { padding: 1 });
const outer = boxen(inner, { padding: 1, borderStyle: "double" });
console.log(outer);
```

#### How do I make a box fill the terminal width?

Use the `fullscreen` option:

```typescript
boxen("Full width", { fullscreen: true });
```

Or set a specific width:

```typescript
import terminalSize from "terminal-size";

const { columns } = terminalSize();
boxen("Full width", { width: columns - 2 });
```

#### How do I center a box on the screen?

Use the `float` option:

```typescript
boxen("Centered", { 
    float: "center",
    width: 40
});
```

#### Can I animate boxes?

Yes! Clear the console and redraw the box:

```typescript
setInterval(() => {
    console.clear();
    console.log(boxen(`Time: ${new Date().toLocaleTimeString()}`));
}, 1000);
```

#### How do I handle long text?

Boxen automatically wraps text. Control wrapping with the `width` option:

```typescript
const longText = "Very long text...";
boxen(longText, { width: 50 });
```

### Styling Questions

#### Can I use custom border characters?

Yes! Define a custom `BorderStyle`:

```typescript
boxen("Custom", {
    borderStyle: {
        topLeft: "╔",
        topRight: "╗",
        bottomLeft: "╚",
        bottomRight: "╝",
        top: "═",
        bottom: "═",
        left: "║",
        right: "║"
    }
});
```

#### How do I create a gradient border?

Use the `borderColor` function with the `length` parameter:

```typescript
import { red, yellow, green } from "@visulima/colorize";

boxen("Gradient!", {
    borderColor: (border, position, index) => {
        if (index < 33) return red(border);
        if (index < 66) return yellow(border);
        return green(border);
    }
});
```

#### Why aren't my colors showing?

Check these common issues:

1. **Terminal support**: Not all terminals support all colors
2. **Color library**: Make sure you've installed `@visulima/colorize` or another color library
3. **Environment variables**: Some CI/CD environments disable colors

Test terminal color support:

```typescript
import { isColorSupported } from "@visulima/is-ansi-color-supported";

if (isColorSupported()) {
    // Use colors
} else {
    // Fallback to plain text
}
```

#### How do I create different themes?

Create reusable configuration objects:

```typescript
const themes = {
    error: {
        borderStyle: "bold" as const,
        borderColor: (b: string) => red(b),
        textColor: (t: string) => red(t)
    },
    success: {
        borderStyle: "round" as const,
        borderColor: (b: string) => green(b),
        textColor: (t: string) => green(t)
    }
};

console.log(boxen("Error!", themes.error));
console.log(boxen("Success!", themes.success));
```

## Troubleshooting

### Box appears broken or misaligned

**Symptoms:**
- Box borders don't connect properly
- Text overflows the box
- Misaligned corners

**Solutions:**

1. **Check terminal font**: Use a monospace font that supports Unicode box-drawing characters
2. **Terminal width**: Ensure the box fits within your terminal width
3. **ANSI escape codes**: Some terminals don't handle ANSI codes correctly

```typescript
// Set a fixed width to prevent overflow
boxen("text", { width: 50 });
```

### Colors not appearing

**Symptoms:**
- Text appears without colors
- Only seeing plain text

**Solutions:**

1. **Check color library installation**:
```bash
npm install @visulima/colorize
```

2. **Verify terminal support**:
```typescript
import { isColorSupported } from "@visulima/is-ansi-color-supported";
console.log(isColorSupported());
```

3. **Force color mode** (if needed):
```bash
FORCE_COLOR=1 node your-script.js
```

### Box too wide for terminal

**Symptoms:**
- Box wraps to next line
- Layout breaks

**Solutions:**

1. **Use responsive width**:
```typescript
import terminalSize from "terminal-size";

const { columns } = terminalSize();
const maxWidth = Math.min(columns - 4, 80);

boxen("text", { width: maxWidth });
```

2. **Enable text wrapping**:
```typescript
boxen("Long text that will wrap", { 
    width: 60  // Text wraps at this width
});
```

### TypeScript type errors

**Symptoms:**
- Type errors when using options
- Missing type definitions

**Solutions:**

1. **Import types explicitly**:
```typescript
import { type Options } from "@visulima/boxen";

const options: Options = {
    padding: 1
};
```

2. **Update TypeScript**:
```bash
npm install -D typescript@latest
```

3. **Check tsconfig.json**:
```json
{
    "compilerOptions": {
        "moduleResolution": "node",
        "esModuleInterop": true
    }
}
```

### Box doesn't appear in CI/CD

**Symptoms:**
- Works locally but not in CI
- Plain text instead of boxes

**Solutions:**

1. **Check if terminal is interactive**:
```typescript
if (process.stdout.isTTY) {
    console.log(boxen("Interactive"));
} else {
    console.log("Non-interactive: plain text");
}
```

2. **Force enable for CI** (if desired):
```typescript
// Some CI environments need explicit TTY mode
const options = {
    padding: 1,
    // Your options here
};

console.log(boxen("text", options));
```

### Memory issues with large boxes

**Symptoms:**
- Slow performance
- High memory usage

**Solutions:**

1. **Limit box size**:
```typescript
boxen(text, {
    width: 80,
    height: 20  // Prevent excessive height
});
```

2. **Reuse configurations**:
```typescript
const config = { padding: 1, borderStyle: "single" as const };

// Reuse instead of creating new objects
messages.forEach(msg => console.log(boxen(msg, config)));
```

### Character encoding issues

**Symptoms:**
- Strange characters instead of box borders
- Question marks or squares

**Solutions:**

1. **Set terminal encoding**:
```bash
# Unix/Linux
export LANG=en_US.UTF-8

# Windows (PowerShell)
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
```

2. **Use ASCII-safe borders**:
```typescript
boxen("text", {
    borderStyle: "classic"  // Uses +, -, | characters
});
```

3. **Test terminal support**:
```typescript
// Fallback for limited terminals
const isUnicodeSupported = process.platform !== "win32" 
    || process.env.TERM === "xterm-256color";

boxen("text", {
    borderStyle: isUnicodeSupported ? "round" : "classic"
});
```

## Performance Tips

### Optimize for Many Boxes

```typescript
// Cache configuration
const baseConfig = {
    padding: 1,
    borderStyle: "single" as const
};

// Cache color functions
const redText = (t: string) => red(t);

// Reuse in loop
items.forEach(item => {
    console.log(boxen(item, { ...baseConfig, textColor: redText }));
});
```

### Reduce Redraws

```typescript
// Bad: Multiple redraws
items.forEach(item => {
    console.clear();
    console.log(boxen(item));
});

// Good: Build then display
const boxes = items.map(item => boxen(item));
console.clear();
console.log(boxes.join("\n"));
```

## Getting More Help

Still having issues?

1. **Check the examples**: Browse the [examples folder](../examples) for working code
2. **Review the API**: See the [API Reference](./api-reference.md) for detailed documentation
3. **Search issues**: Look through [GitHub issues](https://github.com/visulima/visulima/issues)
4. **Ask for help**: Create a new issue with:
   - Your Node.js version
   - Operating system and terminal
   - Minimal reproduction code
   - Expected vs actual behavior

## Common Patterns

### Conditional Styling

```typescript
function displayMessage(text: string, type: "info" | "error") {
    const config = type === "error"
        ? { borderColor: (b: string) => red(b) }
        : { borderColor: (b: string) => blue(b) };
    
    console.log(boxen(text, { padding: 1, ...config }));
}
```

### Responsive Design

```typescript
import terminalSize from "terminal-size";

function responsiveBox(text: string) {
    const { columns } = terminalSize();
    const width = columns > 100 ? 80 : Math.max(columns - 10, 40);
    
    return boxen(text, { width, padding: 1 });
}
```

### Safe Defaults

```typescript
const safeBoxen = (text: string, options = {}) => {
    try {
        return boxen(text, options);
    } catch (error) {
        // Fallback to simple display
        return text;
    }
};
```
