import { createConfig } from "../../tools/get-tsup-config";
import inlineImportPlugin from "esbuild-plugin-inline-import";

const config = createConfig({
    format: "esm",
    loader: { ".css": "text", ".svg": "text" },
    esbuildPlugins: [inlineImportPlugin()],
});

export default config;
