import { createTable } from "../dist/index.mjs";

import { DEFAULT_BORDER, ROUNDED_BORDER, DOUBLE_BORDER, MINIMAL_BORDER, ASCII_BORDER, MARKDOWN_BORDER, DOTS_BORDER } from "../dist/style.mjs";

const data = {
    headers: ["Name", "Age", "City"],
    rows: [
        ["John Doe", "30", "New York"],
        ["Jane Smith", "25", "Los Angeles"],
        ["Bob Johnson", "35", "Chicago"],
    ],
};

const styles = [
    { name: "Default Style", border: DEFAULT_BORDER },
    { name: "Rounded Border", border: ROUNDED_BORDER },
    { name: "Double Border", border: DOUBLE_BORDER },
    { name: "Minimal Border", border: MINIMAL_BORDER },
    { name: "ASCII Border", border: ASCII_BORDER },
    { name: "Markdown Border", border: MARKDOWN_BORDER },
    { name: "Dots Border", border: DOTS_BORDER },
];

// Display all border styles
styles.forEach(({ name, border }) => {
    console.log(`\n${name}:`);
    const table = createTable({ border }).setHeaders(data.headers).addRows(data.rows);

    console.log(table.toString());
});
