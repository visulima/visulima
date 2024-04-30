import path from "node:path";
import { fileURLToPath } from "node:url";

import { makeLegalIdentifier } from "@rollup/pluginutils";
import cssnano from "cssnano";
import fs from "fs-extra";
import type { AcceptedPlugin, ProcessOptions } from "postcss";
import postcss from "postcss";
import type { RawSourceMap } from "source-map-js";

import type { InjectOptions, PostCSSLoaderOptions } from "../../types";
import { humanlizePath, normalizePath } from "../../utils/path";
import { resolveAsync } from "../../utils/resolve";
import safeId from "../../utils/safe-id";
import { mm } from "../../utils/sourcemap";
import type { Loader } from "../types";
import loadConfig from "./config";
import postcssICSS from "./icss";
import postcssImport from "./import";
import postcssModules from "./modules";
import postcssNoop from "./noop";
import postcssUrl from "./url";

const baseDir = path.dirname(fileURLToPath(import.meta.url));

let injectorId: string;
const testing = process.env.NODE_ENV === "test";

const cssVariableName = "css";
const reservedWords = new Set([cssVariableName]);

function getClassNameDefault(name: string): string {
    const id = makeLegalIdentifier(name);

    if (reservedWords.has(id)) {
        return `_${id}`;
    }

    return id;
}

function ensureAutoModules(am: PostCSSLoaderOptions["autoModules"], id: string): boolean {
    if (typeof am === "function") {
        return am(id);
    }

    if (am instanceof RegExp) {
        return am.test(id);
    }

    return am && /\.module\.[A-Za-z]+$/.test(id);
}

type PostCSSOptions = Pick<Required<ProcessOptions>, "from" | "map" | "to"> & PostCSSLoaderOptions["postcss"];

