import { createConfig } from "../../tsup.config";

const config = createConfig({
    format: "esm",
    shims: false,
});

export default config;
