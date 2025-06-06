/** @type {import('postcss-load-config').Config} */
module.exports = {
    plugins: {
        "@tailwindcss/postcss": {},
        "postcss-focus-visible": {
            replaceWith: "[data-focus-visible-added]",
        },
    },
};
