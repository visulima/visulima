# @visulima/tabular

<div align="center">
  <h3>visulima tabular</h3>
  <p>
  A powerful and flexible CLI table and grid generator for Node.js, written in TypeScript. Create beautiful ASCII tables or grids with customizable borders, padding, and alignment. Supports Unicode, colors, and ANSI escape codes.
  </p>
</div>

<br />

<div align="center">

[![typescript-image]][typescript-url] [![npm-image]][npm-url] [![license-image]][license-url]

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

- **Type-safe**: Full TypeScript support
- **Unicode Support**: Handles CJK characters and emojis correctly
- **ANSI Colors**: Works with ANSI escape codes and colors
- **Flexible Styling**: Customizable borders, padding, and alignment
- **Column Configuration**: Individual column width and alignment settings
- **Balanced Widths**: Automatically balance column widths for visual consistency
- **Header Support**: Optional headers with custom styling
- **Border Styles**: Multiple pre-defined border styles and custom border options
- **Cell Spanning**: Support for rowSpan and colSpan
- **Word Wrapping**: Automatic or configurable word wrapping
- **Truncation**: Smart content truncation with customizable options

## Install

```bash
npm install @visulima/tabular
```

```bash
yarn add @visulima/tabular
```

```bash
pnpm add @visulima/tabular
```

## Usage

The package provides two main classes for creating tables:

- `Table`: High-level API for creating tables with headers and rows
- `Grid`: Low-level API for more complex layouts and custom grid structures

### Table Usage

The `Table` class provides a simple API for creating tables with headers and rows:

```typescript
import { createTable } from "@visulima/tabular";

// Create a basic table
const table = createTable({
    maxWidth: 100, // Maximum table width
    showHeader: true, // Show headers (default: true)
    style: {
        paddingLeft: 1,
        paddingRight: 1,
    },
    wordWrap: true, // Enable word wrapping
});

// Add headers
table.setHeaders(["Name", { content: "Age", hAlign: "center" }, { content: "City", hAlign: "right" }]);

// Add rows
table.addRow(["John Doe", "30", "New York"]);
table.addRow([
    { colSpan: 2, content: "Jane Smith" }, // Span two columns
    "Los Angeles",
]);

// Add multiple rows at once
table.addRows(["Bob", "25", "Chicago"], ["Alice", "28", "Boston"]);

console.log(table.toString());
```

Output:

```
┌──────────┬─────┬─────────────┐
│ Name     │ Age │        City │
├──────────┼─────┼─────────────┤
│ John Doe │ 30  │ New York    │
├──────────┴─────┼─────────────┤
│ Jane Smith     │ Los Angeles │
├──────────┬─────┼─────────────┤
│ Bob      │ 25  │ Chicago     │
├──────────┼─────┼─────────────┤
│ Alice    │ 28  │ Boston      │
└──────────┴─────┴─────────────┘
```

#### Balanced Column Widths

When you want columns to be visually balanced regardless of content length, use `balancedWidths: true`:

```typescript
import { createTable } from "@visulima/tabular";

const table = createTable({
    balancedWidths: true, // Enable balanced column widths
    wordWrap: true, // Recommended for balanced layouts
    terminalWidth: 45, // Optional
    style: {
        paddingLeft: 0,
        paddingRight: 0,
    },
});

table.addRow([
    "Short text",
    { content: "Long content that can wrap", wordWrap: false }, // Explicitly disable wrapping
    "Another wrappable text here",
]);

// Without balancedWidths: columns sized by content
// With balancedWidths: columns equally distributed
```

**Output:**

```
┌─────────────┬─────────────────┬───────────┐
│Short text   │Long content tha…│Another    │
│             │                 │wrappable  │
│             │                 │text here  │
└─────────────┴─────────────────┴───────────┘
```

**When to use `balancedWidths`:**

- ✅ **Presentational tables** where visual balance matters
- ✅ **Dashboards and reports** with varying content lengths
- ✅ **CLI tools** where consistent column spacing is important
- ✅ **Tables with mixed content types** (short/long text)

**When NOT to use `balancedWidths`:**

- ❌ **Data tables** requiring content-based column sizing
- ❌ **Tables with fixed-width data** (IDs, dates, numbers)
- ❌ **Performance-critical** applications
- ❌ **Tables needing precise alignment** with external content

### Grid Usage

The `Grid` class provides more control over layout and styling:

