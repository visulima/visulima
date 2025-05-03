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
- **Header Support**: Optional headers with custom styling
- **Border Styles**: Multiple pre-defined border styles and custom border options
- **Cell Spanning**: Support for rowSpan and colSpan
- **Word Wrapping**: Automatic or configurable word wrapping
- **Truncation**: Smart content truncation with customizable options

## Installation

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
    style: {
        paddingLeft: 1,
        paddingRight: 1,
    },
    showHeader: true, // Show headers (default: true)
    wordWrap: true, // Enable word wrapping
    maxWidth: 100, // Maximum table width
});

// Add headers
table.setHeaders(["Name", { content: "Age", hAlign: "center" }, { content: "City", hAlign: "right" }]);

// Add rows
table.addRow(["John Doe", "30", "New York"]);
table.addRow([
    { content: "Jane Smith", colSpan: 2 }, // Span two columns
    "Los Angeles",
]);

// Add multiple rows at once
table.addRows([
    ["Bob", "25", "Chicago"],
    ["Alice", "28", "Boston"],
]);

console.log(table.toString());
```

Output:

```
┌───────────┬─────┬────────────┐
│ Name      │ Age │       City │
├───────────┼─────┼────────────┤
│ John Doe  │ 30  │   New York │
│ Jane Smith       │ Los Angeles│
│ Bob       │ 25  │    Chicago │
│ Alice     │ 28  │     Boston │
└───────────┴─────┴────────────┘
```

### Grid Usage

The `Grid` class provides more control over layout and styling:

```typescript
import { createGrid } from "@visulima/tabular";

// Create a grid with 3 columns
const grid = createGrid({
    columns: 3,
    border: {
        // Custom border characters
        topBody: "─",
        topJoin: "┬",
        topLeft: "┌",
        topRight: "┐",
        bottomBody: "─",
        bottomJoin: "┴",
        bottomLeft: "└",
        bottomRight: "┘",
        bodyLeft: "│",
        bodyRight: "│",
        bodyJoin: "│",
        joinBody: "─",
        joinLeft: "├",
        joinRight: "┤",
        joinJoin: "┼",
    },
    paddingLeft: 1,
    paddingRight: 1,
    gap: 1, // Gap between cells
});

// Add items with complex layouts
grid.addItems([
    { content: "Header", colSpan: 3, hAlign: "center" },
    { content: "Left", vAlign: "top" },
    { content: "Center\nMultiline", vAlign: "middle", rowSpan: 2 },
    { content: "Right", vAlign: "bottom" },
    { content: "Bottom Left" },
    { content: "Bottom Right" },
]);

console.log(grid.toString());
```

Output:

```
┌─────────────────────────────┐
│           Header            │
├─────────┬─────────┬────────┤
│ Left    │ Center  │ Right  │
│         │Multiline│        │
├─────────┤         ├────────┤
│ Bottom  │         │ Bottom │
│ Left    │         │ Right  │
└─────────┴─────────┴────────┘
```

### Advanced Features

#### Cell Styling

Both Table and Grid support rich cell styling:

```typescript
import { createTable } from "@visulima/tabular";
import { red, green, blue, bgYellow, bgBlue, bold, yellow, white } from "@visulima/colorize";

const table = createTable();

// Example 1: Using function-based background color
table.addRow([
    {
        content: "Warning",
        backgroundColor: bgYellow, // Function that applies background color
        hAlign: "center",
        vAlign: "middle",
    },
    {
        content: "Error",
        backgroundColor: (text) => bgBlue(red(text)), // Custom color function
        colSpan: 2,
    },
]);

// Example 2: Using ANSI escape sequences directly
table.addRow([
    {
        content: "Custom",
        backgroundColor: {
            open: "\u001B[44m", // Blue background
            close: "\u001B[49m", // Reset background
        },
    },
    {
        content: "Status",
        backgroundColor: {
            open: "\u001B[42m", // Green background
            close: "\u001B[49m", // Reset background
        },
    },
]);

