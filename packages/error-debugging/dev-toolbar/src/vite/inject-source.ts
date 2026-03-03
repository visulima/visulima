import { normalizePath } from "vite";
import generate from "@babel/generator";
import { parse } from "@babel/parser";
import _traverse from "@babel/traverse";
import * as t from "@babel/types";

import type { NodePath } from "@babel/traverse";

import { matcher } from "./matcher";

// CJS/ESM interop — @babel/traverse and @babel/generator ship CJS with a .default wrapper
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const trav: typeof _traverse = (_traverse as any).default ?? _traverse;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const gen: typeof generate = (generate as any).default ?? generate;

/** The attribute name injected into each JSX opening element. */
export const SOURCE_ATTR = "data-vdt-source";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getPropsNameFromFunctionDeclaration = (
    functionDeclaration:
        | t.ArrowFunctionExpression
        | t.FunctionDeclaration
        | t.FunctionExpression
        | t.VariableDeclarator,
): null | string => {
    let propsName: null | string = null;

    const extractFromParams = (params: (t.Identifier | t.Pattern | t.RestElement | t.TSParameterProperty)[]): void => {
        const first = params[0];

        if (!first) {
            return;
        }

        // handles (props) => {}
        if (first.type === "Identifier") {
            propsName = first.name;
        }

        // handles ({ ...props }) => {}
        if (first.type === "ObjectPattern") {
            first.properties.forEach((prop) => {
                if (prop.type === "RestElement" && prop.argument.type === "Identifier") {
                    propsName = prop.argument.name;
                }
            });
        }
    };

    if (
        functionDeclaration.type === "FunctionExpression" ||
        functionDeclaration.type === "ArrowFunctionExpression" ||
        functionDeclaration.type === "FunctionDeclaration"
    ) {
        extractFromParams(functionDeclaration.params);

        return propsName;
    }

    // VariableDeclarator — init may be an arrow or function expression
    if (
        functionDeclaration.type === "VariableDeclarator" &&
        (functionDeclaration.init?.type === "ArrowFunctionExpression" || functionDeclaration.init?.type === "FunctionExpression")
    ) {
        extractFromParams(functionDeclaration.init.params);
    }

    return propsName;
};

const getNameOfElement = (element: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName): string => {
    if (element.type === "JSXIdentifier") {
        return element.name;
    }

    if (element.type === "JSXMemberExpression") {
        return `${getNameOfElement(element.object)}.${getNameOfElement(element.property)}`;
    }

    return `${element.namespace.name}:${element.name.name}`;
};

const transformJSX = (
    element: NodePath<t.JSXOpeningElement>,
    propsName: null | string,
    file: string,
    ignoreComponents: Array<RegExp | string>,
): boolean | undefined => {
    const { loc } = element.node;

    if (!loc) {
        return;
    }

    const { column, line } = loc.start;
    const nameOfElement = getNameOfElement(element.node.name);

    // Skip fragments and structural HTML elements that are typically SSR-rendered root layout
    // nodes — injecting source attributes onto <html>, <head>, or <body> causes React
    // hydration mismatches because SSR and client compilation pipelines produce different
    // line numbers for the same source file.
    if (
        nameOfElement === "Fragment" ||
        nameOfElement === "React.Fragment" ||
        nameOfElement === "html" ||
        nameOfElement === "head" ||
        nameOfElement === "body" ||
        matcher(ignoreComponents, nameOfElement)
    ) {
        return;
    }

    // Skip if already annotated
    const hasSourceAttr = element.node.attributes.some(
        (attr: t.JSXAttribute | t.JSXSpreadAttribute) =>
            attr.type === "JSXAttribute" && attr.name.type === "JSXIdentifier" && attr.name.name === SOURCE_ATTR,
    );

    // Skip if component props are spread onto this element (would break prop forwarding)
    const hasSpread = element.node.attributes.some(
        (attr: t.JSXAttribute | t.JSXSpreadAttribute) =>
            attr.type === "JSXSpreadAttribute" && attr.argument.type === "Identifier" && attr.argument.name === propsName,
    );

    if (hasSpread || hasSourceAttr) {
        return;
    }

    element.node.attributes.push(t.jsxAttribute(t.jsxIdentifier(SOURCE_ATTR), t.stringLiteral(`${file}:${line}:${column + 1}`)));
    // Suppress React hydration warnings for this element. SSR builds skip source injection
    // (transformOptions.ssr check) while client builds inject the attribute; React would
    // otherwise warn about the mismatch on every SSR-rendered element.
    element.node.attributes.push(t.jsxAttribute(t.jsxIdentifier("suppressHydrationWarning")));

    return true;
};

// ─── AST transform ────────────────────────────────────────────────────────────

const transform = (ast: ReturnType<typeof parse>, file: string, ignoreComponents: Array<RegExp | string>): boolean => {
    let didTransform = false;

    const visitJSX =
        (propsName: null | string) =>
        (element: NodePath<t.JSXOpeningElement>): void => {
            if (transformJSX(element, propsName, file, ignoreComponents)) {
                didTransform = true;
            }
        };

    trav(ast, {
        ArrowFunctionExpression(path: NodePath<t.ArrowFunctionExpression>) {
            path.traverse({ JSXOpeningElement: visitJSX(getPropsNameFromFunctionDeclaration(path.node)) });
        },
        FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
            path.traverse({ JSXOpeningElement: visitJSX(getPropsNameFromFunctionDeclaration(path.node)) });
        },
        FunctionExpression(path: NodePath<t.FunctionExpression>) {
            path.traverse({ JSXOpeningElement: visitJSX(getPropsNameFromFunctionDeclaration(path.node)) });
        },
        VariableDeclaration(path: NodePath<t.VariableDeclaration>) {
            const decl = path.node.declarations.find(
                (d: t.VariableDeclarator) => d.init?.type === "ArrowFunctionExpression" || d.init?.type === "FunctionExpression",
            );

            if (!decl) {
                return;
            }

            path.traverse({ JSXOpeningElement: visitJSX(getPropsNameFromFunctionDeclaration(decl)) });
        },
    });

    return didTransform;
};

// ─── Public API ───────────────────────────────────────────────────────────────

export interface InjectSourceIgnore {
    /** Component names or patterns to skip. */
    components?: Array<RegExp | string>;
    /** File paths or patterns to skip. */
    files?: Array<RegExp | string>;
}

/**
 * Inject `data-vdt-source="<file>:<line>:<col>"` into every JSX opening element
 * in the given source code, enabling the inspector to resolve elements back to
 * their source location.
 *
 * Returns `undefined` when the file was skipped or contained no JSX to transform.
 */
export const addSourceToJsx = (
    code: string,
    id: string,
    ignore: InjectSourceIgnore = {},
): ReturnType<typeof gen> | undefined => {
    const [filePath] = id.split("?");
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const location = filePath!.replace(normalizePath(process.cwd()), "");

    if (matcher(ignore.files ?? [], location)) {
        return;
    }

    try {
        const ast = parse(code, {
            plugins: ["jsx", "typescript"],
            sourceType: "module",
        });

        if (!transform(ast, location, ignore.components ?? [])) {
            return;
        }

        return gen(ast, {
            filename: id,
            retainLines: true,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            sourceMaps: true as any,
            sourceFileName: filePath,
        });
    } catch {
        return;
    }
};
