import type { Folder, MdxFile, PageMapItem } from "nextra";

import { DEFAULT_PAGE_THEME } from "../constants";
import type { PageTheme } from "../types";

const extendMeta = (
    meta: string | Record<string, any>,
    fallback: Record<string, any>,
): {
    theme: PageTheme;
    [key: string]: any;
} => {
    if (typeof meta === "string") {
        // eslint-disable-next-line no-param-reassign
        meta = { title: meta };
    }

    const theme = { ...fallback.theme, ...meta.theme };

    return { ...fallback, ...meta, theme };
};

interface DocumentationItem extends MdxFile {
    title: string;
    type: string;
    children?: DocumentationItem[];
    firstChildRoute?: string;
    withIndexPage?: boolean;
    isUnderCurrentDocsTree?: boolean;
}

const findFirstRoute = (items: DocumentationItem[]): string | undefined => {
    let foundItem: undefined | string;

    items.forEach((item) => {
        if (typeof foundItem === "string") {
            return;
        }

        if (item.route) {
            foundItem = item.route;
        } else if (item.children) {
            const route = findFirstRoute(item.children);

            if (route) {
                foundItem = route;
            }
        }
    });

    return foundItem;
};

const CUSTOM_ERROR_PAGES = new Set(["/404", "/500"]);

