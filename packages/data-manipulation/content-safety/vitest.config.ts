import { getVitestConfig } from "../../../tools/get-vitest-config";

const config = getVitestConfig();

// Increase test timeout for regex-heavy operations
config.test = config.test || {};
config.test.testTimeout = 10000; // 10 seconds per test (default is 5s)

export default config;
