import { createTable } from '../dist/index.mjs';

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
