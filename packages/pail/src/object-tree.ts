/* eslint-disable import/exports-last */

/**
 * Function to render a node value for display
 * @param node The node to render
 * @returns A string representation or undefined if should not render
 */
export type TreeRenderFn = (node: unknown) => string | undefined;

/**
 * Function to sort keys during tree traversal
 * @param a First key for comparison
 * @param b Second key for comparison
 * @returns Negative if a < b, positive if a > b, 0 if equal
 */
export type TreeSortFn = (a: string, b: string) => number;

/**
 * Configuration options for object tree rendering
 */
export interface ObjectTreeOptions {
    /** Text to display for circular references (default: " (circular ref.)") */
    breakCircularWith?: string | null;
    /** Whether to return as single string or array of lines (default: true) */
    joined?: boolean;
    /** Connector for neighbor keys (default: "├─ ") */
    keyNeighbour?: string;
    /** Connector for non-neighbor keys (default: "└─ ") */
    keyNoNeighbour?: string;
    /** Function to render node values (default: renders primitives) */
    renderFn?: TreeRenderFn;
    /** Separator between key and value (default: ": ") */
    separator?: string;
    /** Function to sort object keys (default: natural order) */
    sortFn?: TreeSortFn | null;
    /** Spacer for neighbor branches (default: "│  ") */
    spacerNeighbour?: string;
    /** Spacer for non-neighbor branches (default: "   ") */
    spacerNoNeighbour?: string;
}

/**
 * Validates and builds the context object with all options
 */
const buildContext = (options?: ObjectTreeOptions) => {
    const context: Required<ObjectTreeOptions> = {
        breakCircularWith: " (circular ref.)",
        joined: true,
        keyNeighbour: "├─ ",
        keyNoNeighbour: "└─ ",
        renderFn: (node) => ["boolean", "string", "number"].includes(typeof node) ? String(node) : undefined,
        separator: ": ",
        sortFn: null,
        spacerNeighbour: "│  ",
        spacerNoNeighbour: "   ",
        ...options,
    };

    // Validate all required options are strings or functions
    if (typeof context.joined !== "boolean") {
        throw new TypeError("Option \"joined\" must be a boolean");
    }

    if (typeof context.spacerNoNeighbour !== "string") {
        throw new TypeError("Option \"spacerNoNeighbour\" must be a string");
    }

    if (typeof context.spacerNeighbour !== "string") {
        throw new TypeError("Option \"spacerNeighbour\" must be a string");
    }

    if (typeof context.keyNoNeighbour !== "string") {
        throw new TypeError("Option \"keyNoNeighbour\" must be a string");
    }

    if (typeof context.keyNeighbour !== "string") {
        throw new TypeError("Option \"keyNeighbour\" must be a string");
    }

    if (typeof context.separator !== "string") {
        throw new TypeError("Option \"separator\" must be a string");
    }

    if (typeof context.renderFn !== "function") {
        throw new TypeError("Option \"renderFn\" must be a function");
    }

    if (context.sortFn !== null && typeof context.sortFn !== "function") {
        throw new TypeError("Option \"sortFn\" must be a function or null");
    }

    if (context.breakCircularWith !== null && typeof context.breakCircularWith !== "string") {
        throw new TypeError("Option \"breakCircularWith\" must be a string or null");
    }

    return context;
};

/**
 * Renders an object as an ASCII tree structure
 * @param tree The object to render as a tree
 * @param opts Configuration options for tree rendering
 * @returns Formatted tree as string or array of lines
 * @example
 * ```typescript
 * const obj = {
 *   name: "John",
 *   age: 30,
 *   address: {
 *     street: "Main St",
 *     city: "New York"
 *   }
 * };
 *
 * // Default output as string
 * console.log(renderObjectTree(obj));
 *
 * // Custom rendering
 * console.log(renderObjectTree(obj, {
 *   sortFn: (a, b) => a.localeCompare(b),
 *   renderFn: (node) => {
 *     if (typeof node === 'string') return node.toUpperCase();
 *     return ['boolean', 'string', 'number'].includes(typeof node)
 *       ? String(node)
 *       : undefined;
 *   }
 * }));
 *
 * // Get as array of lines
 * const lines = renderObjectTree(obj, { joined: false });
 * ```
 */
export const renderObjectTree = (tree: Record<string, unknown> | unknown[], options?: ObjectTreeOptions): string | string[] => {
    const context = buildContext(options);
    const result: string[] = [];

    // Render root value if it's a primitive
    const rootRendered = context.renderFn(tree);

    if (rootRendered !== undefined) {
        result.push(String(rootRendered));
    }

    // Sort function matching original implementation
    const sort = (input: string[]): string[] => {
        if (context.sortFn === null) {
            return input.reverse(); // In-place reverse
        }

        return input.sort((a, b) => context.sortFn!(b, a)); // In-place sort with reversed comparison
    };

    const neighbours: boolean[] = [];
    const keys = sort(Object.keys(tree as Record<string, unknown>)).map((k) => [k]);
    const lookup: unknown[] = [tree];

    // Traverse tree depth-first using stack (LIFO)
    while (keys.length > 0) {
        const key = keys.pop()!;
        const node = (lookup[key.length - 1] as Record<string, unknown>)[key[key.length - 1]];
        const isCircular = context.breakCircularWith !== null && lookup.includes(node);

        // Check if this key has siblings at the same level (neighbors)
        neighbours[key.length - 1] = keys.length > 0 && keys[keys.length - 1].length === key.length;

        // Build the line with tree structure
        const indent = neighbours
            .slice(0, key.length - 1)
            .map((n) => n ? context.spacerNeighbour : context.spacerNoNeighbour)
            .join("");
        const connector = neighbours[key.length - 1] ? context.keyNeighbour : context.keyNoNeighbour;
        const keyName = key[key.length - 1];
        const nodeRendered = context.renderFn(node);
        const value = nodeRendered === undefined ? "" : `${context.separator}${nodeRendered}`;
        const circular = isCircular ? context.breakCircularWith : "";

        result.push(`${indent}${connector}${keyName}${value}${circular}`);

        // Add nested keys if node is an object (but not array, and not circular)
        if (node instanceof Object && !Array.isArray(node) && !isCircular) {
            keys.push(...sort(Object.keys(node as Record<string, unknown>)).map((k) => key.concat(k)));
            lookup[key.length] = node;
        }
    }

    return context.joined === true ? result.join("\n") : result;
};

/**
 * Default export for CommonJS compatibility
 */
export default renderObjectTree;
