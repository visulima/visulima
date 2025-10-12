# Styling Options

Take your boxes to the next level with colors, gradients, and custom borders. This guide covers all the styling capabilities of Boxen.

## Adding Colors

While Boxen doesn't include color utilities by default, it works seamlessly with color libraries. We recommend using `@visulima/colorize`:

```bash
npm install @visulima/colorize
```

### Text Colors

Color the text inside your box:

```typescript
import { boxen } from "@visulima/boxen";
import { red, green, blue, bold } from "@visulima/colorize";

console.log(
    boxen("Error occurred!", {
        textColor: (text) => red(text),
        padding: 1
    })
);

console.log(
    boxen("Success!", {
        textColor: (text) => bold(green(text)),
        padding: 1
    })
);
```

### Border Colors

Add color to your box borders:

```typescript
import { red } from "@visulima/colorize";

console.log(
    boxen("Red border", {
        borderColor: (border) => red(border)
    })
);
```

### Multi-Colored Borders

Create borders with different colors on each side:

```typescript
import { red, green, yellow, blue } from "@visulima/colorize";

console.log(
    boxen("Rainbow box!", {
        padding: 1,
        borderColor: (border, position) => {
            if (["top", "topLeft", "topRight"].includes(position)) {
                return red(border);
            }
            if (position === "left") {
                return yellow(border);
            }
            if (position === "right") {
                return green(border);
            }
            if (["bottom", "bottomLeft", "bottomRight"].includes(position)) {
                return blue(border);
            }
            return border;
        }
    })
);
```

### Header and Footer Colors

Style your headers and footers:

```typescript
import { bold, cyan, gray } from "@visulima/colorize";

console.log(
    boxen("Important content here", {
        padding: 1,
        headerText: "NOTICE",
        headerTextColor: (text) => bold(cyan(text)),
        footerText: "End of notice",
        footerTextColor: (text) => gray(text)
    })
);
```

## Custom Border Characters

Create completely custom borders by defining each character:

```typescript
console.log(
    boxen("Custom border", {
        borderStyle: {
            topLeft: "╭",
            topRight: "╮",
            bottomLeft: "╰",
            bottomRight: "╯",
            top: "─",
            bottom: "─",
            left: "│",
            right: "│"
        }
    })
);
```

### ASCII Art Borders

Get creative with your border characters:

```typescript
// Stars border
console.log(
    boxen("Starry night", {
        borderStyle: {
            topLeft: "*",
            topRight: "*",
            bottomLeft: "*",
            bottomRight: "*",
            top: "*",
            bottom: "*",
            left: "*",
            right: "*"
        }
    })
);

// Hash border
console.log(
    boxen("Hash it out", {
        borderStyle: {
            topLeft: "#",
            topRight: "#",
            bottomLeft: "#",
            bottomRight: "#",
            top: "#",
            bottom: "#",
            left: "#",
            right: "#"
        }
    })
);
```

## Border Position Reference

When using the `borderColor` callback, these are the available positions:

- `topLeft` - Top-left corner
- `top` - Top horizontal line
- `topRight` - Top-right corner
- `left` - Left vertical line
- `right` - Right vertical line
- `bottomLeft` - Bottom-left corner
- `bottom` - Bottom horizontal line
- `bottomRight` - Bottom-right corner
- `horizontal` - Any horizontal line
- `vertical` - Any vertical line (if defined, overrides left/right)

## Gradient Borders

Create beautiful gradient effects:

```typescript
import { boxen } from "@visulima/boxen";
import { 
    red, 
    yellow, 
    green, 
    cyan, 
    blue, 
    magenta 
} from "@visulima/colorize";

const gradient = [red, yellow, green, cyan, blue, magenta];

console.log(
    boxen("Gradient magic!", {
        padding: 1,
        borderColor: (border, position, index) => {
            const colorIndex = Math.floor(
                (index / 100) * gradient.length
            ) % gradient.length;
            return gradient[colorIndex](border);
        }
    })
);
```

