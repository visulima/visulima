import type { PackageJson } from "@visulima/package";
import MagicString from "magic-string";
import { findStaticImports } from "mlly";
import type { Plugin } from "rollup";
import { minVersion } from "semver";

const CJSyntaxRe = /__filename|__dirname|require\(|require\.resolve\(/;

const CJSShim = `
// -- pack CommonJS Shims --
import __cjs_url__ from "node:url";
import __cjs_path__ from "node:path";
import __cjs_mod__ from "node:module";
const __filename = __cjs_url__.fileURLToPath(import.meta.url);
const __dirname = __cjs_path__.dirname(__filename);
const require = __cjs_mod__.createRequire(import.meta.url);
`;

// eslint-disable-next-line @typescript-eslint/naming-convention
const CJSShimNode20_11 = `
// -- pack CommonJS Shims Node 20.11 --
import __cjs_mod__ from "node:module";
const __filename = import.meta.filename;
const __dirname = import.meta.dirname;
const require = __cjs_mod__.createRequire(import.meta.url);
`;

// Shim __dirname, __filename and require
const CJSToESM = (code: string, shim: string) => {
    if (code.includes(CJSShim) || code.includes(CJSShimNode20_11) || !CJSyntaxRe.test(code)) {
        return null;
    }

    const lastESMImport = findStaticImports(code).pop();
    const indexToAppend = lastESMImport ? lastESMImport.end : 0;
    const s = new MagicString(code);

    s.appendRight(indexToAppend, shim);

    return {
        code: s.toString(),
        map: s.generateMap(),
    };
}

const cjsPlugin = (packageJson: PackageJson): Plugin =>
    ({
        name: "packem:cjs",
        renderChunk(code, _chunk, options) {
            if (options.format === "es") {
                let shim = CJSShim;

                if (packageJson?.engines?.node) {
                    const minNodeVersion = minVersion(packageJson.engines.node);

                    if (minNodeVersion && minNodeVersion.major >= 20 && minNodeVersion.minor >= 11) {
                        shim = CJSShimNode20_11;
                    }
                }

                return CJSToESM(code, shim);
            }

            return null;
        },
    }) as Plugin;

export default cjsPlugin;
