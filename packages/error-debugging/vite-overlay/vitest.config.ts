import { getVitestConfig } from "../../../tools/get-vitest-config";

const config = getVitestConfig({
    test: {
        exclude: ["__tests__/e2e/**"],
        include: ["__tests__/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}", "__tests__/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    },
});

export default config;
