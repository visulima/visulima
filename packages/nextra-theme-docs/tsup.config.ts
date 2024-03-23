import { createConfig } from "../../tools/get-tsup-config";

const config = createConfig({
    format: "esm",
    external: ["nextra"],
});

export default config;
