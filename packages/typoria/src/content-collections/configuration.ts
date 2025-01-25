import type { Context, Meta } from "@content-collections/core";
import type { Options as MDXOptions } from "@content-collections/mdx";
import { compileMDX as baseCompileMDX } from "@content-collections/mdx";
import type { z as Zod } from "zod";

import type { RehypeCodeOptions, RemarkHeadingOptions, RemarkImageOptions, StructuredData } from "../mdx-plugins";
import { rehypeCode, remarkGfm, remarkHeading, remarkImage, remarkStructure } from "../mdx-plugins";
import type { ResolvePlugins } from "./utils/resolve-plugins";
import { resolvePlugin, resolvePlugins } from "./utils/resolve-plugins";

interface BaseDocument {
    _meta: Meta;
    content: string;
}

/**
 * We need to convert interface types to object types.
 *
 * Otherwise, `T extends Serializable? true : false` gives us `false`.
 * Because interface types cannot extend a union type, but `Serializable` is.
 */
type InterfaceToObject<T> = T extends object
    ? {
          [K in keyof T]: InterfaceToObject<T[K]>;
      }
    : T;

export interface TransformOptions extends Omit<MDXOptions, "rehypePlugins" | "remarkPlugins"> {
    /**
     * Generate `structuredData`
     *
     * @defaultValue true
     */
    generateStructuredData?: boolean;
    rehypeCodeOptions?: RehypeCodeOptions | boolean;

    rehypePlugins?: ResolvePlugins;

    remarkHeadingOptions?: RemarkHeadingOptions | boolean;
    remarkImageOptions?: RemarkImageOptions | boolean;
    remarkPlugins?: ResolvePlugins;
}

/**
 * The default TOC types support `ReactNode`, which isn't serializable
 */
export type SerializableTOC = {
    depth: number;
    title: string;
    url: string;
}[];

export const transformMDX = async <D extends BaseDocument>(
    document: D,
    context: Context,
    options: TransformOptions = {},
): Promise<
    D & {
        body: string;
        toc: SerializableTOC;
        /**
         * `StructuredData` for search indexes
         */
        structuredData: InterfaceToObject<StructuredData>;
    }
> => {
    const { generateStructuredData = true, rehypeCodeOptions, remarkHeadingOptions, remarkImageOptions, ...rest } = options;

    return context.cache(
        {
            document,
            type: "typoria",
        },
        async () => {
            let data: Record<string, unknown> = {};

            const body = await baseCompileMDX(
                {
                    ...context,
                    // avoid nested caching
                    cache: async (input, function_) => function_(input),
                },
                document,
                {
                    cwd: process.cwd(),
                    ...rest,
                    rehypePlugins: resolvePlugins((plugins) => [resolvePlugin(rehypeCode, rehypeCodeOptions ?? true), ...plugins], rest.rehypePlugins),
                    remarkPlugins: resolvePlugins(
                        (plugins) => [
                            remarkGfm,
                            resolvePlugin(remarkHeading, remarkHeadingOptions ?? true),
                            resolvePlugin(remarkImage, remarkImageOptions, {
                                useImport: false,
                            }),
                            ...plugins,
                            generateStructuredData && remarkStructure,
                            () => (_, file) => {
                                data = file.data;
                            },
                        ],
                        rest.remarkPlugins,
                    ),
                },
            );

            return {
                ...document,
                body,
                structuredData: data.structuredData as StructuredData,
                toc: data.toc as SerializableTOC,
            };
        },
    );
}

export const createDocSchema = (z: typeof Zod) => {
    return {
        // OpenAPI generated
        _openapi: z.record(z.any()).optional(),
        description: z.string().optional(),
        full: z.boolean().optional(),
        icon: z.string().optional(),
        title: z.string(),
    };
}

export const createMetaSchema = (z: typeof Zod) => {
    return {
        defaultOpen: z.boolean().optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        pages: z.array(z.string()).optional(),
        root: z.boolean().optional(),
        title: z.string().optional(),
    };
}
