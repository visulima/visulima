import js from "@eslint/js";
import { globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config([
    globalIgnores(["dist"]),
    {
        extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs["recommended-latest"], reactRefresh.configs.vite],
        files: ["**/*.{ts,tsx}"],
        languageOptions: {
            ecmaVersion: 2020,
            globals: globals.browser,
        },
    },
]);
