const config = require("@anolilab/eslint-config");

module.exports = [
    ...config,
    {
        ignores: ["dist/**", "node_modules/**", "*.d.ts"],
    },
];
