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

// ─── Position map ─────────────────────────────────────────────────────────────
//
// SSR compilation pipelines (e.g. TanStack Start / Vinxi) prepend server-specific
// imports before our enforce:"pre" transform runs, shifting JSX line numbers.
// To get identical data-vdt-source values on both server and client we read the
// original source file from disk and build a map of every JSXOpeningElement's
// position keyed by "elementName:occurrenceIndex".
//
// The received `code` (which may have SSR imports prepended) is then traversed and
// positions are looked up from the map instead of using the shifted AST locations.
// When elements differ (virtual modules, generated code), we fall back silently.

type PositionMap = Map<string, { col: number; line: number }>;

const buildPositionMap = (originalCode: string): PositionMap => {
    const posMap: PositionMap = new Map();
    const counter = new Map<string, number>();

    try {
        const ast = parse(originalCode, {
            plugins: ["jsx", "typescript"],
            sourceType: "module",
        });

        trav(ast, {
            JSXOpeningElement(path: NodePath<t.JSXOpeningElement>) {
                const name = getNameOfElement(path.node.name);
                const idx = counter.get(name) ?? 0;

                counter.set(name, idx + 1);

                if (path.node.loc) {
                    posMap.set(`${name}:${idx}`, {
                        col: path.node.loc.start.column,
                        line: path.node.loc.start.line,
                    });
                }
            },
        });
    } catch {
        // Return partial/empty map; caller falls back to received-code positions
    }

    return posMap;
};

// ─── JSX transform ────────────────────────────────────────────────────────────

const transformJSX = (
    element: NodePath<t.JSXOpeningElement>,
    propsName: null | string,
    file: string,
    ignoreComponents: Array<RegExp | string>,
    posMap: PositionMap | undefined,
    occurrenceCounter: Map<string, number> | undefined,
): boolean | undefined => {
    const { loc } = element.node;

    if (!loc) {
        return;
    }

    const nameOfElement = getNameOfElement(element.node.name);

    // Track the occurrence index before any early returns so it stays in sync with
    // the position map built from the original file.
    let originalPos: { col: number; line: number } | undefined;

    if (posMap && occurrenceCounter) {
        const idx = occurrenceCounter.get(nameOfElement) ?? 0;

        occurrenceCounter.set(nameOfElement, idx + 1);
        originalPos = posMap.get(`${nameOfElement}:${idx}`);
    }

    // Skip fragments and structural HTML document elements — there is no useful
    // click-to-source action for <html>, <head>, or <body>.
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

    // Prefer positions from the original file (accurate even when the received code
    // has been pre-processed by SSR pipelines that shift line numbers).
    const line = originalPos?.line ?? loc.start.line;
    const column = originalPos?.col ?? loc.start.column;

    element.node.attributes.push(t.jsxAttribute(t.jsxIdentifier(SOURCE_ATTR), t.stringLiteral(`${file}:${line}:${column + 1}`)));

    return true;
};

// ─── AST transform ────────────────────────────────────────────────────────────

const transform = (
    ast: ReturnType<typeof parse>,
    file: string,
    ignoreComponents: Array<RegExp | string>,
    posMap?: PositionMap,
): boolean => {
    let didTransform = false;
    // Shared across all function scopes so occurrence indices match the file-level
    // position map built from the original source.
    const occurrenceCounter = posMap ? new Map<string, number>() : undefined;

    const visitJSX =
        (propsName: null | string) =>
        (element: NodePath<t.JSXOpeningElement>): void => {
            if (transformJSX(element, propsName, file, ignoreComponents, posMap, occurrenceCounter)) {
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
 * Pass `originalCode` when the received `code` may have been pre-processed by an
 * SSR pipeline (e.g. Vinxi / TanStack Start) that shifts JSX line numbers relative
 * to the source file on disk. Positions are then read from `originalCode` but
 * injected into `code`'s AST, ensuring server and client produce identical
 * attribute values and React hydration never reports a mismatch.
 *
 * Returns `undefined` when the file was skipped or contained no JSX to transform.
 */
export const addSourceToJsx = (
    code: string,
    id: string,
    ignore: InjectSourceIgnore = {},
    originalCode?: string,
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

        // Build a position map from the unmodified source when the received code
        // differs (SSR pipeline prepended imports), so both builds use the same
        // line/column values and React hydration never sees a mismatch.
        const posMap = originalCode && originalCode !== code ? buildPositionMap(originalCode) : undefined;

        if (!transform(ast, location, ignore.components ?? [], posMap)) {
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
