# Basic Usage

This guide covers the fundamental concepts of using Boxen. By the end, you'll be comfortable creating boxes with various styles and configurations.

## Your First Box

The simplest way to use Boxen is to pass a string:

```typescript
import { boxen } from "@visulima/boxen";

console.log(boxen("Hello, World!"));
```

Output:
```
┌─────────────┐
│Hello, World!│
└─────────────┘
```

## Adding Padding

Make your boxes more spacious with padding:

```typescript
console.log(boxen("unicorn", { padding: 1 }));
```

Output:
```
┌─────────────┐
│             │
│   unicorn   │
│             │
└─────────────┘
```

The padding option accepts either a number or an object for fine-grained control:

```typescript
// Equal padding on all sides
boxen("text", { padding: 2 });

// Different padding per side
boxen("text", { 
    padding: { 
        top: 1, 
        right: 3, 
        bottom: 1, 
        left: 3 
    } 
});
```

## Adding Margin

Create space around your box with margin:

```typescript
console.log(boxen("spaced out", { margin: 1 }));
```

Output:
```

   ┌───────────┐
   │spaced out │
   └───────────┘

```

Like padding, margin can be a number or an object:

```typescript
// Equal margin
boxen("text", { margin: 2 });

// Custom margin per side
boxen("text", { 
    margin: { 
        top: 2, 
        right: 4, 
        bottom: 2, 
        left: 4 
    } 
});
```

## Border Styles

Boxen comes with several pre-defined border styles:

### Single (Default)

```typescript
console.log(boxen("single", { borderStyle: "single" }));
```

```
┌──────┐
│single│
└──────┘
```

### Double

```typescript
console.log(boxen("double", { borderStyle: "double" }));
```

```
╔══════╗
║double║
╚══════╝
```

### Round

```typescript
console.log(boxen("round", { borderStyle: "round" }));
```

```
╭─────╮
│round│
╰─────╯
```

### Bold

```typescript
console.log(boxen("bold", { borderStyle: "bold" }));
```

```
┏━━━━┓
┃bold┃
┗━━━━┛
```

### Classic

```typescript
console.log(boxen("classic", { borderStyle: "classic" }));
```

```
+-------+
|classic|
+-------+
```

### Arrow

```typescript
console.log(boxen("arrow", { borderStyle: "arrow" }));
```

```
↘↓↓↓↓↓↙
→arrow←
↗↑↑↑↑↑↖
```

## Combining Options

You can combine multiple options to create more sophisticated boxes:

```typescript
console.log(
    boxen("Welcome to my CLI app!", {
        padding: 1,
        margin: 1,
        borderStyle: "double"
    })
);
```

Output:
```

   ╔═══════════════════════════╗
   ║                           ║
   ║  Welcome to my CLI app!   ║
   ║                           ║
   ╚═══════════════════════════╝

```

## Headers and Footers

Add context to your boxes with headers and footers:

```typescript
console.log(
    boxen("unicorns love rainbows", {
        headerText: "magical",
        headerAlignment: "center"
    })
);
```

Output:
```
┌────── magical ───────┐
│unicorns love rainbows│
└──────────────────────┘
```

With both header and footer:

```typescript
console.log(
    boxen("Important message", {
        headerText: "NOTICE",
        headerAlignment: "center",
        footerText: "Press any key to continue",
        footerAlignment: "center",
        padding: 1
    })
);
```

## Text Alignment

Control how text is aligned within the box:

```typescript
// Left aligned (default)
console.log(boxen("Left", { textAlignment: "left", width: 20 }));

// Center aligned
console.log(boxen("Center", { textAlignment: "center", width: 20 }));

// Right aligned
console.log(boxen("Right", { textAlignment: "right", width: 20 }));
```

## Multi-line Text

Boxen handles multi-line text automatically:

```typescript
const message = `Line 1
Line 2
Line 3`;

console.log(boxen(message, { padding: 1 }));
```

Output:
```
┌────────┐
│        │
│ Line 1 │
│ Line 2 │
│ Line 3 │
│        │
└────────┘
```

## Fixed Dimensions

Set specific width and height for your boxes:

```typescript
// Fixed width
console.log(boxen("Fixed width", { width: 30 }));

// Fixed height (will add empty space)
console.log(boxen("Fixed height", { height: 7 }));

// Both
console.log(boxen("Fixed size", { width: 30, height: 7 }));
```

## Floating Boxes

Position your box on the terminal:

```typescript
// Float right
console.log(boxen("Right side", { float: "right" }));

// Center
console.log(boxen("Centered", { float: "center" }));

// Left (default)
console.log(boxen("Left side", { float: "left" }));
```

## Practical Examples

### Success Message

```typescript
console.log(
    boxen("Operation completed successfully!", {
        padding: 1,
        borderStyle: "round",
        headerText: "SUCCESS",
        headerAlignment: "center"
    })
);
```

### Warning Box

```typescript
console.log(
    boxen("Please review the following warnings", {
        padding: 1,
        borderStyle: "bold",
        headerText: "WARNING",
        headerAlignment: "left",
        width: 50
    })
);
```

### Info Panel

```typescript
console.log(
    boxen(`Version: 1.0.0
Status: Running
Uptime: 5 days`, {
        padding: 1,
        margin: 1,
        borderStyle: "single",
        headerText: "System Information",
        headerAlignment: "center"
    })
);
```

## Next Steps

Now that you understand the basics, explore:

- **[Styling Options](./styling-options.md)** - Learn about colors and custom borders
- **[Advanced Usage](./advanced-usage.md)** - Master complex customizations
- **[Examples](./examples.md)** - See real-world use cases
