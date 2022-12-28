/// <reference types="vitest" />

import { defineConfig } from "vitest/config";

import { jestTest } from "./jest.config";

const exclude = [
    "**/node_modules/**",
    "**/dist/**",
    "**/cypress/**",
    "**/.{idea,git,cache,output,temp}/**",
    "**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress}.config.*",
    ...jestTest,
    "__mocks__/fs/**",
    "__tests__/__helpers__/**",
];

// https://vitejs.dev/config/
export default defineConfig({
    // plugins: [react()],
    test: {
        environment: "node",
        exclude,
        coverage: {
            exclude,
        },
    },
});