// Example 3: Combining with other styling options
table.addRow([
    {
        content: "Important Notice",
        backgroundColor: bgYellow,
        colSpan: 2,
        maxWidth: 20, // Maximum cell width
        truncate: true, // Enable truncation
        wordWrap: true, // Enable word wrapping
        style: {
            border: ["bold"],
            paddingLeft: 2,
        },
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
        content: "Info",
        backgroundColor: bgBlue, // Blue background
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
    columns: 3,
    // Fixed column widths
    fixedColumnWidths: [10, 20, 15],
    // Fixed row heights
    fixedRowHeights: [1, 2, 1],
    // Maximum width (will scale down if needed)
    maxWidth: 100,
    // Auto-flow direction
    autoFlow: "row", // or "column"
});
```

## API Reference

<!-- TYPEDOC -->

# index

## Classes

### Grid

Defined in: [grid.ts:40](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/grid.ts#L40)

A class that represents a grid layout with support for cell spanning, alignment, and borders

#### Constructors

##### new Grid()

```ts
new Grid(options): Grid
```

Defined in: [grid.ts:53](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/grid.ts#L53)

Creates a new Grid instance

###### Parameters

###### options

[`GridOptions`](index.md#gridoptions)

Configuration options for the grid

###### Returns

[`Grid`](index.md#grid)

#### Methods

##### addItem()

```ts
addItem(cell): this
```

Defined in: [grid.ts:100](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/grid.ts#L100)

Adds a single item to the grid

###### Parameters

###### cell

[`GridCell`](index.md#gridcell)

The cell to add

###### Returns

`this`

The grid instance for method chaining

##### addItems()

```ts
addItems(items): this
```

Defined in: [grid.ts:110](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/grid.ts#L110)

Adds multiple items to the grid

###### Parameters

###### items

[`GridCell`](index.md#gridcell)[]

Array of items to add

###### Returns

`this`

The grid instance for method chaining

##### setBorder()

```ts
setBorder(border): this
```

Defined in: [grid.ts:140](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/grid.ts#L140)

Sets the border style for the grid

###### Parameters

###### border

[`BorderStyle`](index.md#borderstyle)

Border style configuration

###### Returns

`this`

The grid instance for method chaining

##### setColumns()

```ts
setColumns(columns): this
```

Defined in: [grid.ts:120](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/grid.ts#L120)

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
setMaxWidth(width): this
```

Defined in: [grid.ts:161](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/grid.ts#L161)

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
setRows(rows): this
```

Defined in: [grid.ts:130](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/grid.ts#L130)

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
setShowBorders(show): this
```

Defined in: [grid.ts:151](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/grid.ts#L151)

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
toString(): string
```

Defined in: [grid.ts:170](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/grid.ts#L170)

Converts the grid to a string representation

###### Returns

`string`

A string containing the rendered grid

---

### Table

Defined in: [table.ts:9](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/table.ts#L9)

A versatile table generator for CLI applications.

#### Constructors

##### new Table()

```ts
new Table(options): Table
```

Defined in: [table.ts:20](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/table.ts#L20)

Initializes a new Table instance.

###### Parameters

###### options

[`TableOptions`](index.md#tableoptions) = `{}`

Configuration options for the table.

###### Returns

[`Table`](index.md#table)

#### Methods

##### addRow()

```ts
addRow(row): this
```

Defined in: [table.ts:59](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/table.ts#L59)

Adds a single row to the table body.

###### Parameters

###### row

[`TableCell`](index.md#tablecell)[]

Array of cells representing the row.

###### Returns

`this`

The Table instance for chaining.

##### addRows()

```ts
addRows(...rows): this
```

Defined in: [table.ts:72](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/table.ts#L72)

Adds multiple rows to the table body.

###### Parameters

###### rows

...[`TableCell`](index.md#tablecell)[][]

Array of rows to add.

###### Returns

`this`

The Table instance for chaining.

##### setHeaders()

```ts
setHeaders(headers): this
```

Defined in: [table.ts:39](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/table.ts#L39)

Sets the header rows for the table.
Replaces any existing headers.

###### Parameters

###### headers

Array of header rows OR a single header row.

[`TableCell`](index.md#tablecell)[] | [`TableCell`](index.md#tablecell)[][]

###### Returns

`this`

The Table instance for chaining.

##### toString()

```ts
toString(): string
```

Defined in: [table.ts:88](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/table.ts#L88)

Renders the table to a string.

###### Returns

`string`

The string representation of the table.

## Functions

### createGrid()

```ts
function createGrid(options): Grid;
```

Defined in: [grid.ts:1313](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/grid.ts#L1313)

Creates a new grid instance with the specified options

#### Parameters

##### options

[`GridOptions`](index.md#gridoptions)

Configuration options for the grid

#### Returns

[`Grid`](index.md#grid)

A new Grid instance

---

### createTable()

```ts
function createTable(options?): Table;
```

Defined in: [table.ts:239](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/table.ts#L239)

Creates a new Table instance.

#### Parameters

##### options?

[`TableOptions`](index.md#tableoptions)

Configuration options for the table.

#### Returns

[`Table`](index.md#table)

A new Table instance.

## Interfaces

### BorderComponent

Defined in: [types.ts:74](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L74)

#### Properties

##### char

```ts
char: string;
```

Defined in: [types.ts:75](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L75)

##### width

```ts
width: number;
```

Defined in: [types.ts:76](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L76)

---

### BorderStyle

Defined in: [types.ts:82](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L82)

Represents the style of the border for a table or grid.

#### Properties

##### bodyJoin

```ts
bodyJoin: BorderComponent;
```

Defined in: [types.ts:84](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L84)

Box vertical character.

##### bodyLeft

```ts
bodyLeft: BorderComponent;
```

Defined in: [types.ts:86](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L86)

Box vertical character.

##### bodyRight

```ts
bodyRight: BorderComponent;
```

Defined in: [types.ts:88](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L88)

Box vertical character.

##### bottomBody

```ts
bottomBody: BorderComponent;
```

Defined in: [types.ts:90](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L90)

Box horizontal character.

##### bottomJoin

```ts
bottomJoin: BorderComponent;
```

Defined in: [types.ts:92](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L92)

Box bottom join character.

##### bottomLeft

```ts
bottomLeft: BorderComponent;
```

Defined in: [types.ts:94](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L94)

Box bottom left character.

##### bottomRight

```ts
bottomRight: BorderComponent;
```

Defined in: [types.ts:96](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L96)

Box bottom right character.

##### joinBody

```ts
joinBody: BorderComponent;
```

Defined in: [types.ts:98](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L98)

Box horizontal character.

##### joinJoin

```ts
joinJoin: BorderComponent;
```

Defined in: [types.ts:100](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L100)

Box horizontal join character.

##### joinLeft

```ts
joinLeft: BorderComponent;
```

Defined in: [types.ts:102](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L102)

Box left join character.

##### joinRight

```ts
joinRight: BorderComponent;
```

Defined in: [types.ts:104](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L104)

Box right join character.

##### topBody

```ts
topBody: BorderComponent;
```

Defined in: [types.ts:106](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L106)

Box horizontal character.

##### topJoin

```ts
topJoin: BorderComponent;
```

Defined in: [types.ts:108](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L108)

Box top join character.

##### topLeft

```ts
topLeft: BorderComponent;
```

Defined in: [types.ts:110](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L110)

Box top left character.

##### topRight

```ts
topRight: BorderComponent;
```

Defined in: [types.ts:112](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L112)

Box top right character.

---

### GridItem

Defined in: [types.ts:30](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L30)

#### Extended by

- [`TableItem`](index.md#tableitem)

#### Properties

##### backgroundColor?

```ts
optional backgroundColor:
  | {
  close: string;
  open: string;
 }
  | (text) => string;
```

Defined in: [types.ts:32](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L32)

Background color for the entire cell (including padding)

##### colSpan?

```ts
optional colSpan: number;
```

Defined in: [types.ts:34](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L34)

Number of columns this cell spans

##### content

```ts
content: Content;
```

Defined in: [types.ts:36](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L36)

Content to display in the cell

##### hAlign?

```ts
optional hAlign: HorizontalAlignment;
```

Defined in: [types.ts:38](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L38)

Horizontal alignment of the content

##### maxWidth?

```ts
optional maxWidth: number;
```

Defined in: [types.ts:40](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L40)

Maximum width of the cell content before truncation

##### rowSpan?

```ts
optional rowSpan: number;
```

Defined in: [types.ts:42](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L42)

Number of rows this cell spans

##### truncate?

```ts
optional truncate: boolean | TruncateOptions;
```

Defined in: [types.ts:44](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L44)

Options for controlling how text is truncated when it exceeds maxWidth

##### vAlign?

```ts
optional vAlign: VerticalAlignment;
```

Defined in: [types.ts:46](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L46)

Vertical alignment of the content

##### wordWrap?

```ts
optional wordWrap: boolean | Omit<WordWrapOptions, "width">;
```

Defined in: [types.ts:48](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L48)

Options for controlling word wrapping (takes precedence over truncate)

---

### GridOptions

Defined in: [types.ts:210](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L210)

Defines the style options.

#### Extends

- [`Style`](index.md#style)

#### Properties

##### autoColumns?

```ts
optional autoColumns: number;
```

Defined in: [types.ts:212](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L212)

Default number of columns for auto-generated cells

##### autoFlow?

```ts
optional autoFlow: AutoFlowDirection;
```

Defined in: [types.ts:214](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L214)

Direction of auto-flow when adding items

##### autoRows?

```ts
optional autoRows: number;
```

Defined in: [types.ts:216](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L216)

Default number of rows for auto-generated cells

##### border?

```ts
optional border: BorderStyle;
```

Defined in: [types.ts:122](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L122)

Border style configuration.

###### Inherited from

[`Style`](index.md#style).[`border`](index.md#border-1)

##### columns

```ts
columns: number;
```

Defined in: [types.ts:218](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L218)

Number of columns in the grid

##### defaultTerminalWidth?

```ts
optional defaultTerminalWidth: number;
```

Defined in: [types.ts:220](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L220)

Default terminal width to use for calculations (defaults to 80)

##### fixedColumnWidths?

```ts
optional fixedColumnWidths: number[];
```

Defined in: [types.ts:222](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L222)

Fixed column widths

##### fixedRowHeights?

```ts
optional fixedRowHeights: number[];
```

Defined in: [types.ts:224](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L224)

Fixed row heights

##### gap?

```ts
optional gap: number;
```

Defined in: [types.ts:226](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L226)

Gap between cells

##### maxWidth?

```ts
optional maxWidth: number;
```

Defined in: [types.ts:228](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L228)

Maximum width for the entire grid

##### paddingLeft?

```ts
optional paddingLeft: number;
```

Defined in: [types.ts:127](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L127)

Left padding for all cells.

###### Inherited from

[`Style`](index.md#style).[`paddingLeft`](index.md#paddingleft-1)

##### paddingRight?

```ts
optional paddingRight: number;
```

Defined in: [types.ts:132](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L132)

Right padding for all cells.

###### Inherited from

[`Style`](index.md#style).[`paddingRight`](index.md#paddingright-1)

##### rows?

```ts
optional rows: number;
```

Defined in: [types.ts:230](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L230)

Number of rows in the grid (0 for auto)

##### showBorders?

```ts
optional showBorders: boolean;
```

Defined in: [types.ts:232](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L232)

Whether to show borders (only relevant if border is defined)

##### terminalWidth?

```ts
optional terminalWidth: number;
```

Defined in: [types.ts:234](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L234)

Terminal width to use for calculations (defaults to actual terminal width)

##### truncate?

```ts
optional truncate: boolean | TruncateOptions;
```

Defined in: [types.ts:236](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L236)

Whether to truncate content

##### wordWrap?

```ts
optional wordWrap: boolean | WordWrapOptions;
```

Defined in: [types.ts:238](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L238)

Whether to wrap content in cells (takes precedence over truncate)

---

### Style

Defined in: [types.ts:118](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L118)

Defines the style options.

#### Extended by

- [`GridOptions`](index.md#gridoptions)

#### Properties

##### border?

```ts
optional border: BorderStyle;
```

Defined in: [types.ts:122](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L122)

Border style configuration.

##### paddingLeft?

```ts
optional paddingLeft: number;
```

Defined in: [types.ts:127](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L127)

Left padding for all cells.

##### paddingRight?

```ts
optional paddingRight: number;
```

Defined in: [types.ts:132](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L132)

Right padding for all cells.

---

### TableItem

Defined in: [types.ts:59](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L59)

#### Extends

- [`GridItem`](index.md#griditem)

#### Properties

##### backgroundColor?

```ts
optional backgroundColor:
  | {
  close: string;
  open: string;
 }
  | (text) => string;
```

Defined in: [types.ts:32](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L32)

Background color for the entire cell (including padding)

###### Inherited from

[`GridItem`](index.md#griditem).[`backgroundColor`](index.md#backgroundcolor)

##### colSpan?

```ts
optional colSpan: number;
```

Defined in: [types.ts:34](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L34)

Number of columns this cell spans

###### Inherited from

[`GridItem`](index.md#griditem).[`colSpan`](index.md#colspan)

##### content

```ts
content: Content;
```

Defined in: [types.ts:36](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L36)

Content to display in the cell

###### Inherited from

[`GridItem`](index.md#griditem).[`content`](index.md#content)

##### hAlign?

```ts
optional hAlign: HorizontalAlignment;
```

Defined in: [types.ts:38](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L38)

Horizontal alignment of the content

###### Inherited from

[`GridItem`](index.md#griditem).[`hAlign`](index.md#halign)

##### href?

```ts
optional href: string;
```

Defined in: [types.ts:63](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L63)

Optional URL for making the cell content a hyperlink.

##### maxWidth?

```ts
optional maxWidth: number;
```

Defined in: [types.ts:40](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L40)

Maximum width of the cell content before truncation

###### Inherited from

[`GridItem`](index.md#griditem).[`maxWidth`](index.md#maxwidth)

##### rowSpan?

```ts
optional rowSpan: number;
```

Defined in: [types.ts:42](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L42)

Number of rows this cell spans

###### Inherited from

[`GridItem`](index.md#griditem).[`rowSpan`](index.md#rowspan)

##### style?

```ts
optional style: CellStyle;
```

Defined in: [types.ts:69](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L69)

TODO: Check if this is needed
Style options for the cell.

##### truncate?

```ts
optional truncate: boolean | TruncateOptions;
```

Defined in: [types.ts:44](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L44)

Options for controlling how text is truncated when it exceeds maxWidth

###### Inherited from

[`GridItem`](index.md#griditem).[`truncate`](index.md#truncate)

##### vAlign?

```ts
optional vAlign: VerticalAlignment;
```

Defined in: [types.ts:46](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L46)

Vertical alignment of the content

###### Inherited from

[`GridItem`](index.md#griditem).[`vAlign`](index.md#valign)

##### wordWrap?

```ts
optional wordWrap: boolean | Omit<WordWrapOptions, "width">;
```

Defined in: [types.ts:48](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L48)

Options for controlling word wrapping (takes precedence over truncate)

###### Inherited from

[`GridItem`](index.md#griditem).[`wordWrap`](index.md#wordwrap)

---

### TableOptions

Defined in: [types.ts:138](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L138)

Defines the options for table construction.

#### Properties

##### columnWidths?

```ts
optional columnWidths: number | number[];
```

Defined in: [types.ts:144](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L144)

Fixed column widths for specific columns. Content exceeding the width will be truncated
based on the truncate options.
Can specify width for all columns with a single number or for specific columns with an array.

##### defaultTerminalWidth?

```ts
optional defaultTerminalWidth: number;
```

Defined in: [types.ts:147](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L147)

Default terminal width to use for calculations (defaults to 80)

##### gap?

```ts
optional gap: number;
```

Defined in: [types.ts:152](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L152)

Gap between cells (overrides style.gap)

##### maxWidth?

```ts
optional maxWidth: number;
```

Defined in: [types.ts:157](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L157)

Maximum width for the entire table.

##### rowHeights?

```ts
optional rowHeights: number | number[];
```

Defined in: [types.ts:164](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L164)

Fixed row heights for specific rows. Content exceeding the height will be truncated
with an ellipsis symbol on the last line.
Can specify height for all rows with a single number or for specific rows with an array.

##### showHeader?

```ts
optional showHeader: boolean;
```

Defined in: [types.ts:169](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L169)

Whether to show the header of the table

##### style?

```ts
optional style: Partial<Style & object>;
```

Defined in: [types.ts:174](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L174)

The style options for the table

##### terminalWidth?

```ts
optional terminalWidth: number;
```

Defined in: [types.ts:186](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L186)

Terminal width to use for calculations (defaults to actual terminal width)

##### transformTabToSpace?

```ts
optional transformTabToSpace: number;
```

Defined in: [types.ts:191](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L191)

The number of spaces to use for tab characters.

##### truncate?

```ts
optional truncate: TruncateOptions;
```

Defined in: [types.ts:196](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L196)

Options for controlling how text is truncated when it exceeds maxWidth

##### wordWrap?

```ts
optional wordWrap: boolean | Omit<WordWrapOptions, "width">;
```

Defined in: [types.ts:201](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L201)

Whether to enable word wrapping.

## Type Aliases

### AutoFlowDirection

```ts
type AutoFlowDirection = "column" | "row";
```

Defined in: [types.ts:206](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L206)

---

### BorderType

```ts
type BorderType = "bottom" | "middle" | "top";
```

Defined in: [types.ts:207](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L207)

---

### CellStyle

```ts
type CellStyle = object;
```

Defined in: [types.ts:8](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L8)

Style options for a cell.

#### Type declaration

##### border?

```ts
optional border: string[];
```

Array of style names for the cell's border.

##### head?

```ts
optional head: string[];
```

Array of style names for the cell's head.

##### paddingLeft?

```ts
optional paddingLeft: number;
```

Left padding of the cell content.

##### paddingRight?

```ts
optional paddingRight: number;
```

Right padding of the cell content.

---

### Content

```ts
type Content = bigint | boolean | number | string | null | undefined;
```

Defined in: [types.ts:3](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L3)

---

### GridCell

```ts
type GridCell = Content | GridItem;
```

Defined in: [types.ts:52](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L52)

Input type for a cell, can be primitive or an options object

---

### HorizontalAlignment

```ts
type HorizontalAlignment = "center" | "left" | "right";
```

Defined in: [types.ts:205](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L205)

---

### TableCell

```ts
type TableCell = Content | TableItem;
```

Defined in: [types.ts:72](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L72)

---

### VerticalAlignment

```ts
type VerticalAlignment = "bottom" | "middle" | "top";
```

Defined in: [types.ts:204](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/types.ts#L204)

# style

## Variables

### ASCII_BORDER

```ts
const ASCII_BORDER: BorderStyle;
```

Defined in: [style.ts:132](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/style.ts#L132)

ASCII border style using only ASCII characters.

---

### DEFAULT_BORDER

```ts
const DEFAULT_BORDER: BorderStyle;
```

Defined in: [style.ts:6](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/style.ts#L6)

Default border style using standard box-drawing characters.

---

### DOTS_BORDER

```ts
const DOTS_BORDER: BorderStyle;
```

Defined in: [style.ts:90](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/style.ts#L90)

Border style using dots for the border.

---

### DOUBLE_BORDER

```ts
const DOUBLE_BORDER: BorderStyle;
```

Defined in: [style.ts:48](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/style.ts#L48)

Double-line border style using Unicode box-drawing characters.

---

### MARKDOWN_BORDER

```ts
const MARKDOWN_BORDER: BorderStyle;
```

Defined in: [style.ts:111](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/style.ts#L111)

Border style using Markdown syntax.

---

### MINIMAL_BORDER

```ts
const MINIMAL_BORDER: BorderStyle;
```

Defined in: [style.ts:27](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/style.ts#L27)

Minimal border style using only horizontal lines.

---

### NO_BORDER

```ts
const NO_BORDER: BorderStyle;
```

Defined in: [style.ts:153](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/style.ts#L153)

No border style.

---

### ROUNDED_BORDER

```ts
const ROUNDED_BORDER: BorderStyle;
```

Defined in: [style.ts:69](https://github.com/visulima/visulima/blob/0a4d6fa5adff817cbf8f5e64536603c63d8ee7b4/packages/tabular/src/style.ts#L69)

Border style with rounded corners using Unicode box-drawing characters.

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
