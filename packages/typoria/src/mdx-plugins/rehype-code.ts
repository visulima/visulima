import type { RehypeShikiOptions } from "@shikijs/rehype";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import { transformerNotationDiff, transformerNotationHighlight, transformerNotationWordHighlight } from "@shikijs/transformers";
import type { Root } from "hast";
import type { MdxJsxFlowElement } from "mdast-util-mdx-jsx";
import type { BuiltinTheme, ShikiTransformer } from "shiki";
import { bundledLanguages, getSingletonHighlighter } from "shiki";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { createOnigurumaEngine } from "shiki/engine/oniguruma";
import type { Processor, Transformer } from "unified";

import type { IconOptions } from "./utils/transformer-icon";
import { transformerIcon } from "./utils/transformer-icon";

interface MetaValue {
    name: string;
    regex: RegExp;
}

/**
 * Custom meta string values
 */
const metaValues: MetaValue[] = [
    {
        name: "title",
        regex: /title="(?<value>[^"]*)"/,
    },
    {
        name: "custom",
        regex: /custom="(?<value>[^"]+)"/,
    },
    {
        name: "tab",
        regex: /tab="(?<value>[^"]+)"/,
    },
    {
        name: "tab",
        regex: /tab/,
    },
];

export const createStyleTransformer = (): ShikiTransformer => {
    return {
        line(hast) {
            if (hast.children.length === 0) {
                // Keep the empty lines when using grid layout
                hast.children.push({
                    type: "text",
                    value: " ",
                });
            }
        },
        name: "rehype-code:styles",
    };
};

export const defaultThemes = {
    dark: "github-dark",
    light: "github-light",
};

export const rehypeCodeDefaultOptions: RehypeCodeOptions = {
    defaultColor: false,
    defaultLanguage: "plaintext",
    experimentalJSEngine: false,
    parseMetaString(meta) {
        const map: Record<string, string> = {};

        for (const value of metaValues) {
            meta = meta.replace(value.regex, (_, ...arguments_) => {
                const first = arguments_.at(0);
                map[value.name] = typeof first === "string" ? first : "";

                return "";
            });
        }

        map.__parsed_raw = meta;
        return map;
    },
    themes: defaultThemes,
    transformers: [
        createStyleTransformer(),
        transformerNotationHighlight({
            matchAlgorithm: "v3",
        }),
        transformerNotationWordHighlight({
            matchAlgorithm: "v3",
        }),
        transformerNotationDiff({
            matchAlgorithm: "v3",
        }),
    ],
};

export type RehypeCodeOptions = {
    /**
     * Filter meta string before processing
     */
    filterMetaString?: (metaString: string) => string;

    /**
     * Add icon to code blocks
     */
    icon?: IconOptions | false;

    /**
     * Wrap code blocks in `<Tab>` component when "tab" meta string presents
     *
     * @defaultValue true
     */
    tab?: false;

    /**
     * Enable Shiki's experimental JS engine
     *
     * @defaultValue false
     */
    experimentalJSEngine?: boolean;
} & RehypeShikiOptions;

export const transformerTab = (): ShikiTransformer => {
    return {
        name: "rehype-code:tab",
        // @ts-expect-error -- types not compatible with MDX
        root(root) {
            const value = this.options.meta?.tab;
            if (typeof value !== "string")
return root;

            return {
                children: [
                    {
                        attributes: value === "" ? [] : [{ name: "value", type: "mdxJsxAttribute", value }],
                        children: root.children,
                        data: {
                            _codeblock: true,
                        },
                        name: "Tab",
                        type: "mdxJsxFlowElement",
                    } as MdxJsxFlowElement,
                ],
                type: "root",
            };
        },
    };
}

/**
 * Handle codeblocks
 */
// eslint-disable-next-line func-style
export function rehypeCode(this: Processor, _options: Partial<RehypeCodeOptions> = {}): Transformer<Root, Root> {
    const options: RehypeCodeOptions = {
        ...rehypeCodeDefaultOptions,
        ..._options,
    };

    const transformers = [...(options.transformers ?? [])];
    transformers.unshift({
        name: "rehype-code:pre-process",
        preprocess(code, { meta }) {
            if (meta && "__parsed_raw" in meta) {
                meta.__raw = meta.__parsed_raw;
                delete meta.__parsed_raw;
            }

            if (meta && options.filterMetaString) {
                meta.__raw = options.filterMetaString(meta.__raw ?? "");
            }

            // Remove empty line at end
            return code.replace(/\n$/, "");
        },
    });

    if (options.icon !== false) {
        transformers.push(transformerIcon(options.icon));
    }

    if (options.tab !== false) {
        transformers.push(transformerTab());
    }

    const highlighter = getSingletonHighlighter({
        engine: options.experimentalJSEngine ? createJavaScriptRegexEngine() : createOnigurumaEngine(async () => await import("shiki/wasm")),
        langs: options.langs ?? (options.lazy ? undefined : Object.keys(bundledLanguages)),
        themes: "themes" in options ? (Object.values(options.themes).filter(Boolean) as BuiltinTheme[]) : [options.theme],
    });

    const transformer = highlighter.then((instance) =>
        rehypeShikiFromHighlighter(instance, {
            ...options,
            transformers,
        }),
    );

    return async (tree, file) => {
        await (
            await transformer
        )(tree, file, () => {
            // nothing
        });
    };
}

export { type CodeBlockIcon, transformerIcon } from "./utils/transformer-icon";
