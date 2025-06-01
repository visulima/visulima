/** @type {import('postcss-load-config').Config} */
module.exports = {
    plugins: {
        "postcss-focus-visible": {
            replaceWith: "[data-focus-visible-added]",
        },
    },
};