```typescript
import { createGrid } from "@visulima/tabular";

// Create a grid with 3 columns
const grid = createGrid({
    columns: 3,
    paddingLeft: 1,
    paddingRight: 1,
    border: DEFAULT_BORDER,
});

// Add items with complex layouts
grid.addItems([
    { colSpan: 3, content: "Header", hAlign: "center" },
    { content: "Left", vAlign: "top" },
    { content: "Center\nMultiline", rowSpan: 2, vAlign: "middle" },
    { content: "Right", vAlign: "bottom" },
    { content: "Bottom Left" },
    { content: "Bottom Right" },
]);

console.log(grid.toString());
```

Output:

```
┌────────────────────────────────────────┐
│                 Header                 │
├─────────────┬───────────┬──────────────┤
│ Left        │           │ Right        │
├─────────────┤ Center    ├──────────────┤
│ Bottom Left │ Multiline │ Bottom Right │
└─────────────┴───────────┴──────────────┘
```

### Advanced Features

#### Cell Styling

Both Table and Grid support rich cell styling:

```typescript
import { bgBlue, bgYellow, blue, bold, green, red, white, yellow } from "@visulima/colorize";
import { createTable } from "@visulima/tabular";

const table = createTable();

// Example 1: Using function-based background color
table.addRow([
    {
        backgroundColor: bgYellow, // Function that applies background color
        content: "Warning",
        hAlign: "center",
        vAlign: "middle",
    },
    {
        backgroundColor: (text) => bgBlue(red(text)), // Custom color function
        colSpan: 2,
        content: "Error",
    },
]);

// Example 2: Using ANSI escape sequences directly
table.addRow([
    {
        backgroundColor: {
            close: "\u001B[49m", // Reset background
            open: "\u001B[44m", // Blue background
        },
        content: "Custom",
    },
    {
        backgroundColor: {
            close: "\u001B[49m", // Reset background
            open: "\u001B[42m", // Green background
        },
        content: "Status",
    },
]);

// Example 3: Combining with other styling options
table.addRow([
    {
        backgroundColor: bgYellow,
        colSpan: 2,
        content: "Important Notice",
        maxWidth: 20, // Maximum cell width
        style: {
            border: ["bold"],
            paddingLeft: 2,
        },
        truncate: true, // Enable truncation
        wordWrap: true, // Enable word wrapping
    },
]);

// Example 4: Demonstrating borderColor and foregroundColor
const tableWithBorderColors = createTable({
    style: {
        // Apply a global border color (e.g., blue)
        borderColor: blue,
    },
});

tableWithBorderColors.setHeaders(["Type", "Description"]);

tableWithBorderColors.addRow([
    // Cell with default border color, custom foreground
    { content: red("Error Text") },
    "This text uses the default blue border.",
]);

tableWithBorderColors.addRow([
    // Cell with custom border color (overrides global)
    {
        content: "Important",
        style: {
            borderColor: green, // Green border for this cell only
        },
    },
    "This cell has a green border.",
]);

tableWithBorderColors.addRow([
    // Cell with custom foreground and border color
    {
        content: bold(yellow("Warning")),
        style: {
            borderColor: yellow, // Yellow border for this cell
        },
    },
    "Bold yellow text with a yellow border.",
]);

tableWithBorderColors.addRow([
    // Cell with background and custom border color
    {
        backgroundColor: bgBlue, // Blue background
        content: "Info",
        style: {
            borderColor: white, // White border for this cell
        },
    },
    "White text on blue background with a white border.",
]);

console.log(tableWithBorderColors.toString());
```

The `backgroundColor` property can be specified in two ways:

1. As a function that takes the cell content as a string and returns the styled string
2. As an object with `open` and `close` properties containing ANSI escape sequences

You can combine background colors with:

- Text colors and styles
- Cell spanning (colSpan/rowSpan)
- Alignment (hAlign/vAlign)
- Content formatting (truncate/wordWrap)
- Custom border styles
- Custom padding

#### Dynamic Sizing

Control column and row sizes:

```typescript
import { createGrid } from "@visulima/tabular";

const grid = createGrid({
    // Auto-flow direction
    autoFlow: "row", // or "column"
    columns: 3,
    // Fixed column widths
    fixedColumnWidths: [10, 20, 15],
    // Fixed row heights
    fixedRowHeights: [1, 2, 1],
    // Maximum width (will scale down if needed)
    maxWidth: 100,
});
```

### Padding and Width Calculations

All width-related properties (`columnWidths`, `maxWidth`, `width`) **include padding** in their calculations:

- `paddingLeft` and `paddingRight` are added to the total cell width
- Content space = specified width - (paddingLeft + paddingRight)
- For example, with `paddingLeft: 1`, `paddingRight: 1`, and `maxWidth: 10`:
    - Total cell width = 10 characters
    - Content space = 8 characters (content gets truncated at 8 chars)
    - Padding space = 2 characters (1 left + 1 right)

### Table Cell Structure

