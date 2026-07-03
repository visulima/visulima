import { getVitestConfig } from "../../../tools/get-vitest-config";

const config = getVitestConfig({
    test: {
        setupFiles: ["./test-setup-file.ts"],
    },
});

export default config;
