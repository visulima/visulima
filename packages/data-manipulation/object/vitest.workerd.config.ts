import { getWorkerdVitestConfig } from "../../../tools/get-workerd-vitest-config";

const config = getWorkerdVitestConfig({
    test: {
        include: ["__tests__/*.test.ts", "__tests__/utils/**/*.test.ts", "__tests__/workerd/**/*.test.ts"],
    },
});

export default config;
