import { createTable } from '../dist/index.mjs';
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
