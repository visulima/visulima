import { getWorkerdVitestConfig } from "../../../tools/get-workerd-vitest-config";

const config = getWorkerdVitestConfig({
    test: {
        include: ["__tests__/unit/**/*.test.ts", "__tests__/workerd/**/*.test.ts"],
    },
});

export default config;
