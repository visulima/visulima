module.exports = {
    plugins: {
        autoprefixer: {},
        "postcss-focus-visible": {
            replaceWith: "[data-focus-visible-added]",
        },
        "postcss-import": {},
        tailwindcss: {},
        "tailwindcss/nesting": {},
    },
};
