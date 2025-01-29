<div align="center">
  <h3>visulima table</h3>
  <p>
  A powerful and flexible CLI table generator for Node.js, written in TypeScript. Create beautiful ASCII tables with customizable borders, padding, and alignment. Supports Unicode, colors, and ANSI escape codes.
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

## Installation

```bash
npm install @visulima/table
```

```bash
yarn add @visulima/table
```

```bash
pnpm add @visulima/table
```

## Examples

### Basic Usage

Create a simple table with headers and rows:

```typescript
import { createTable } from '@visulima/table';

const table = createTable()
    .setHeaders(['Name', 'Age', 'City'])
    .addRow(['John Doe', '30', 'New York'])
    .addRow(['Jane Smith', '25', 'Los Angeles'])
    .addRow(['Bob Johnson', '35', 'Chicago']);

console.log(table.toString());
```

Output:
```
┌────────────┬─────┬────────────┐
│ Name       │ Age │ City       │
├────────────┼─────┼────────────┤
│ John Doe   │ 30  │ New York   │
│ Jane Smith │ 25  │ Los Angeles│
│ Bob Johnson│ 35  │ Chicago    │
└────────────┴─────┴────────────┘
```

### Colorized Borders and Content

Create a table with colorized borders and status indicators:

```typescript
import { createTable } from '@visulima/table';
import { red, green, blue, yellow, magenta } from '@visulima/colorize';

const table = createTable({
    border: {
        topBody: green('─'),
        topJoin: green('┬'),
        topLeft: green('┌'),
        topRight: green('┐'),

        bottomBody: red('─'),
        bottomJoin: red('┴'),
        bottomLeft: red('└'),
        bottomRight: red('┘'),

        bodyLeft: blue('│'),
        bodyRight: blue('│'),
        bodyJoin: blue('│'),

        joinBody: magenta('─'),
        joinLeft: magenta('├'),
        joinRight: magenta('┤'),
        joinJoin: magenta('┼'),

        headerJoin: yellow('─'),
    },
    padding: 1,
});

// Example data: Server status dashboard
table
    .setHeaders([
        { content: '🖥️ Server', hAlign: 'center' },
        { content: '📊 Load', hAlign: 'center' },
        { content: '🕒 Uptime', hAlign: 'right' },
        { content: '📈 Status', hAlign: 'center' }
    ])
    .addRow([
        'API Server',
        green('28%'),
        '24d 12h',
        green('● Online')
    ])
    .addRow([
        'Database',
        yellow('78%'),
        '15d 6h',
        yellow('● Warning')
    ])
    .addRow([
        'Cache',
        red('92%'),
        '7d 3h',
        red('● Critical')
    ]);

console.log(table.toString());
```

Output:
```
┌───────────────┬─────────┬───────────┬────────────┐  // Green border
│   🖥️ Server   │ 📊 Load │ 🕒 Uptime │ 📈 Status  │  // Blue border
├───────────────┼─────────┼───────────┼────────────┤  // Magenta border
│ API Server    │ 28%     │ 24d 12h   │ ● Online   │  // Blue border
├───────────────┼─────────┼───────────┼────────────┤  // Magenta border
│ Database      │ 78%     │ 15d 6h    │ ● Warning  │  // Blue border
├───────────────┼─────────┼───────────┼────────────┤  // Magenta border
│ Cache         │ 92%     │ 7d 3h     │ ● Critical │  // Blue border
└───────────────┴─────────┴───────────┴────────────┘  // Red border
```

### Custom Layouts

#### File System Listing

Create a borderless table that mimics the `ls -l` command output:

```typescript
import { createTable } from '@visulima/table';
import { blue } from '@visulima/colorize';

const table = createTable({
    drawOuterBorder: false,
    padding: 1,
});

table
    .addRow([
        '-rw-r--r--',
        '1',
        'user',
        'staff',
        '1529',
        'May 23 11:25',
        'LICENSE'
    ])
    .addRow([
        'drwxr-xr-x',
        '76',
        'user',
        'staff',
        '2432',
        'May 23 12:02',
        blue('dist/')
    ])
    .addRow([
        'drwxr-xr-x',
        '634',
        'user',
        'staff',
        '20288',
        'May 23 11:54',
        blue('node_modules/')
    ])
    .addRow([
        '-rw-r--r--',
        '1',
        'user',
        'staff',
        '525688',
        'May 23 11:52',
        'package-lock.json'
    ]);

console.log(table.toString());
```

Output:
```
-rw-r--r--  1    user  staff     1529  May 23 11:25  LICENSE
drwxr-xr-x  76   user  staff     2432  May 23 12:02  dist/
drwxr-xr-x  634  user  staff    20288  May 23 11:54  node_modules/
-rw-r--r--  1    user  staff   525688  May 23 11:52  package-lock.json
```

#### Selective Line Drawing

Control which horizontal lines to draw:

```typescript
import { createTable } from '@visulima/table';

const table = createTable({
    drawHorizontalLine: (lineIndex: number, rowCount: number) => {
        // Draw only top, header, and bottom lines
        return lineIndex === 0 || lineIndex === 1 || lineIndex === rowCount;
    }
});

table
    .setHeaders(['ID', 'Status', 'Description'])
    .addRow(['1', '✅ Active', 'Service is running'])
    .addRow(['2', '⚠️ Warning', 'High memory usage'])
    .addRow(['3', '❌ Error', 'Connection failed']);

console.log(table.toString());
```

