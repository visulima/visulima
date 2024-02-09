import { createConfig } from "../../tsup.config";

const config = createConfig({
    shims: false,
    cjsInterop: false,
});

export default config;
