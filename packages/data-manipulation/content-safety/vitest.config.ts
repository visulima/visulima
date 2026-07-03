import { getVitestConfig } from "../../../tools/get-vitest-config";

const config = getVitestConfig();

config.test = config.test || {};
config.test.testTimeout = 20000;

export default config;
