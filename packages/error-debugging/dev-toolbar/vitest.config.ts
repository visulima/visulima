import { getVitestConfig } from "../../../tools/get-vitest-config";

const config = getVitestConfig({
    test: {
        passWithNoTests: true,
    },
});

export default config;
