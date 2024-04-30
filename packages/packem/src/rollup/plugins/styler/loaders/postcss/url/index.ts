import path from "node:path";

import type { Declaration, PluginCreator } from "postcss";
import type { Node, ParsedValue } from "postcss-value-parser";
import valueParser from "postcss-value-parser";

import { isAbsolutePath,normalizePath } from "../../../utils/path";
import { mm } from "../../../utils/sourcemap";
import { dataURIRe,firstExtRe as firstExtensionRe } from "../common";
import generateName from "./generate";
import inlineFile from "./inline";
import type { UrlFile,UrlResolve } from "./resolve";
import resolveDefault from "./resolve";
import { isDeclWithUrl,walkUrls } from "./utils";

const name = "styles-url";
const placeholderHashDefault = "assets/[name]-[hash][extname]";
const placeholderNoHashDefault = "assets/[name][extname]";

/** URL handler options */
export interface UrlOptions {
    /**
     * Aliases for URL paths.
     * Overrides the global `alias` option.
     * - ex.: `{"foo":"bar"}`
     */
    alias?: Record<string, string>;
    /**
     * Directory path for outputted CSS assets,
     * which is not included into resulting URL
     * @default "."
     */
    assetDir?: string;
    /**
     * Enable/disable name generation with hash for outputted CSS assets
     * or provide your own placeholder with the following blocks:
     * - `[extname]`: The file extension of the asset including a leading dot, e.g. `.png`.
     * - `[ext]`: The file extension without a leading dot, e.g. `png`.
     * - `[hash(:<num>)]`: A hash based on the name and content of the asset (with optional length).
     * - `[name]`: The file name of the asset excluding any extension.
     *
     * Forward slashes / can be used to place files in sub-directories.
     * @default "assets/[name]-[hash][extname]" ("assets/[name][extname]" if false)
     */
    hash?: boolean | string;
    /**
     * Inline files instead of copying
     * @default true for `inject` mode, otherwise false
     */
    inline?: boolean;
    /**
     * Public Path for URLs in CSS files
     * @default "./"
     */
    publicPath?: string;
    /**
     * Provide custom resolver for URLs
     * in place of the default one
     */
    resolve?: UrlResolve;
}

const plugin: PluginCreator<UrlOptions> = (options = {}) => {
    const inline = options.inline ?? false;
    const publicPath = options.publicPath ?? "./";
    const assetDir = options.assetDir ?? ".";
    const resolve = options.resolve ?? resolveDefault;
    const alias = options.alias ?? {};
    const placeholder = options.hash ?? true ? (typeof options.hash === "string" ? options.hash : placeholderHashDefault) : placeholderNoHashDefault;

    return {

        async Once(css, { result: res }) {
            if (!css.source?.input.file) {
                return;
            }

            const { file } = css.source.input;
            const map = mm(css.source.input.map?.text).resolve(path.dirname(file)).toConsumer();

            const urlList: {
                basedirs: Set<string>;
                decl: Declaration;
                node: Node;
                parsed: ParsedValue;
                url: string;
            }[] = [];

            const imported = new Set(res.messages.filter((message) => message.type === "dependency").map((message) => message.file as string));

            css.walkDecls((decl) => {
                if (!isDeclWithUrl(decl)) {
                    return;
                }

                const parsed = valueParser(decl.value);
                walkUrls(parsed, (url, node) => {
                    // Resolve aliases
                    for (const [from, to] of Object.entries(alias)) {
                        if (url !== from && !url.startsWith(`${from}/`)) {
                            continue;
                        }

                        url = normalizePath(to) + url.slice(from.length);
                    }

                    // Empty URL
                    if (!node || url.length === 0) {
                        decl.warn(res, `Empty URL in \`${decl.toString()}\``);
                        return;
                    }

                    // Skip Data URI
                    if (dataURIRe.test(url)) {
                        return;
                    }

                    // Skip Web URLs
                    if (!isAbsolutePath(url)) {
                        try {
                            new URL(url);
                            return;
                        } catch {
                            // Is not a Web URL, continuing
                        }
                    }

                    const basedirs = new Set<string>();

                    // Use PostCSS imports
                    if (decl.source?.input.file && imported.has(decl.source.input.file)) {
                        basedirs.add(path.dirname(decl.source.input.file));
                    }

                    // Use SourceMap
                    if (decl.source?.start) {
                        const pos = decl.source.start;
                        const realPos = map?.originalPositionFor(pos);
                        const basedir = realPos?.source && path.dirname(realPos.source);

                        if (basedir) {
                            basedirs.add(path.normalize(basedir));
                        }
                    }

                    // Use current file
                    basedirs.add(path.dirname(file));

                    urlList.push({ basedirs, decl, node, parsed, url });
                });
            });

            const usedNames = new Map<string, string>();

            for await (const { basedirs, decl, node, parsed, url } of urlList) {
                let resolved: UrlFile | undefined;
                for await (const basedir of basedirs) {
                    try {
                        if (!resolved) {
                            resolved = await resolve(url, basedir);
                        }
                    } catch {
                        /* noop */
                    }
                }

                if (!resolved) {
                    decl.warn(res, `Unresolved URL \`${url}\` in \`${decl.toString()}\``);
                    continue;
                }

                const { from, source, urlQuery } = resolved;

                if (!(source instanceof Uint8Array) || typeof from !== "string") {
                    decl.warn(res, `Incorrectly resolved URL \`${url}\` in \`${decl.toString()}\``);
                    continue;
                }

                res.messages.push({ file: from, plugin: name, type: "dependency" });

                if (inline) {
                    node.type = "string";
                    node.value = inlineFile(from, source);
                } else {
                    const unsafeTo = normalizePath(generateName(placeholder, from, source));
                    let to = unsafeTo;

                    // Avoid file overrides
                    const hasExtension = firstExtensionRe.test(unsafeTo);
                    for (let index = 1; usedNames.has(to) && usedNames.get(to) !== from; index++) {
                        to = hasExtension ? unsafeTo.replace(firstExtensionRe, `${index}$1`) : `${unsafeTo}${index}`;
                    }

                    usedNames.set(to, from);

                    node.type = "string";
                    node.value = publicPath + (/[/\\]$/.test(publicPath) ? "" : "/") + path.basename(to);

                    if (urlQuery) {
                        node.value += urlQuery;
                    }

                    to = normalizePath(assetDir, to);
                    res.messages.push({ plugin: name, source, to, type: "asset" });
                }

                decl.value = parsed.toString();
            }
        },
        postcssPlugin: name,
    };
};

plugin.postcss = true;

export default plugin;