Output:
```
┌────┬───────────┬───────────────────┐
│ ID │  Status   │    Description    │
├────┼───────────┼───────────────────┤
│ 1  │ ✅ Active  │ Service is running│
│ 2  │ ⚠️ Warning │ High memory usage │
│ 3  │ ❌ Error   │ Connection failed │
└────┴───────────┴───────────────────┘
```

#### Mixed Column Alignments

Configure different alignment options for each column:

```typescript
import { createTable } from '@visulima/table';

const table = createTable({
    padding: 2,
});

table
    .setHeaders([
        { content: 'Left', hAlign: 'left' },
        { content: 'Center', hAlign: 'center' },
        { content: 'Right', hAlign: 'right' },
        { content: 'Justified', hAlign: 'justify' }
    ])
    .addRow([
        { content: 'A1', hAlign: 'left' },
        { content: 'A2', hAlign: 'center' },
        { content: 'A3', hAlign: 'right' },
        { content: 'Long text that will be justified', hAlign: 'justify' }
    ])
    .addRow([
        { content: 'B1', hAlign: 'left' },
        { content: 'B2', hAlign: 'center' },
        { content: 'B3', hAlign: 'right' },
        { content: 'Another long text example', hAlign: 'justify' }
    ]);

console.log(table.toString());
```

Output:
```
┌──────┬─────────┬───────┬──────────────────────────┐
│ Left │ Center  │ Right │        Justified         │
├──────┼─────────┼───────┼──────────────────────────┤
│ A1   │   A2    │    A3 │ Long  text  that will be │
│      │         │       │ justified                │
├──────┼─────────┼───────┼──────────────────────────┤
│ B1   │   B2    │    B3 │ Another    long     text │
│      │         │       │ example                  │
└──────┴─────────┴───────┴──────────────────────────┘
```

## API Reference

### TableOptions

```typescript
interface TableOptions {
    border?: BorderStyle;      // Custom border characters
    padding?: number;          // Cell padding (default: 1)
    drawOuterBorder?: boolean; // Show outer border (default: true)
    emptyCellChar?: string;    // Character for empty cells (default: '')
    truncate?: boolean;        // Truncate long content (default: false)
    maxWidth?: number;         // Max cell width (default: 30)
    align?: 'left' | 'center' | 'right'; // Default cell alignment (default: 'left')
}
```

### Cell Configuration

```typescript
interface CellConfig {
    content: string | number;  // Cell content
    hAlign?: 'left' | 'center' | 'right';  // Horizontal alignment
    vAlign?: 'top' | 'middle' | 'bottom';  // Vertical alignment
    colSpan?: number;         // Number of columns to span
    rowSpan?: number;         // Number of rows to span
}
```

### Methods

- `setHeaders(headers: (string | CellConfig)[]): Table` - Set table headers
- `addRow(row: (string | number | CellConfig)[]): Table` - Add a single row
- `addRows(rows: (string | number | CellConfig)[][]): Table` - Add multiple rows
- `clear(): Table` - Clear all rows
- `toString(): string` - Convert table to string

### Features

#### Unicode Support
The table automatically handles:
- CJK (Chinese, Japanese, Korean) characters
- Emojis and other Unicode symbols
- Full-width and half-width characters
- ANSI color codes

#### Alignment
Each cell can have its own alignment settings:
```typescript
table.addRow([
    { content: "Left", hAlign: "left" },
    { content: "Center", hAlign: "center" },
    { content: "Right", hAlign: "right" }
]);
```

#### Colors
Works seamlessly with ANSI color codes:
```typescript
import { red, green, blue } from '@visulima/colorize';

table.addRow([
    red("Error"),
    green("Success"),
    blue("Info")
]);
```

## Related

- [@visulima/colorize](https://npmjs.com/package/@visulima/colorize) - Add colors to your CLI output
- [@visulima/logger](https://npmjs.com/package/@visulima/logger) - Powerful logging utility
- [cli-table3](https://github.com/cli-table/cli-table3) - Pretty unicode tables for the command line
- [table](https://github.com/gajus/table) - Formats data into a string table.

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js' release schedule](https://github.com/nodejs/release#release-schedule).
Here's [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

## Contributing

If you would like to help take a look at the [list of issues](https://github.com/visulima/visulima/issues) and check our [Contributing](.github/CONTRIBUTING.md) guidelines.

> **Note:** please note that this project is released with a Contributor Code of Conduct. By participating in this project you agree to abide by its terms.

## Credits

-   [Daniel Bannert](https://github.com/prisis)
-   [All Contributors](https://github.com/visulima/visulima/graphs/contributors)

## License

The visulima table is open-sourced software licensed under the [MIT][license-url]

[typescript-image]: https://img.shields.io/badge/Typescript-294E80.svg?style=for-the-badge&logo=typescript
[typescript-url]: https://www.typescriptlang.org/ "TypeScript"
[license-image]: https://img.shields.io/npm/l/@visulima/table?color=blueviolet&style=for-the-badge
[license-url]: LICENSE.md "license"
[npm-image]: https://img.shields.io/npm/v/@visulima/table/latest.svg?style=for-the-badge&logo=npm
[npm-url]: https://www.npmjs.com/package/@visulima/table/v/latest "npm"