// eslint-disable-next-line radar/cognitive-complexity
export function normalizePages({
    list,
    locale,
    defaultLocale,
    route,
    docsRoot: documentationRoot = "",
    underCurrentDocsRoot: underCurrentDocumentationRoot = false,
    pageThemeContext = DEFAULT_PAGE_THEME,
}: {
    list: PageMapItem[];
    locale: string;
    defaultLocale?: string;
    route: string;
    docsRoot?: string;
    underCurrentDocsRoot?: boolean;
    pageThemeContext?: PageTheme;
}) {
    // eslint-disable-next-line no-underscore-dangle,@typescript-eslint/naming-convention
    let _meta: Record<string, any> | undefined;

    Object.values(list).forEach((item) => {
        if (item.kind === "Meta") {
            if (item.locale === locale) {
                _meta = item.data;
                return;
            }
            // fallback
            if (!_meta) {
                _meta = item.data;
            }
        }
    });

    const meta = _meta || {};
    const metaKeys = Object.keys(meta);

    metaKeys.forEach((key) => {
        if (typeof meta[key] === "string") {
            meta[key] = {
                title: meta[key],
            };
        }
    });

    // All directories
    // - directories: all directories in the tree structure
    // - flatDirectories: all directories in the flat structure, used by search
    const directories: Item[] = [];
    const flatDirectories: Item[] = [];

    // Docs directories
    const documentsDirectories: DocumentationItem[] = [];
    const flatDocumentsDirectories: DocumentationItem[] = [];

    // Page directories
    const topLevelNavbarItems: PageItem[] = [];

    let activeType: string | undefined;
    let activeIndex = 0;
    let activeThemeContext = pageThemeContext;
    let activePath: Item[] = [];

    let metaKeyIndex = -1;

    const fallbackMeta = meta["*"] || {};
    delete fallbackMeta.title;
    delete fallbackMeta.href;

    // Normalize items based on files and _meta.json.
    const items = list
        .filter(
            (a): a is MdxFile | Folder =>
                // not meta
                // eslint-disable-next-line implicit-arrow-linebreak
                a.kind !== "Meta"
                // not hidden routes
                && !a.name.startsWith("_")
                // locale matches, or fallback to default locale
                // @ts-expect-error
                && (a.locale === locale || a.locale === defaultLocale || !a.locale),
        )
        .sort((a, b) => {
            const indexA = metaKeys.indexOf(a.name);
            const indexB = metaKeys.indexOf(b.name);

            if (indexA === -1 && indexB === -1) {
                return a.name < b.name ? -1 : 1;
            }

            if (indexA === -1) {
                return 1;
            }

            if (indexB === -1) {
                return -1;
            }

            return indexA - indexB;
        })
        .flatMap((item) => {
            const itemList = [];
            const index = metaKeys.indexOf(item.name);

            let extendedItem;

            if (index !== -1) {
                // Fill all skipped items in meta.
                // eslint-disable-next-line no-plusplus
                for (let metaKeyIndexPlusOne = metaKeyIndex + 1; metaKeyIndexPlusOne < index; metaKeyIndexPlusOne++) {
                    const key = metaKeys[metaKeyIndexPlusOne];

                    if (key !== "*") {
                        itemList.push({
                            name: key,
                            route: "",
                            ...meta[key as string],
                        });
                    }
                }
                metaKeyIndex = index;
                extendedItem = { ...meta[item.name], ...item };
            }

            itemList.push(extendedItem || item);

            return itemList;
        });

    // Fill all skipped items in meta.
    // eslint-disable-next-line no-plusplus
    for (let index = metaKeyIndex + 1; index < metaKeys.length; index++) {
        const key = metaKeys[index];

        if (key !== "*") {
            items.push({
                name: key,
                route: "#",
                ...meta[key as string],
            });
        }
    }

    // eslint-disable-next-line no-plusplus
    for (let index = 0; index < items.length; index++) {
        const a = items[index];

        // If there are two items with the same name, they must be a directory and a
        // page. In that case we merge them, and use the page's link.
        if (index + 1 < items.length && a.name === items[index + 1].name) {
            items[index + 1] = { ...items[index + 1], withIndexPage: true };

            if (a.children && !items[index + 1].children) {
                items[index + 1].children = a.children;
            }
            // eslint-disable-next-line no-continue
            continue;
        }

        // Get the item's meta information.
        const {
            display, type = "doc", theme: metaTheme, title: metaTitle,
        } = extendMeta(meta[a.name] || {}, fallbackMeta);
        const extendedPageThemeContext = {
            ...pageThemeContext,
            ...metaTheme,
        };

        // If the doc is under the active page root.
        const isCurrentDocumentationTree = route.startsWith(documentationRoot);

        const normalizedChildren: any = a.children
            && normalizePages({
                list: a.children,
                locale,
                defaultLocale,
                route,
                docsRoot: type === "page" || type === "menu" ? a.route : documentationRoot,
                underCurrentDocsRoot: underCurrentDocumentationRoot || isCurrentDocumentationTree,
                pageThemeContext: extendedPageThemeContext,
            });
        const title = metaTitle || (type !== "separator" && a.name);

        // eslint-disable-next-line unicorn/consistent-function-scoping
        const getItem = (): Item => {
            return {
                ...a,
                type,
                ...(title && { title }),
                ...(display && { display }),
                ...(normalizedChildren && { children: [] }),
            };
        };
        const item: Item = getItem();
        const documentationItem: DocumentationItem = getItem();
        const pageItem: PageItem = getItem();

        documentationItem.isUnderCurrentDocsTree = isCurrentDocumentationTree;

        // This item is currently active, we collect the active path etc.
        if (a.route === route) {
            activePath = [item];
            activeType = type;
            // There can be multiple matches.
            activeThemeContext = {
                ...activeThemeContext,
                ...extendedPageThemeContext,
            };

            if (type === "page" || type === "menu") {
                // Active on the navbar
                activeIndex = topLevelNavbarItems.length;
            } else if (type === "doc") {
                // Active in the docs tree
                activeIndex = flatDocumentsDirectories.length;
            }
        }

        if (display === "hidden" || CUSTOM_ERROR_PAGES.has(a.route)) {
            // eslint-disable-next-line no-continue
            continue;
        }

        // If this item has children
        if (normalizedChildren) {
            // If the active item is in its children
            if (normalizedChildren.activeIndex !== undefined && normalizedChildren.activeType !== undefined) {
                activeThemeContext = normalizedChildren.activeThemeContext;
                activeType = normalizedChildren.activeType;
                activePath = [item, ...normalizedChildren.activePath];

                if (activeType === "page" || activeType === "menu") {
                    activeIndex = topLevelNavbarItems.length + normalizedChildren.activeIndex;
                } else if (activeType === "doc") {
                    activeIndex = flatDocumentsDirectories.length + normalizedChildren.activeIndex;
                }

                if (a.withIndexPage && type === "doc") {
                    activeIndex += 1;
                }
            }

            if (type === "page" || type === "menu") {
                pageItem?.children?.push(...normalizedChildren.directories);
                documentsDirectories.push(...normalizedChildren.docsDirectories);

                // If it's a page with children inside, we inject itself as a page too.
                if (normalizedChildren.flatDirectories.length > 0) {
                    pageItem.firstChildRoute = findFirstRoute(normalizedChildren.flatDirectories);
                    topLevelNavbarItems.push(pageItem);
                } else if (pageItem.withIndexPage) {
                    topLevelNavbarItems.push(pageItem);
                }
            } else if (type === "doc") {
                if (Array.isArray(documentationItem.children)) {
                    documentationItem.children.push(...normalizedChildren.docsDirectories);
                }
                // Itself is a doc page.
                if (item.withIndexPage && display !== "children") {
                    flatDocumentsDirectories.push(documentationItem);
                }
            }

            flatDirectories.push(...normalizedChildren.flatDirectories);
            flatDocumentsDirectories.push(...normalizedChildren.flatDocsDirectories);

            if (Array.isArray(item.children)) {
                item.children.push(...normalizedChildren.directories);
            }
        } else {
            flatDirectories.push(item);

            if (type === "page" || type === "menu") {
                topLevelNavbarItems.push(pageItem);
            } else if (type === "doc") {
                flatDocumentsDirectories.push(documentationItem);
            }
        }

        if (type === "doc" && display === "children") {
            // Hide the dectory itself and treat all its children as pages
            if (documentationItem.children) {
                directories.push(...documentationItem.children);
                documentsDirectories.push(...documentationItem.children);
            }
        } else {
            directories.push(item);
        }

        if (type === "page" || type === "menu") {
            documentsDirectories.push(pageItem);
        } else if (type === "doc" && display !== "children") {
            documentsDirectories.push(documentationItem);
        } else if (type === "separator") {
            documentsDirectories.push(item);
        }
    }

    return {
        activeType,
        activeIndex,
        activeThemeContext,
        activePath,
        directories,
        flatDirectories,
        docsDirectories: documentsDirectories,
        flatDocsDirectories: flatDocumentsDirectories,
        topLevelNavbarItems,
    };
}

/**
 * An option to control how an item should be displayed in the sidebar:
 * - `normal`: the default behavior, item will be displayed
 * - `hidden`: the item will not be displayed in the sidebar entirely
 * - `children`: if the item is a folder, itself will be hidden but all its children will still be processed
 */
export type Display = "normal" | "hidden" | "children";

export interface Item extends MdxFile {
    title: string;
    type: string;
    children?: Item[];
    display?: Display;
    withIndexPage?: boolean;
    theme?: PageTheme;
    isUnderCurrentDocsTree?: boolean;
}

export interface PageItem extends MdxFile {
    title: string;
    type: string;
    href?: string;
    newWindow?: boolean;
    children?: PageItem[];
    firstChildRoute?: string;
    display?: Display;
    withIndexPage?: boolean;
    isUnderCurrentDocsTree?: boolean;
}

export interface MenuItem extends MdxFile {
    title: string;
    type: "menu";
    display?: Display;
    children?: PageItem[];
    items?: Record<
    string,
    {
        title: string;
        href?: string;
        newWindow?: boolean;
    }
    >;
}
