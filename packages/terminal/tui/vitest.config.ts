import { getVitestConfig } from "../../../tools/get-vitest-config";

const config = getVitestConfig({
    test: {
        setupFiles: ["./__tests__/setup.ts"],
        // type-fest is types-only; its package.json has no JS export under node/import conditions
        deps: {
            inline: [/type-fest/],
        },
    },
});

export default config;
