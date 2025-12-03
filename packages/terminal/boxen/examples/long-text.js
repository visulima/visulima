import { boxen } from "../dist/index.mjs";

const longText =
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Maecenas id erat arcu. Integer urna mauris, sodales vel egestas eu, consequat id turpis. Vivamus faucibus est mattis tincidunt lobortis. In aliquam placerat nunc eget viverra. Duis aliquet faucibus diam, blandit tincidunt magna congue eu. Sed vel ante vestibulum, maximus risus eget, iaculis velit. Quisque id dapibus purus, ut sodales lorem. Aenean laoreet iaculis tellus at malesuada. Donec imperdiet eu lacus vitae fringilla.";

console.log("\n--- Long Text (Default) ---");
const defaultLongTextBox = boxen(longText);

console.log(defaultLongTextBox);

console.log("\n--- Long Text with Padding ---");
const paddedLongTextBox = boxen(longText, {
    headerText: "Padded Long Text",
    padding: 1,
});

console.log(paddedLongTextBox);

console.log("\n--- Long Text with Margin and Header ---");
const marginedLongTextBox = boxen(longText, {
    headerText: "Long Text with Margin & Header",
    margin: 1,
});

console.log(marginedLongTextBox);

console.log("\n--- Long Text with Full Width (approximated by width option) ---");
// Note: True terminal full width is hard to guarantee in a static example script.
// We use a large width value here to simulate the effect.
// In a real terminal, boxen tries to adapt to process.stdout.columns.
const fullWidthLongTextBox = boxen(longText, {
    headerText: "Simulated Full Width Long Text",
    padding: 1,
    width: 70, // Example width, adjust as needed for your terminal
});

console.log(fullWidthLongTextBox);
