import { createConfig } from "../../tools/get-tsup-config";

const config = createConfig({
    shims: false,
    cjsInterop: false,
});

export default config;