const loader: Loader<PostCSSLoaderOptions> = {
    alwaysProcess: true,
    name: "postcss",
    async process({ code, extracted, map }) {
        const options = { ...this.options };
        const config = await loadConfig(this.id, options.config);
        const plugins: AcceptedPlugin[] = [];
        const autoModules = ensureAutoModules(options.autoModules, this.id);
        const supportModules = Boolean(options.modules || autoModules);
        const modulesExports: Record<string, string> = {};

        const postcssOptions: PostCSSOptions = {
            ...config.options,
            ...options.postcss,
            from: this.id,
            map: {
                annotation: false,
                inline: false,
                prev: mm(map).relative(path.dirname(this.id)).toObject(),
                sourcesContent: this.sourceMap ? this.sourceMap.content : true,
            },
            to: options.to ?? this.id,
        };

        delete postcssOptions.plugins;

        if (options.import) {
            plugins.push(postcssImport({ extensions: options.extensions, ...options.import }));
        }

        if (options.url) {
            plugins.push(postcssUrl({ inline: Boolean(options.inject), ...options.url }));
        }

        if (options.postcss.plugins) {
            plugins.push(...options.postcss.plugins);
        }

        if (config.plugins) {
            plugins.push(...config.plugins);
        }

        if (supportModules) {
            const modulesOptions = typeof options.modules === "object" ? options.modules : {};

            plugins.push(
                ...postcssModules({
                    failOnWrongOrder: true,
                    generateScopedName: testing ? "[name]_[local]" : undefined,
                    ...modulesOptions,
                }),
                postcssICSS({ extensions: options.extensions }),
            );
        }

        if (options.minimize) {
            const cssnanoOptions = typeof options.minimize === "object" ? options.minimize : {};

            plugins.push(cssnano(cssnanoOptions));
        }

        // Avoid PostCSS warning
        if (plugins.length === 0) {
            plugins.push(postcssNoop);
        }

        const res = await postcss(plugins).process(code, postcssOptions);

        for (const message of res.messages)
            switch (message.type) {
                case "warning": {
                    this.warn({ message: message.text as string, plugin: message.plugin });
                    break;
                }

                case "icss": {
                    Object.assign(modulesExports, message.export as Record<string, string>);
                    break;
                }

                case "dependency": {
                    this.deps.add(normalizePath(message.file as string));
                    break;
                }

                case "asset": {
                    this.assets.set(message.to as string, message.source as Uint8Array);
                    break;
                }
            }

        map = mm(res.map?.toJSON()).resolve(path.dirname(postcssOptions.to)).toString();

        if (!options.extract && this.sourceMap) {
            const m = mm(map)
                .modify((map) => void delete (map as Partial<RawSourceMap>).file)
                .relative();

            if (this.sourceMap.transform) {
                m.modify(this.sourceMap.transform);
            }

            map = m.toString();
            res.css += m.toCommentData();
        }

        if (options.emit) {
            return { code: res.css, map };
        }

        const saferId = (id: string): string => safeId(id, path.basename(this.id));
        const modulesVariableName = saferId("modules");

        const output = [`export var ${cssVariableName} = ${JSON.stringify(res.css)};`];
        const dts = [`export var ${cssVariableName}: string;`];

        if (options.namedExports) {
            const getClassName = typeof options.namedExports === "function" ? options.namedExports : getClassNameDefault;

            for (const name in modulesExports) {
                const newName = getClassName(name);

                if (name !== newName) {
                    this.warn(`Exported \`${name}\` as \`${newName}\` in ${humanlizePath(this.id)}`);
                }

                const fmt = JSON.stringify(modulesExports[name]);

                output.push(`export var ${newName} = ${fmt};`);

                if (options.dts) {
                    dts.push(`export var ${newName}: ${fmt};`);
                }
            }
        }

        if (options.extract) {
            extracted = { css: res.css, id: this.id, map };
        }

        if (options.inject) {
            if (typeof options.inject === "function") {
                output.push(options.inject(cssVariableName, this.id), `var ${modulesVariableName} = ${JSON.stringify(modulesExports)};`);
            } else {
                const { treeshakeable, ...injectorOptions } = typeof options.inject === "object" ? options.inject : ({} as InjectOptions);

                const injectorName = saferId("injector");
                const injectorCall = `${injectorName}(${cssVariableName},${JSON.stringify(injectorOptions)});`;

                if (!injectorId) {
                    const options_ = { basedirs: [path.join(testing ? process.cwd() : baseDir, "runtime")] };

                    injectorId = await resolveAsync(["./inject-css"], options_);
                    injectorId = `"${normalizePath(injectorId)}"`;
                }

                output.unshift(`import ${injectorName} from ${injectorId};`);

                if (!treeshakeable) {
                    output.push(`var ${modulesVariableName} = ${JSON.stringify(modulesExports)};`, injectorCall);
                }

                if (treeshakeable) {
                    output.push("var injected = false;");

                    const injectorCallOnce = `if (!injected) { injected = true; ${injectorCall} }`;

                    if (modulesExports.inject) {
                        throw new Error("`inject` keyword is reserved when using `inject.treeshakeable` option");
                    }

                    let getters = "";

                    for (const [k, v] of Object.entries(modulesExports)) {
                        const name = JSON.stringify(k);
                        const value = JSON.stringify(v);
                        getters += `get ${name}() { ${injectorCallOnce} return ${value}; },\n`;
                    }

                    getters += `inject: function inject() { ${injectorCallOnce} },`;

                    output.push(`var ${modulesVariableName} = {${getters}};`);
                }
            }
        }

        if (!options.inject) {
            output.push(`var ${modulesVariableName} = ${JSON.stringify(modulesExports)};`);
        }

        const defaultExport = `export default ${supportModules ? modulesVariableName : cssVariableName};`;

        output.push(defaultExport);

        if (options.dts && (await fs.pathExists(this.id))) {
            if (supportModules)
                dts.push(
                    `interface ModulesExports ${JSON.stringify(modulesExports)}`,

                    typeof options.inject === "object" && options.inject.treeshakeable ? `interface ModulesExports {inject:()=>void}` : "",

                    `declare const ${modulesVariableName}: ModulesExports;`,
                );

            dts.push(defaultExport);

            await fs.writeFile(`${this.id}.d.ts`, dts.filter(Boolean).join("\n"));
        }

        return { code: output.filter(Boolean).join("\n"), extracted, map };
    },
};

export default loader;
