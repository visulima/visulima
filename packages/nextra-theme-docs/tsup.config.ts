import { createConfig } from "../../tsup.config";

const config = createConfig({
    format: "esm",
    external: ["nextra"],
});

export default config;
