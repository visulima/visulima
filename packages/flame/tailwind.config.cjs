module.exports = {
    content: ["./src/template/**/*.ts", "node_modules/preline/dist/*.js"],
    darkMode: "class",
    plugins: [
        require('@tailwindcss/forms'),
        require('preline/plugin'),
    ],
};
