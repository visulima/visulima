import { Table } from '../dist/index.mjs';
import { red, green, yellow, blue, magenta, cyan, gray } from '@visulima/colorize';

// Example 1: Basic table with colors and alignment
const table1 = new Table();
table1
    .setHeaders([
        { content: 'Name', hAlign: 'center' },
        { content: 'Status', hAlign: 'center' },
        { content: 'Coverage', hAlign: 'center' },
    ])
    .addRow([
        { content: 'Core Module', hAlign: 'left' },
        { content: green('✓ Passed'), hAlign: 'center' },
        { content: '98%', hAlign: 'right' },
    ])
    .addRow([
        { content: 'Utils', hAlign: 'left' },
        { content: yellow('⚠ Warning'), hAlign: 'center' },
        { content: '85%', hAlign: 'right' },
    ])
    .addRow([
        { content: 'UI Components', hAlign: 'left' },
        { content: red('✗ Failed'), hAlign: 'center' },
        { content: '62%', hAlign: 'right' },
    ]);

console.log('Example 1: Basic table with colors and alignment');
console.log(table1.toString());
console.log();

// Example 2: Table with row and column spans
const table2 = new Table();
table2
    .setHeaders([
        { content: 'Component', hAlign: 'center' },
        { content: 'Tests', hAlign: 'center', colSpan: 2 },
        { content: 'Coverage', hAlign: 'center' }
    ])
    .addRow([
        { content: 'Frontend', rowSpan: 2, hAlign: 'center' },
        { content: 'Unit', hAlign: 'left' },
        { content: green('156/156'), hAlign: 'right' },
        { content: '100%', hAlign: 'right' },
    ])
    .addRow([
        null, // rowSpan from above
        { content: 'Integration', hAlign: 'left' },
        { content: yellow('23/25'), hAlign: 'right' },
        { content: '92%', hAlign: 'right' },
    ])
    .addRow([
        { content: 'Backend', rowSpan: 2, hAlign: 'center' },
        { content: 'Unit', hAlign: 'left' },
        { content: green('312/312'), hAlign: 'right' },
        { content: '100%', hAlign: 'right' },
    ])
    .addRow([
        null, // rowSpan from above
        { content: 'Integration', hAlign: 'left' },
        { content: red('45/60'), hAlign: 'right' },
        { content: '75%', hAlign: 'right' },
    ]);

console.log('Example 2: Table with row and column spans');
console.log(table2.toString());
console.log();

// Example 3: Table with Unicode characters and emojis
const table3 = new Table();
table3
    .setHeaders([
        { content: '📊 Metrics', hAlign: 'center' },
        { content: '📈 Progress', hAlign: 'center' },
        { content: '🎯 Target', hAlign: 'center' },
    ])
    .addRow([
        { content: '代码覆盖率', hAlign: 'left' },
        { content: blue('▓▓▓▓▓▓▓▓░░ 80%'), hAlign: 'center' },
        { content: '90%', hAlign: 'right' },
    ])
    .addRow([
        { content: '性能测试', hAlign: 'left' },
        { content: green('▓▓▓▓▓▓▓▓▓░ 95%'), hAlign: 'center' },
        { content: '85%', hAlign: 'right' },
    ])
    .addRow([
        { content: '安全扫描', hAlign: 'left' },
        { content: red('▓▓▓▓░░░░░░ 40%'), hAlign: 'center' },
        { content: '100%', hAlign: 'right' },
    ]);

console.log('Example 3: Table with Unicode characters and emojis');
console.log(table3.toString());
console.log();

// Example 4: Table with truncated content and multi-line text
const table4 = new Table({
    truncate: true,
    maxWidth: 120,   // Maximum width for cell content before truncation
});
const longText = 'This is a very long description that will be automatically truncated to fit within the cell width while preserving ANSI colors and maintaining proper alignment.';

table4
    .setHeaders([
        { content: 'Feature', hAlign: 'center' },
        { content: 'Description', hAlign: 'center' },
        { content: 'Status', hAlign: 'center' },
    ])
    .addRow([
        { content: magenta('Authentication'), hAlign: 'left' },
        { content: cyan(longText), hAlign: 'left' },
        { content: green('Active'), hAlign: 'center' },
    ])
    .addRow([
        { content: yellow('Authorization'), hAlign: 'left' },
        { content: 'Role-based access control\nwith multi-tenant support', hAlign: 'left' },
        { content: yellow('Pending'), hAlign: 'center' },
    ])
    .addRow([
        { content: red('Monitoring'), hAlign: 'left' },
        { content: gray('System health checks\nand performance metrics'), hAlign: 'left' },
        { content: red('Inactive'), hAlign: 'center' },
    ]);

console.log('Example 4: Table with truncated content and multi-line text');
console.log(table4.toString());
