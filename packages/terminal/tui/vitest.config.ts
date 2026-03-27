import { getVitestConfig } from "../../../tools/get-vitest-config";

const config = getVitestConfig({
    test: {
        setupFiles: ["./__tests__/setup.ts"],
    },
});

export default config;
