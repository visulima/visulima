import Slugger from "github-slugger";
import type { Root } from "mdast";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import type { PluggableList, Transformer } from "unified";
import type { Test } from "unist-util-visit";
import { visit } from "unist-util-visit";

import flattenNode from "./utils/flatten-node";

interface Heading {
    content: string;
    id: string;
}

interface Content {
    content: string;
    heading: string | undefined;
}

const slugger = new Slugger();

export interface StructuredData {
    /**
     * Refer to paragraphs, a heading may contain multiple contents as well
     */
    contents: Content[];
    headings: Heading[];
}

export interface StructureOptions {
    /**
     * Types to be scanned.
     *
     * @defaultValue ['paragraph', 'blockquote', 'heading', 'tableCell']
     */
    types?: Test;
}

/**
 * Attach structured data to VFile, you can access via `vfile.data.structuredData`.
 */
// eslint-disable-next-line func-style
export function remarkStructure({ types = ["paragraph", "blockquote", "heading", "tableCell"] }: StructureOptions = {}): Transformer<Root, Root> {
    return (node, file) => {
        slugger.reset();

        const data: StructuredData = { contents: [], headings: [] };

        let lastHeading: string | undefined = "";

        // Fumadocs OpenAPI Generated Structured Data
        if (file.data.frontmatter) {
            const frontmatter = file.data.frontmatter as {
                _openapi?: {
                    structuredData?: StructuredData;
                };
            };

            if (frontmatter._openapi?.structuredData) {
                data.headings.push(...frontmatter._openapi.structuredData.headings);
                data.contents.push(...frontmatter._openapi.structuredData.contents);
            }
        }

        visit(node, types, (element): "skip" | undefined => {
            if (element.type === "root") {
                return undefined;
            }

            const content = flattenNode(element).trim();

            if (element.type === "heading") {
                element.data ||= {};
                element.data.hProperties ||= {};

                const properties = element.data.hProperties;
                const id = properties.id ?? slugger.slug(content);

                data.headings.push({
                    content,
                    id,
                });

                lastHeading = id;

                return "skip";
            }

            if (content.length > 0) {
                data.contents.push({
                    content,
                    heading: lastHeading,
                });

                return "skip";
            }

            return undefined;
        });

        file.data.structuredData = data;
    };
}

/**
 * Extract data from markdown/mdx content
 */
export const structure = (content: string, remarkPlugins: PluggableList = [], options: StructureOptions = {}): StructuredData => {
    const result = remark().use(remarkGfm).use(remarkPlugins).use(remarkStructure, options).processSync(content);

    return result.data.structuredData as StructuredData;
};
