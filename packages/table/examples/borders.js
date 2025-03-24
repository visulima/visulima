import { createTable } from "../dist";
import { ASCII_BORDER, DEFAULT_BORDER, DOTS_BORDER, DOUBLE_BORDER, MARKDOWN_BORDER, MINIMAL_BORDER, NO_BORDER,ROUNDED_BORDER } from "../dist/style.mjs";

const data = {
    headers: ["Name", "Age", "City"],
    rows: [
        ["John Doe", "30", "New York"],
        ["Jane Smith", "25", "Los Angeles"],
        ["Bob Johnson", "35", "Chicago"],
    ],
};

const styles = [
    { border: DEFAULT_BORDER, name: "Default Style" },
    { border: ROUNDED_BORDER, name: "Rounded Border" },
    { border: DOUBLE_BORDER, name: "Double Border" },
    { border: MINIMAL_BORDER, name: "Minimal Border" },
    { border: ASCII_BORDER, name: "ASCII Border" },
    { border: MARKDOWN_BORDER, name: "Markdown Border" },
    { border: DOTS_BORDER, name: "Dots Border" },
    { border: NO_BORDER, name: "No Border" },
];

// Display all border styles
styles.forEach(({ border, name }) => {
    console.log(`\n${name}:`);
    const table = createTable({ border }).setHeaders(data.headers).addRows(data.rows);

    console.log(table.toString());
});
