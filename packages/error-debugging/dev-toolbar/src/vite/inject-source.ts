import generate from "@babel/generator";
import { parse } from "@babel/parser";
import type { NodePath } from "@babel/traverse";
import _traverse from "@babel/traverse";
// eslint-disable-next-line import/no-namespace, import/no-extraneous-dependencies
import * as t from "@babel/types";
import { normalizePath } from "vite";

import matcher, { compileMatcher } from "./matcher";

// CJS/ESM interop — @babel/traverse and @babel/generator ship CJS with a .default wrapper

const trav: typeof _traverse = (_traverse as any).default ?? _traverse;

const gen: typeof generate = (generate as any).default ?? generate;

export const SOURCE_ATTR = "data-vdt-source";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getPropsNameFromFunctionDeclaration = (
    functionDeclaration: t.ArrowFunctionExpression | t.FunctionDeclaration | t.FunctionExpression,
): string | undefined => {
    let propsName: string | undefined;

    const first = functionDeclaration.params[0];

    if (!first) {
        return undefined;
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
                const index = counter.get(name) ?? 0;

                counter.set(name, index + 1);

                if (path.node.loc) {
                    posMap.set(`${name}:${index}`, {
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
    propsName: string | undefined,
    file: string,
    isIgnoredComponent: (value: string) => boolean,
    posMap: PositionMap | undefined,
    occurrenceCounter: Map<string, number> | undefined,
): boolean => {
    const { loc } = element.node;

    if (!loc) {
        return false;
    }

    const nameOfElement = getNameOfElement(element.node.name);

    // Track the occurrence index before any early returns so it stays in sync with
    // the position map built from the original file.
    let originalPos: { col: number; line: number } | undefined;

    if (posMap && occurrenceCounter) {
        const index = occurrenceCounter.get(nameOfElement) ?? 0;

        occurrenceCounter.set(nameOfElement, index + 1);
        originalPos = posMap.get(`${nameOfElement}:${index}`);
    }

    // Skip fragments and structural HTML document elements — there is no useful
    // click-to-source action for <html>, <head>, or <body>.
    if (
        nameOfElement === "Fragment" ||
        nameOfElement === "React.Fragment" ||
        nameOfElement === "html" ||
        nameOfElement === "head" ||
        nameOfElement === "body" ||
        isIgnoredComponent(nameOfElement)
    ) {
        return false;
    }

    // Skip if already annotated
    const hasSourceAttribute = element.node.attributes.some(
        (attribute: t.JSXAttribute | t.JSXSpreadAttribute) =>
            attribute.type === "JSXAttribute" && attribute.name.type === "JSXIdentifier" && attribute.name.name === SOURCE_ATTR,
    );

    // Skip if component props are spread onto this element (would break prop forwarding)
    const hasSpread = element.node.attributes.some(
        (attribute: t.JSXAttribute | t.JSXSpreadAttribute) =>
            attribute.type === "JSXSpreadAttribute" && attribute.argument.type === "Identifier" && attribute.argument.name === propsName,
    );

    if (hasSpread || hasSourceAttribute) {
        return false;
    }

    // Prefer positions from the original file (accurate even when the received code
    // has been pre-processed by SSR pipelines that shift line numbers).
    const line = originalPos?.line ?? loc.start.line;
    const column = originalPos?.col ?? loc.start.column;

    element.node.attributes.push(t.jsxAttribute(t.jsxIdentifier(SOURCE_ATTR), t.stringLiteral(`${file}:${line}:${column + 1}`)));

    return true;
};

// ─── AST transform ────────────────────────────────────────────────────────────

const transform = (ast: ReturnType<typeof parse>, file: string, ignoreComponents: (RegExp | string)[], posMap?: PositionMap): boolean => {
    let didTransform = false;
    // Shared across all function scopes so occurrence indices match the file-level
    // position map built from the original source.
    const occurrenceCounter = posMap ? new Map<string, number>() : undefined;

    // Precompile the ignore globs once per file instead of recompiling them for
    // every JSX opening element (a large component can contain hundreds).
    const isIgnoredComponent = compileMatcher(ignoreComponents);

    const visitJSX =
        (propsName: string | undefined) =>
        (element: NodePath<t.JSXOpeningElement>): void => {
            if (transformJSX(element, propsName, file, isIgnoredComponent, posMap, occurrenceCounter)) {
                didTransform = true;
            }
        };

    // Walk a function's body in isolation: JSX in this scope uses *this* function's
    // propsName; descent into nested functions stops here, and each nested function
    // is then walked with its own propsName context. Crossing function boundaries
    // would annotate inner JSX with the outer function's propsName, breaking the
    // hasSpread check when an inner component spreads its own props.
    const visitFunction = (fnPath: NodePath<t.ArrowFunctionExpression | t.FunctionDeclaration | t.FunctionExpression>): void => {
        const propsName = getPropsNameFromFunctionDeclaration(fnPath.node);

        fnPath.traverse({
            ArrowFunctionExpression(inner: NodePath<t.ArrowFunctionExpression>) {
                visitFunction(inner);
                inner.skip();
            },
            FunctionDeclaration(inner: NodePath<t.FunctionDeclaration>) {
                visitFunction(inner);
                inner.skip();
            },
            FunctionExpression(inner: NodePath<t.FunctionExpression>) {
                visitFunction(inner);
                inner.skip();
            },
            JSXOpeningElement: visitJSX(propsName),
        });
    };

    trav(ast, {
        ArrowFunctionExpression(path: NodePath<t.ArrowFunctionExpression>) {
            visitFunction(path);
            path.skip();
        },
        FunctionDeclaration(path: NodePath<t.FunctionDeclaration>) {
            visitFunction(path);
            path.skip();
        },
        FunctionExpression(path: NodePath<t.FunctionExpression>) {
            visitFunction(path);
            path.skip();
        },
    });

    return didTransform;
};

// ─── Public API ───────────────────────────────────────────────────────────────

export interface InjectSourceIgnore {
    /** Component names or patterns to skip. */
    components?: (RegExp | string)[];
    /** File paths or patterns to skip. */
    files?: (RegExp | string)[];
}

/**
 * Inject `data-vdt-source="&lt;file>:&lt;line>:&lt;col>"` into every JSX opening element
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
export const addSourceToJsx = (code: string, id: string, ignore: InjectSourceIgnore = {}, originalCode?: string): ReturnType<typeof gen> | undefined => {
    const [filePath] = id.split("?");
    // Strip the CWD prefix (including the trailing separator) so the stored path is
    // relative without a leading slash, e.g. "src/routes/index.tsx" not "/src/…".
    // The RPC openInEditor handler then resolves it against server.config.root.

    const location = filePath!.replace(`${normalizePath(process.cwd())}/`, "");

    if (matcher(ignore.files ?? [], location)) {
        return undefined;
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
            return undefined;
        }

        return gen(ast, {
            filename: id,
            retainLines: true,
            sourceFileName: filePath,

            sourceMaps: true,
        });
    } catch {
        return undefined;
    }
};