## Combining Colors and Styles

Create sophisticated, multi-styled boxes:

```typescript
import { boxen } from "@visulima/boxen";
import { 
    bold, 
    italic, 
    cyan, 
    yellow, 
    dim, 
    bgBlue 
} from "@visulima/colorize";

console.log(
    boxen("Hello, styled world!", {
        padding: 1,
        borderStyle: "bold",
        borderColor: (border) => cyan(border),
        textColor: (text) => bold(yellow(text)),
        headerText: "STYLED HEADER",
        headerTextColor: (text) => bgBlue(bold(text)),
        footerText: "subtle footer",
        footerTextColor: (text) => dim(italic(text))
    })
);
```

## Themed Boxes

Create reusable themes for consistent styling:

```typescript
import { red, yellow, green, blue, bold, dim } from "@visulima/colorize";

// Error theme
const errorTheme = {
    borderStyle: "bold" as const,
    borderColor: (border: string) => red(border),
    textColor: (text: string) => red(text),
    headerTextColor: (text: string) => bold(red(text)),
    padding: 1
};

// Success theme
const successTheme = {
    borderStyle: "round" as const,
    borderColor: (border: string) => green(border),
    textColor: (text: string) => green(text),
    headerTextColor: (text: string) => bold(green(text)),
    padding: 1
};

// Warning theme
const warningTheme = {
    borderStyle: "double" as const,
    borderColor: (border: string) => yellow(border),
    textColor: (text: string) => yellow(text),
    headerTextColor: (text: string) => bold(yellow(text)),
    padding: 1
};

// Info theme
const infoTheme = {
    borderStyle: "single" as const,
    borderColor: (border: string) => blue(border),
    textColor: (text: string) => dim(text),
    headerTextColor: (text: string) => bold(blue(text)),
    padding: 1
};

// Usage
console.log(
    boxen("An error occurred!", {
        ...errorTheme,
        headerText: "ERROR"
    })
);

console.log(
    boxen("Operation completed!", {
        ...successTheme,
        headerText: "SUCCESS"
    })
);
```

## Best Practices

### Color Contrast

Ensure good readability:

```typescript
// Good - High contrast
boxen("Readable text", {
    textColor: (text) => bold(white(text)),
    borderColor: (border) => blue(border)
});

// Avoid - Low contrast
// Don't use similar colors for text and border
```

### Terminal Compatibility

Not all terminals support all colors. Test your output in different environments:

- Basic terminals: Stick to basic colors (red, green, blue, etc.)
- Modern terminals: Use RGB colors and gradients
- Windows CMD: Use basic colors only
- Windows Terminal: Full color support

### Performance

When styling large boxes or many boxes:

```typescript
// Define color functions once
const redText = (text: string) => red(text);
const blueBorder = (border: string) => blue(border);

// Reuse them
boxes.forEach(content => {
    console.log(
        boxen(content, {
            textColor: redText,
            borderColor: blueBorder
        })
    );
});
```

## Color Palette Examples

### Professional

```typescript
// Dark theme
const darkTheme = {
    textColor: (text: string) => gray(text),
    borderColor: (border: string) => dim(border)
};

// Light theme
const lightTheme = {
    textColor: (text: string) => black(text),
    borderColor: (border: string) => gray(border)
};
```

### Vibrant

```typescript
// Neon theme
const neonTheme = {
    textColor: (text: string) => bold(cyan(text)),
    borderColor: (border: string) => magenta(border)
};

// Sunset theme
const sunsetTheme = {
    textColor: (text: string) => yellow(text),
    borderColor: (border: string) => red(border)
};
```

## Next Steps

- **[Advanced Usage](./advanced-usage.md)** - Complex layouts and dynamic content
- **[Examples](./examples.md)** - Real-world styling examples
- **[API Reference](./api-reference.md)** - Complete styling API documentation
