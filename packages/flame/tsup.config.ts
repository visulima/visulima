import { createConfig } from "../../tsup.config";

const config = createConfig({
    format: "esm",
    loader: { ".css": "text" },
});

export default config;
