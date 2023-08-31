const mvdir = require("mvdir");
const path = require("node:path");

const source = path.join(__dirname, "..", "storybook-static");

mvdir(source, path.join(__dirname, "..", "storybook"), { copy: true });
