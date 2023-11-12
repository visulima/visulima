/** @type {import('postcss-load-config').Config} */
module.exports = {
    plugins: {
        "postcss-import": {},
        "tailwindcss/nesting": {},
        tailwindcss: {},
        "postcss-focus-visible": {
            replaceWith: "[data-focus-visible-added]",
        },
        "postcss-lightningcss": {
            browsers: ">= .25%",
        },
    },
};
