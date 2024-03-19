import type { RollupJsonOptions } from "@rollup/plugin-json";
import rollupJSONPlugin from "@rollup/plugin-json";
import type { Plugin } from "rollup";

const EXPORT_DEFAULT = "export default ";

export function JSONPlugin(options: RollupJsonOptions): Plugin {
    const plugin = rollupJSONPlugin(options);
    return <Plugin>{
        ...plugin,
        name: "pack-json",
        transform(code, id) {
            const res = plugin.transform!.call(this, code, id);

            if (res && typeof res !== "string" && "code" in res && res.code?.startsWith(EXPORT_DEFAULT)) {
                res.code = res.code.replace(EXPORT_DEFAULT, "module.exports = ");
            }

            return res;
        },
    };
}
