/** @type {import('postcss-load-config').Config} */
module.exports = {
    plugins: {
        autoprefixer: {},
        "postcss-focus-visible": {
            replaceWith: "[data-focus-visible-added]",
        },
        "postcss-import": {},
        "tailwindcss/nesting": {},
        tailwindcss: {},
    },
};
