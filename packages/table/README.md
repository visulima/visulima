<div align="center">
  <h3>visulima table</h3>
  <p>
  Create beautifully styled, customizable, and easy-to-read tables for CLI applications with minimal effort.
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

## Install

```sh
npm install @visulima/table
```

```sh
yarn add @visulima/table
```

```sh
pnpm add @visulima/table
```

## Usage

# @visulima/table

A powerful and flexible CLI table generator for Node.js, written in TypeScript. Create beautiful ASCII tables with customizable borders, padding, and alignment.

## Features

- **Type-safe**: Full TypeScript support
- **Customizable Borders**: Use different border styles or create your own
- **Flexible Alignment**: Left, center, or right align your content
- **Content Truncation**: Automatically handle long content
- **Fluent API**: Chain methods for a better developer experience
- **Auto-sizing**: Columns automatically adjust to content
- **Custom Styling**: Padding, borders, and more

## Installation

```bash
npm install @visulima/table
```

## Usage

### Basic Example

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

### Custom Styling

```typescript
import { createTable } from '@visulima/table';

const table = createTable({
    padding: 2,
    align: 'center',
    truncate: true,
    maxWidth: 20
})
    .setHeaders(['Column 1', 'Column 2'])
    .addRow(['Short', 'This is a very long content that will be truncated'])
    .addRow(['Content', 'More content']);

console.log(table.toString());
```

### Custom Border Style

```typescript
import { createTable } from '@visulima/table';

const table = createTable({
    border: {
        topBody: '═',
        topJoin: '╤',
        topLeft: '╔',
        topRight: '╗',
        bottomBody: '═',
        bottomJoin: '╧',
        bottomLeft: '╚',
        bottomRight: '╝',
        bodyLeft: '║',
        bodyRight: '║',
        bodyJoin: '│',
        joinBody: '─',
        joinLeft: '╟',
        joinRight: '╢',
        joinJoin: '┼'
    }
})
    .setHeaders(['Name', 'Value'])
    .addRow(['Item 1', '100'])
    .addRow(['Item 2', '200']);

console.log(table.toString());
```

## API Reference

### TableOptions

```typescript
{
    border?: BorderStyle;      // Custom border characters
    padding?: number;          // Cell padding (default: 1)
    drawOuterBorder?: boolean; // Show outer border (default: true)
    emptyCellChar?: string;    // Character for empty cells (default: '')
    truncate?: boolean;        // Truncate long content (default: false)
    maxWidth?: number;         // Max cell width (default: 30)
    align?: 'left' | 'center' | 'right'; // Cell alignment (default: 'left')
}
```

### Methods

- `setHeaders(headers: string[]): Table` - Set table headers
- `addRow(row: (string | number)[]): Table` - Add a single row
- `addRows(rows: (string | number)[][]): Table` - Add multiple rows
- `clear(): Table` - Clear all rows
- `toString(): string` - Convert table to string

## Related

- [@visulima/colorize](https://npmjs.com/package/@visulima/colorize) - Add colors to your CLI output
- [@visulima/logger](https://npmjs.com/package/@visulima/logger) - Powerful logging utility

## Supported Node.js Versions

Libraries in this ecosystem make the best effort to track [Node.js’ release schedule](https://github.com/nodejs/release#release-schedule).
Here’s [a post on why we think this is important](https://medium.com/the-node-js-collection/maintainers-should-consider-following-node-js-release-schedule-ab08ed4de71a).

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