```
┌─────────────────────────────────────────────────┐
│                Cell Structure                   │
├─────────────────────────────────────────────────┤
│ ┌─────────┬─────────────────┬─────────┐◄── Border
│ │  Left   │    Content      │  Right  │
│ │ Padding │     Space       │ Padding │
│ │ (1 char)│  (contentWidth) │ (1 char)│
│ └─────────┴─────────────────┴─────────┘◄── Cell Width
│ ◄─────────────────────────────────────►
│              Total Cell Width
└─────────────────────────────────────────────────┘
```

**Width Priority Order** (highest to lowest):

1. `cell.width` - Exact cell width (overrides table columnWidths)
2. `table.columnWidths` - Table-level column width constraints
3. `cell.maxWidth` - Maximum cell width constraint
4. Auto-calculated width (balanced or content-based)

### Complete Example

```typescript
import { createTable } from "@visulima/tabular";

const table = createTable({
    columnWidths: [15, 12, 10], // Table-level widths
    style: {
        paddingLeft: 1,
        paddingRight: 1,
    },
});

table.addRow([
    {
        content: "Very Long Content Here That Will Be Truncated",
        maxWidth: 13, // 13 total = 11 content + 2 padding (but table columnWidths takes priority)
    },
    {
        content: "Medium Text",
        width: 12, // 12 total = 10 content + 2 padding (highest priority - exact width)
    },
    {
        content: "Short", // Uses table columnWidths: 10 total = 8 content + 2 padding
    },
]);

console.log(table.toString());
```

**Output:**

```
┌───────────────┬────────────┬──────────┐
│ Very Long Co… │ Medium Te… │ Short    │
└───────────────┴────────────┴──────────┘
```

**Cell Analysis:**

- **Cell 1** (`maxWidth: 13`): Table `columnWidths: 15` takes priority, content fits in 13 chars, total width 15
- **Cell 2** (`width: 12`): `width` has highest priority, content padded to 10 chars, total width exactly 12
- **Cell 3** (table `columnWidths: 10`): Content padded to 8 chars, total width 10

**Width Calculation Details:**

- Total Width = Content Width + Padding Left + Padding Right
- Content Width = Total Width - Padding Left - Padding Right
- Borders and gaps are added between cells but don't affect individual cell width calculations

### Advanced Multi-Row Example

```typescript
import { createTable } from "@visulima/tabular";

const table = createTable({
    columnWidths: [16, 14, 12], // Base column widths
    style: {
        paddingLeft: 1,
        paddingRight: 1,
    },
});

// Row 1: Demonstrate different width constraints
table.addRow([
    { content: "Normal content", maxWidth: 14 }, // Constrained by maxWidth
    { content: "Fixed width", width: 12 }, // Exact width override
    { content: "Table width" }, // Uses table columnWidths
]);

// Row 2: Show truncation behavior
table.addRow([
    { content: "This content will be truncated because maxWidth limits it" },
    { content: "This exact width content gets padded or truncated", width: 14 },
    { content: "Short" },
]);

// Row 3: Mixed alignment and styling
table.addRow([
    { content: "Left", hAlign: "left", maxWidth: 12 },
    { content: "Center", hAlign: "center", width: 14 },
    { content: "Right", hAlign: "right" },
]);

console.log(table.toString());
```

**Advanced Output:**

```
┌────────────────┬──────────────┬────────────┐
│ Normal content │ Fixed width  │ Table wid… │
├────────────────┼──────────────┼────────────┤
│ This content … │ This exact … │ Short      │
├────────────────┼──────────────┼────────────┤
│ Left           │    Center    │      Right │
└────────────────┴──────────────┴────────────┘
```

**Key Takeaways:**

- **Consistency**: Each column maintains its width across all rows
- **Flexibility**: Individual cells can override table settings
- **Priority**: `width` > `columnWidths` > `maxWidth` > auto-calculated
- **Padding**: Always included in width calculations
- **Alignment**: Works within the calculated content space

## API Reference

<!-- TYPEDOC -->

# index

## Classes

### Grid

