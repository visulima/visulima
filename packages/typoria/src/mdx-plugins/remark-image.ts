import { isAbsolute, join, relative, toNamespacedPath } from "@visulima/path";
import sizeOf from "image-size";
import type { ISizeCalculationResult } from "image-size/dist/types/interface";
import type { MdxjsEsm } from "mdast-util-mdxjs-esm";
import { visit } from "unist-util-visit";

import resolvePath from "../utils/resolve-path";

const VALID_BLUR_EXT = [".jpeg", ".png", ".webp", ".avif", ".jpg"];
const EXTERNAL_URL_REGEX = /^https?:\/\//;

const getImageSize = async (source: string, directory: string): Promise<ISizeCalculationResult> => {
    const isRelative = source.startsWith("/") || !isAbsolute(source);
    let url: string;

    if (EXTERNAL_URL_REGEX.test(source)) {
        url = source;
    } else if (EXTERNAL_URL_REGEX.test(directory) && isRelative) {
        const base = new URL(directory);

        base.pathname = resolvePath(base.pathname, source);
        url = base.toString();
    } else {
        return sizeOf(isRelative ? join(directory, source) : source);
    }

    // eslint-disable-next-line compat/compat
    const buffer = await fetch(url).then(async (response) => await response.arrayBuffer());

    return sizeOf(new Uint8Array(buffer));
};

export interface RemarkImageOptions {
    /**
     * Fetch image size of external URLs
     *
     * @defaultValue true
     */
    external?: boolean;

    /**
     * Preferred placeholder type
     *
     * @defaultValue 'blur'
     */
    placeholder?: "blur" | "none";

    /**
     * Directory or base URL to resolve absolute image paths
     */
    publicDir?: string;

    /**
     * Import images in the file, and let bundlers handle it.
     *
     * ```tsx
     * import MyImage from "./public/img.png";
     *
     * <img src={MyImage} />
     * ```
     *
     * When disabled, `placeholder` will be ignored.
     *
     * @defaultValue true
     */
    useImport?: boolean;
}

export const remarkImage =
    ({ external = true, placeholder = "blur", publicDir: publicDirectory = join(process.cwd(), "public"), useImport = true }: RemarkImageOptions = {}): ((
        tree: any,
        file: any,
    ) => Promise<void>) =>
    // eslint-disable-next-line sonarjs/cognitive-complexity
    async (tree, file): Promise<void> => {
        const importsToInject: { importPath: string; variableName: string }[] = [];
        const promises: Promise<void>[] = [];

        const getImportPath = (source: string): string => {
            if (!source.startsWith("/")) {
                return source;
            }

            const to = join(publicDirectory, source);

            if (file.dirname) {
                const relativePath = relative(file.dirname, to);

                const isExtendedLengthPath = relativePath.startsWith("\\\\?\\");

                if (isExtendedLengthPath) {
                    return relativePath;
                }

                const normalizedRelativePath = toNamespacedPath(relativePath);

                // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
                return normalizedRelativePath.startsWith("./") ? normalizedRelativePath : `./${normalizedRelativePath}`;
            }

            const isExtendedLengthPath = to.startsWith("\\\\?\\");

            if (isExtendedLengthPath) {
                return to;
            }

            return toNamespacedPath(to);
        };

        visit(tree, "image", (node) => {
            const url = decodeURI(node.url);

            if (!url) {
                return;
            }

            const isExternal = EXTERNAL_URL_REGEX.test(url);

            if ((isExternal && external) || !useImport) {
                const task = getImageSize(url, publicDirectory)
                    .then((size) => {
                        if (!size.width || !size.height) {
                            return;
                        }

                        Object.assign(node, {
                            attributes: [
                                {
                                    name: "alt",
                                    type: "mdxJsxAttribute",
                                    // eslint-disable-next-line promise/always-return
                                    value: node.alt ?? "image",
                                },
                                {
                                    name: "src",
                                    type: "mdxJsxAttribute",
                                    value: url,
                                },
                                {
                                    name: "width",
                                    type: "mdxJsxAttribute",
                                    value: size.width.toString(),
                                },
                                {
                                    name: "height",
                                    type: "mdxJsxAttribute",
                                    value: size.height.toString(),
                                },
                            ],
                            name: "img",
                            type: "mdxJsxFlowElement",
                        });
                    })
                    .catch(() => {
                        console.error(`[Remark Image] Failed obtain image size for ${url} with public directory ${publicDirectory}`);
                    });

                promises.push(task);
            } else if (!isExternal) {
                // Unique variable name for the given static image URL
                const variableName = `__img${importsToInject.length.toString()}`;
                const hasBlur = placeholder === "blur" && VALID_BLUR_EXT.some((extension) => url.endsWith(extension));

                importsToInject.push({
                    importPath: getImportPath(url),
                    variableName,
                });

                Object.assign(node, {
                    attributes: [
                        {
                            name: "alt",
                            type: "mdxJsxAttribute",
                            value: node.alt ?? "image",
                        },
                        hasBlur && {
                            name: "placeholder",
                            type: "mdxJsxAttribute",
                            value: "blur",
                        },
                        {
                            name: "src",
                            type: "mdxJsxAttribute",
                            value: {
                                data: {
                                    estree: {
                                        body: [
                                            {
                                                expression: { name: variableName, type: "Identifier" },
                                                type: "ExpressionStatement",
                                            },
                                        ],
                                    },
                                },
                                // eslint-disable-next-line no-secrets/no-secrets
                                type: "mdxJsxAttributeValueExpression",
                                value: variableName,
                            },
                        },
                    ].filter(Boolean),
                    name: "img",
                    type: "mdxJsxFlowElement",
                });
            }
        });

        // eslint-disable-next-line compat/compat
        await Promise.all(promises);

        if (importsToInject.length > 0) {
            const imports = importsToInject.map(
                ({ importPath, variableName }) =>
                    ({
                        data: {
                            estree: {
                                body: [
                                    {
                                        source: { type: "Literal", value: importPath },
                                        specifiers: [
                                            {
                                                local: { name: variableName, type: "Identifier" },
                                                type: "ImportDefaultSpecifier",
                                            },
                                        ],
                                        type: "ImportDeclaration",
                                    },
                                ],
                            },
                        },
                        type: "mdxjsEsm",
                    }) as MdxjsEsm,
            );

            tree.children.unshift(...imports);
        }
    };
