/** @type {import('postcss-load-config').Config} */
module.exports = {
    plugins: {
        "tailwindcss/nesting": {},
        tailwindcss: {},
        "postcss-focus-visible": {
            replaceWith: "[data-focus-visible-added]",
        },
    },
};
