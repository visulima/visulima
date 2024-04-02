import type { RollupJsonOptions } from "@rollup/plugin-json";
import rollupJSONPlugin from "@rollup/plugin-json";
import type { Plugin } from "rollup";

const EXPORT_DEFAULT = "export default ";

const JSONPlugin = (options: RollupJsonOptions): Plugin => {
    const plugin = rollupJSONPlugin(options);

    return <Plugin>{
        ...plugin,
        name: "packem:json",
        transform(code, id) {
            const result = plugin.transform?.call(this, code, id);

            if (result && typeof result !== "string" && "code" in result && result.code?.startsWith(EXPORT_DEFAULT)) {
                result.code = result.code.replace(EXPORT_DEFAULT, "module.exports = ");
            }

            return result;
        },
    };
};

export default JSONPlugin;