Defined in: [grid.ts:65](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/grid.ts#L65)

A class that represents a grid layout with support for cell spanning, alignment, and borders

#### Constructors

##### Constructor

```ts
new Grid(options): Grid;
```

Defined in: [grid.ts:90](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/grid.ts#L90)

Creates a new Grid instance

###### Parameters

###### options

[`GridOptions`](#gridoptions)

Configuration options for the grid

###### Returns

[`Grid`](#grid)

#### Methods

##### addItem()

```ts
addItem(cell): this;
```

Defined in: [grid.ts:138](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/grid.ts#L138)

Adds a single item to the grid

###### Parameters

###### cell

[`GridCell`](#gridcell)

The cell to add

###### Returns

`this`

The grid instance for method chaining

##### addItems()

```ts
addItems(items): this;
```

Defined in: [grid.ts:148](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/grid.ts#L148)

Adds multiple items to the grid

###### Parameters

###### items

[`GridCell`](#gridcell)[]

Array of items to add

###### Returns

`this`

The grid instance for method chaining

##### setBorder()

```ts
setBorder(border): this;
```

Defined in: [grid.ts:178](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/grid.ts#L178)

Sets the border style for the grid

###### Parameters

###### border

[`BorderStyle`](#borderstyle)

Border style configuration

###### Returns

`this`

The grid instance for method chaining

##### setColumns()

```ts
setColumns(columns): this;
```

Defined in: [grid.ts:158](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/grid.ts#L158)

Sets the number of columns in the grid

###### Parameters

###### columns

`number`

Number of columns

###### Returns

`this`

The grid instance for method chaining

##### setMaxWidth()

```ts
setMaxWidth(width): this;
```

Defined in: [grid.ts:198](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/grid.ts#L198)

Sets the maximum width for the grid

###### Parameters

###### width

`number`

Maximum width

###### Returns

`this`

The grid instance for method chaining

##### setRows()

```ts
setRows(rows): this;
```

Defined in: [grid.ts:168](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/grid.ts#L168)

Sets the number of rows in the grid

###### Parameters

###### rows

`number`

Number of rows

###### Returns

`this`

The grid instance for method chaining

##### setShowBorders()

```ts
setShowBorders(show): this;
```

Defined in: [grid.ts:188](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/grid.ts#L188)

Sets whether borders should be shown

###### Parameters

###### show

`boolean`

Whether to show borders

###### Returns

`this`

The grid instance for method chaining

##### toString()

```ts
toString(): string;
```

Defined in: [grid.ts:207](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/grid.ts#L207)

Converts the grid to a string representation

###### Returns

`string`

A string containing the rendered grid

---

### Table

Defined in: [table.ts:9](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/table.ts#L9)

A versatile table generator for CLI applications.

#### Constructors

##### Constructor

```ts
new Table(options): Table;
```

Defined in: [table.ts:24](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/table.ts#L24)

Initializes a new Table instance.

###### Parameters

###### options

[`TableOptions`](#tableoptions) = `{}`

Configuration options for the table.

###### Returns

[`Table`](#table)

#### Methods

##### addRow()

```ts
addRow(row): this;
```

Defined in: [table.ts:60](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/table.ts#L60)

Adds a single row to the table body.

###### Parameters

###### row

[`TableCell`](#tablecell)[]

Array of cells representing the row.

###### Returns

`this`

The Table instance for chaining.

##### addRows()

```ts
addRows(...rows): this;
```

Defined in: [table.ts:77](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/table.ts#L77)

Adds multiple rows to the table body.

###### Parameters

###### rows

...[`TableCell`](#tablecell)[][]

Array of rows to add.

###### Returns

`this`

The Table instance for chaining.

##### setHeaders()

```ts
setHeaders(headers): this;
```

Defined in: [table.ts:43](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/table.ts#L43)

Sets the header rows for the table.
Replaces any existing headers.

###### Parameters

###### headers

Array of header rows OR a single header row.

[`TableCell`](#tablecell)[] | [`TableCell`](#tablecell)[][]

###### Returns

`this`

The Table instance for chaining.

##### toString()

```ts
toString(): string;
```

Defined in: [table.ts:93](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/table.ts#L93)

Renders the table to a string.

###### Returns

`string`

The string representation of the table.

## Functions

### createGrid()

```ts
function createGrid(options): Grid;
```

Defined in: [grid.ts:1416](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/grid.ts#L1416)

Creates a new grid instance with the specified options

#### Parameters

##### options

[`GridOptions`](#gridoptions)

Configuration options for the grid

#### Returns

[`Grid`](#grid)

A new Grid instance

---

### createTable()

```ts
function createTable(options?): Table;
```

Defined in: [table.ts:257](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/table.ts#L257)

Creates a new Table instance.

#### Parameters

##### options?

[`TableOptions`](#tableoptions)

Configuration options for the table.

#### Returns

[`Table`](#table)

A new Table instance.

## Interfaces

### BorderComponent

Defined in: [types.ts:70](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L70)

#### Properties

##### char

```ts
char: string;
```

Defined in: [types.ts:71](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L71)

##### width

```ts
width: number;
```

Defined in: [types.ts:72](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L72)

---

### BorderStyle

Defined in: [types.ts:78](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L78)

Represents the style of the border for a table or grid.

#### Properties

##### bodyJoin

```ts
bodyJoin: BorderComponent;
```

Defined in: [types.ts:80](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L80)

Box vertical character.

##### bodyLeft

```ts
bodyLeft: BorderComponent;
```

Defined in: [types.ts:82](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L82)

Box vertical character.

##### bodyRight

```ts
bodyRight: BorderComponent;
```

Defined in: [types.ts:84](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L84)

Box vertical character.

##### bottomBody

```ts
bottomBody: BorderComponent;
```

Defined in: [types.ts:86](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L86)

Box horizontal character.

##### bottomJoin

```ts
bottomJoin: BorderComponent;
```

Defined in: [types.ts:88](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L88)

Box bottom join character.

##### bottomLeft

```ts
bottomLeft: BorderComponent;
```

Defined in: [types.ts:90](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L90)

Box bottom left character.

##### bottomRight

```ts
bottomRight: BorderComponent;
```

Defined in: [types.ts:92](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L92)

Box bottom right character.

##### joinBody

```ts
joinBody: BorderComponent;
```

Defined in: [types.ts:94](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L94)

Box horizontal character.

##### joinJoin

```ts
joinJoin: BorderComponent;
```

Defined in: [types.ts:96](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L96)

Box horizontal join character.

##### joinLeft

```ts
joinLeft: BorderComponent;
```

Defined in: [types.ts:98](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L98)

Box left join character.

##### joinRight

```ts
joinRight: BorderComponent;
```

Defined in: [types.ts:100](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L100)

Box right join character.

##### topBody

```ts
topBody: BorderComponent;
```

Defined in: [types.ts:102](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L102)

Box horizontal character.

##### topJoin

```ts
topJoin: BorderComponent;
```

Defined in: [types.ts:104](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L104)

Box top join character.

##### topLeft

```ts
topLeft: BorderComponent;
```

Defined in: [types.ts:106](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L106)

Box top left character.

##### topRight

```ts
topRight: BorderComponent;
```

Defined in: [types.ts:108](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L108)

Box top right character.

---

### GridItem

Defined in: [types.ts:29](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L29)

#### Extended by

- [`TableItem`](#tableitem)

#### Properties

##### backgroundColor?

```ts
optional backgroundColor: AnsiColorObject | AnsiColorFunction;
```

Defined in: [types.ts:31](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L31)

Background color for the entire cell (including padding)

##### colSpan?

```ts
optional colSpan: number;
```

Defined in: [types.ts:33](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L33)

Number of columns this cell spans

##### content

```ts
content: Content;
```

Defined in: [types.ts:35](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L35)

Content to display in the cell

##### foregroundColor?

```ts
optional foregroundColor: AnsiColorObject | AnsiColorFunction;
```

Defined in: [types.ts:37](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L37)

Foreground color for the entire cell (including padding)

##### hAlign?

```ts
optional hAlign: HorizontalAlignment;
```

Defined in: [types.ts:39](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L39)

Horizontal alignment of the content

##### maxWidth?

```ts
optional maxWidth: number;
```

Defined in: [types.ts:41](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L41)

Maximum width of the cell content before truncation.
**Note:** This width includes padding. For example, with `paddingLeft: 1` and `paddingRight: 1`, a cell with `maxWidth: 10` will truncate content when it exceeds 8 characters (content space), leaving 2 characters for padding.

##### rowSpan?

```ts
optional rowSpan: number;
```

Defined in: [types.ts:43](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L43)

Number of rows this cell spans

##### truncate?

```ts
optional truncate: boolean | TruncateOptions;
```

Defined in: [types.ts:46](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L46)

Options for controlling how text is truncated when it exceeds maxWidth

##### vAlign?

```ts
optional vAlign: VerticalAlignment;
```

Defined in: [types.ts:48](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L48)

Vertical alignment of the content

##### width?

```ts
optional width: number;
```

Defined in: [types.ts:52](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L52)

Exact width for this cell, overrides table-level columnWidths.
**Note:** This width includes padding. For example, with `paddingLeft: 1` and `paddingRight: 1`, a cell with `width: 10` will have 8 characters of content space and 2 characters of padding.

##### wordWrap?

```ts
optional wordWrap: boolean | Omit<WordWrapOptions, "width">;
```

Defined in: [types.ts:50](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L50)

Options for controlling word wrapping (takes precedence over truncate)

---

### GridOptions

Defined in: [types.ts:157](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L157)

Options specific to Grid construction.

#### Extends

- `BaseRenderingOptions`.[`Style`](#style)

#### Properties

##### autoColumns?

```ts
optional autoColumns: number;
```

Defined in: [types.ts:159](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L159)

Default number of columns for auto-generated cells

##### autoFlow?

```ts
optional autoFlow: AutoFlowDirection;
```

Defined in: [types.ts:161](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L161)

Direction of auto-flow when adding items

##### autoRows?

```ts
optional autoRows: number;
```

Defined in: [types.ts:163](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L163)

Default number of rows for auto-generated cells

##### backgroundColor?

```ts
optional backgroundColor: AnsiColorObject | AnsiColorFunction;
```

Defined in: [types.ts:114](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L114)

Global background color

###### Inherited from

[`Style`](#style).[`backgroundColor`](#backgroundcolor-2)

##### border?

```ts
optional border: BorderStyle;
```

Defined in: [types.ts:116](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L116)

Border style configuration.

###### Inherited from

[`Style`](#style).[`border`](#border-1)

##### borderColor?

```ts
optional borderColor: AnsiColorObject | AnsiColorFunction;
```

Defined in: [types.ts:118](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L118)

Global border color

###### Inherited from

[`Style`](#style).[`borderColor`](#bordercolor-1)

##### columns

```ts
columns: number;
```

Defined in: [types.ts:165](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L165)

Number of columns in the grid

##### fixedColumnWidths?

```ts
optional fixedColumnWidths: number[];
```

Defined in: [types.ts:167](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L167)

Fixed column widths

##### fixedRowHeights?

```ts
optional fixedRowHeights: number[];
```

Defined in: [types.ts:169](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L169)

Fixed row heights

##### foregroundColor?

```ts
optional foregroundColor: AnsiColorObject | AnsiColorFunction;
```

Defined in: [types.ts:120](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L120)

Global foreground color

###### Inherited from

[`Style`](#style).[`foregroundColor`](#foregroundcolor-2)

##### gap?

```ts
optional gap: number;
```

Defined in: [types.ts:8](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L8)

Gap between cells

###### Inherited from

```ts
BaseRenderingOptions.gap;
```

##### maxWidth?

```ts
optional maxWidth: number;
```

Defined in: [types.ts:10](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L10)

Maximum width for the entire table/grid.

###### Inherited from

```ts
BaseRenderingOptions.maxWidth;
```

##### paddingLeft?

```ts
optional paddingLeft: number;
```

Defined in: [types.ts:122](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L122)

Global left padding

###### Inherited from

[`Style`](#style).[`paddingLeft`](#paddingleft-1)

##### paddingRight?

```ts
optional paddingRight: number;
```

Defined in: [types.ts:124](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L124)

Global right padding

###### Inherited from

[`Style`](#style).[`paddingRight`](#paddingright-1)

##### rows?

```ts
optional rows: number;
```

Defined in: [types.ts:171](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L171)

Number of rows in the grid (0 for auto)

##### showBorders?

```ts
optional showBorders: boolean;
```

Defined in: [types.ts:173](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L173)

Whether to show borders (only relevant if border is defined)

##### terminalWidth?

```ts
optional terminalWidth: number;
```

Defined in: [types.ts:12](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L12)

Explicit terminal width (overrides detected)

###### Inherited from

```ts
BaseRenderingOptions.terminalWidth;
```

##### balancedWidths?

```ts
optional balancedWidths: boolean;
```

Defined in: [types.ts:4](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L4)

Automatically balance column widths for optimal content fit when no fixed widths are specified. When enabled, columns are distributed equally across the available terminal width, prioritizing visual balance over content-based sizing.

###### Inherited from

```ts
BaseRenderingOptions.balancedWidths;
```

##### truncate?

```ts
optional truncate: boolean | TruncateOptions;
```

Defined in: [types.ts:15](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L15)

Global truncation options/flag

###### Inherited from

```ts
BaseRenderingOptions.truncate;
```

##### wordWrap?

```ts
optional wordWrap: boolean | Omit<WordWrapOptions, "width">;
```

Defined in: [types.ts:17](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L17)

Global word wrap options/flag

###### Inherited from

```ts
BaseRenderingOptions.wordWrap;
```

---

### Style

Defined in: [types.ts:112](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L112)

Base style properties applicable globally

#### Extended by

- [`GridOptions`](#gridoptions)

#### Properties

##### backgroundColor?

```ts
optional backgroundColor: AnsiColorObject | AnsiColorFunction;
```

Defined in: [types.ts:114](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L114)

Global background color

##### border?

```ts
optional border: BorderStyle;
```

Defined in: [types.ts:116](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L116)

Border style configuration.

##### borderColor?

```ts
optional borderColor: AnsiColorObject | AnsiColorFunction;
```

Defined in: [types.ts:118](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L118)

Global border color

##### foregroundColor?

```ts
optional foregroundColor: AnsiColorObject | AnsiColorFunction;
```

Defined in: [types.ts:120](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L120)

Global foreground color

##### paddingLeft?

```ts
optional paddingLeft: number;
```

Defined in: [types.ts:122](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L122)

Global left padding

##### paddingRight?

```ts
optional paddingRight: number;
```

Defined in: [types.ts:124](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L124)

Global right padding

---

### TableItem

Defined in: [types.ts:61](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L61)

#### Extends

- [`GridItem`](#griditem)

#### Properties

##### backgroundColor?

```ts
optional backgroundColor: AnsiColorObject | AnsiColorFunction;
```

Defined in: [types.ts:31](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L31)

Background color for the entire cell (including padding)

###### Inherited from

[`GridItem`](#griditem).[`backgroundColor`](#backgroundcolor)

##### colSpan?

```ts
optional colSpan: number;
```

Defined in: [types.ts:33](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L33)

Number of columns this cell spans

###### Inherited from

[`GridItem`](#griditem).[`colSpan`](#colspan)

##### content

```ts
content: Content;
```

Defined in: [types.ts:35](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L35)

Content to display in the cell

###### Inherited from

[`GridItem`](#griditem).[`content`](#content)

##### foregroundColor?

```ts
optional foregroundColor: AnsiColorObject | AnsiColorFunction;
```

Defined in: [types.ts:37](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L37)

Foreground color for the entire cell (including padding)

###### Inherited from

[`GridItem`](#griditem).[`foregroundColor`](#foregroundcolor)

##### hAlign?

```ts
optional hAlign: HorizontalAlignment;
```

Defined in: [types.ts:39](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L39)

Horizontal alignment of the content

###### Inherited from

[`GridItem`](#griditem).[`hAlign`](#halign)

##### href?

```ts
optional href: string;
```

Defined in: [types.ts:65](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L65)

Optional URL for making the cell content a hyperlink.

##### maxWidth?

```ts
optional maxWidth: number;
```

Defined in: [types.ts:41](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L41)

Maximum width of the cell content before truncation

###### Inherited from

[`GridItem`](#griditem).[`maxWidth`](#maxwidth)

##### rowSpan?

```ts
optional rowSpan: number;
```

Defined in: [types.ts:43](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L43)

Number of rows this cell spans

###### Inherited from

[`GridItem`](#griditem).[`rowSpan`](#rowspan)

##### truncate?

```ts
optional truncate: boolean | TruncateOptions;
```

Defined in: [types.ts:46](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L46)

Options for controlling how text is truncated when it exceeds maxWidth

###### Inherited from

[`GridItem`](#griditem).[`truncate`](#truncate)

##### vAlign?

```ts
optional vAlign: VerticalAlignment;
```

Defined in: [types.ts:48](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L48)

Vertical alignment of the content

###### Inherited from

[`GridItem`](#griditem).[`vAlign`](#valign)

##### wordWrap?

```ts
optional wordWrap: boolean | Omit<WordWrapOptions, "width">;
```

Defined in: [types.ts:50](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L50)

Options for controlling word wrapping (takes precedence over truncate)

###### Inherited from

[`GridItem`](#griditem).[`wordWrap`](#wordwrap)

---

### TableOptions

Defined in: [types.ts:130](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L130)

Options specific to Table construction.

#### Extends

- `BaseRenderingOptions`

#### Properties

##### columnWidths?

```ts
optional columnWidths: number | number[];
```

Defined in: [types.ts:135](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L135)

Fixed column widths.
Can be a single number for all columns or an array for specific columns.
**Note:** These widths include padding. For example, with `paddingLeft: 1` and `paddingRight: 1`, a column with `columnWidths: 10` will have 8 characters of content space and 2 characters of padding.

##### gap?

```ts
optional gap: number;
```

Defined in: [types.ts:8](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L8)

Gap between cells

###### Inherited from

```ts
BaseRenderingOptions.gap;
```

##### maxWidth?

```ts
optional maxWidth: number;
```

Defined in: [types.ts:10](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L10)

Maximum width for the entire table/grid.

###### Inherited from

```ts
BaseRenderingOptions.maxWidth;
```

##### rowHeights?

```ts
optional rowHeights: number | number[];
```

Defined in: [types.ts:140](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L140)

Fixed row heights.
Can be a single number for all rows or an array for specific rows.

##### showHeader?

```ts
optional showHeader: boolean;
```

Defined in: [types.ts:142](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L142)

Whether to show the header of the table

##### style?

```ts
optional style: Partial<Style>;
```

Defined in: [types.ts:144](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L144)

Global style options for the table

##### terminalWidth?

```ts
optional terminalWidth: number;
```

Defined in: [types.ts:12](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L12)

Explicit terminal width (overrides detected)

###### Inherited from

```ts
BaseRenderingOptions.terminalWidth;
```

##### transformTabToSpace?

```ts
optional transformTabToSpace: number;
```

Defined in: [types.ts:146](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L146)

Number of spaces for tab characters

##### truncate?

```ts
optional truncate: boolean | TruncateOptions;
```

Defined in: [types.ts:15](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L15)

Global truncation options/flag

###### Inherited from

```ts
BaseRenderingOptions.truncate;
```

##### wordWrap?

```ts
optional wordWrap: boolean | Omit<WordWrapOptions, "width">;
```

Defined in: [types.ts:17](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L17)

Global word wrap options/flag

###### Inherited from

```ts
BaseRenderingOptions.wordWrap;
```

## Type Aliases

### AutoFlowDirection

```ts
type AutoFlowDirection = "column" | "row";
```

Defined in: [types.ts:151](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L151)

---

### BorderType

```ts
type BorderType = "bottom" | "middle" | "top";
```

Defined in: [types.ts:152](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L152)

---

### Content

```ts
type Content = bigint | boolean | number | string | null | undefined;
```

Defined in: [types.ts:27](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L27)

---

### GridCell

```ts
type GridCell = Content | GridItem;
```

Defined in: [types.ts:54](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L54)

Input type for a cell, can be primitive or an options object

---

### HorizontalAlignment

```ts
type HorizontalAlignment = "center" | "left" | "right";
```

Defined in: [types.ts:150](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L150)

---

### TableCell

```ts
type TableCell = Content | TableItem;
```

Defined in: [types.ts:68](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L68)

---

### VerticalAlignment

```ts
type VerticalAlignment = "bottom" | "middle" | "top";
```

Defined in: [types.ts:149](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/types.ts#L149)

# style

## Variables

### ASCII_BORDER

```ts
const ASCII_BORDER: BorderStyle;
```

Defined in: [style.ts:132](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/style.ts#L132)

ASCII border style using only ASCII characters.

---

### BLOCK_BORDER

```ts
const BLOCK_BORDER: BorderStyle;
```

Defined in: [style.ts:174](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/style.ts#L174)

Block border style.

---

### DEFAULT_BORDER

```ts
const DEFAULT_BORDER: BorderStyle;
```

Defined in: [style.ts:6](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/style.ts#L6)

Default border style using standard box-drawing characters.

---

### DOTS_BORDER

```ts
const DOTS_BORDER: BorderStyle;
```

Defined in: [style.ts:90](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/style.ts#L90)

Border style using dots for the border.

---

### DOUBLE_BORDER

```ts
const DOUBLE_BORDER: BorderStyle;
```

Defined in: [style.ts:48](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/style.ts#L48)

Double-line border style using Unicode box-drawing characters.

---

### INNER_HALF_BLOCK_BORDER

```ts
const INNER_HALF_BLOCK_BORDER: BorderStyle;
```

Defined in: [style.ts:216](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/style.ts#L216)

Inner half block border style.

---

### MARKDOWN_BORDER

```ts
const MARKDOWN_BORDER: BorderStyle;
```

Defined in: [style.ts:111](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/style.ts#L111)

Border style using Markdown syntax.

---

### MINIMAL_BORDER

```ts
const MINIMAL_BORDER: BorderStyle;
```

Defined in: [style.ts:27](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/style.ts#L27)

Minimal border style using only horizontal lines.

---

### NO_BORDER

```ts
const NO_BORDER: BorderStyle;
```

Defined in: [style.ts:153](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/style.ts#L153)

No border style.

---

### OUTER_HALF_BLOCK_BORDER

```ts
const OUTER_HALF_BLOCK_BORDER: BorderStyle;
```

Defined in: [style.ts:195](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/style.ts#L195)

Outer half block border style.

---

### ROUNDED_BORDER

```ts
const ROUNDED_BORDER: BorderStyle;
```

Defined in: [style.ts:69](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/style.ts#L69)

Border style with rounded corners using Unicode box-drawing characters.

---

### THICK_BORDER

```ts
const THICK_BORDER: BorderStyle;
```

Defined in: [style.ts:237](https://github.com/visulima/visulima/blob/afe199ce97ec3025aa13484407254660803d8d9c/packages/tabular/src/style.ts#L237)

Thick line border style.

<!-- /TYPEDOC -->

## Related

- [cli-table3](https://github.com/cli-table/cli-table3) - Pretty unicode tables for the command line
- [table](https://github.com/gajus/table) - Formats data into a string table.

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).
Here's [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

- [Daniel Bannert](https://github.com/prisis)
- [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima tabular is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/ "TypeScript"
[license-image]: https://img.shields.io/npm/l/@visulima/tabular?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/tabular/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/tabular/v/latest "npm"
