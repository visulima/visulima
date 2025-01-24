import Slugger from "github-slugger";
import type { Heading, Root } from "mdast";
import type { Transformer } from "unified";
import { visit } from "unist-util-visit";

import type { TOCItemType } from "../types";
import flattenNode from "./utils/flatten-node";

const slugger = new Slugger();

declare module "mdast" {
    // eslint-disable-next-line import/no-unused-modules
    export interface HeadingData extends Data {
        hProperties?: {
            id?: string;
        };
    }
}

const regex = /\s*\[#(?<slug>[\s\S]+?)\]\s*$/;

export interface RemarkHeadingOptions {
    /**
     * Allow custom headings ids
     *
     * @defaultValue true
     */
    customId?: boolean;

    /**
     * Attach an array of `TOCItemType` to `file.data.toc`
     *
     * @defaultValue true
     */
    generateToc?: boolean;

    slug?: (root: Root, heading: Heading, text: string) => string;
}

/**
 * Add heading ids and extract TOC
 */
// eslint-disable-next-line func-style
export function remarkHeading({ customId = true, generateToc = true, slug: defaultSlug }: RemarkHeadingOptions = {}): Transformer<Root, Root> {
    return (root, file): void => {
        const toc: TOCItemType[] = [];

        slugger.reset();

        // Fumadocs OpenAPI Generated TOC
        if (file.data.frontmatter) {
            const frontmatter = file.data.frontmatter as {
                _openapi?: {
                    toc?: TOCItemType[];
                };
            };

            if (frontmatter._openapi?.toc) {
                toc.push(...frontmatter._openapi.toc);
            }
        }

        visit(root, "heading", (heading) => {
            heading.data ||= {};
            heading.data.hProperties ||= {};
            const lastNode = heading.children.at(-1);

            if (!heading.data.hProperties.id && lastNode?.type === "text" && customId) {
                const match = regex.exec(lastNode.value);

                if (match?.[1]) {
                    heading.data.hProperties.id = match[1];
                    lastNode.value = lastNode.value.slice(0, match.index);
                }
            }

            const value = flattenNode(heading);

            let { id } = heading.data.hProperties;
            if (!id) {
                id = defaultSlug ? defaultSlug(root, heading, value) : slugger.slug(value);
            }

            heading.data.hProperties.id = id;

            if (generateToc) {
                toc.push({
                    depth: heading.depth,
                    title: value,
                    url: `#${id}`,
                });
            }

            return "skip";
        });

        if (generateToc) {
            file.data.toc = toc;
        }
    };
}
