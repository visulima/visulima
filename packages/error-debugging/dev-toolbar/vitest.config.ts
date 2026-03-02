import { getVitestConfig } from "../../../tools/get-vitest-config";

const config = getVitestConfig({
    test: {
        environment: "jsdom",
        passWithNoTests: true,
        setupFiles: ["./__tests__/setup.ts"],
    },
});

export default config;
