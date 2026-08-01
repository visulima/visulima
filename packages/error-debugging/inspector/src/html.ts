import { INSPECTION_THREW, TRUNCATOR } from "./constants";
import type { Indent, InspectType, InternalInspect, Options } from "./types";
import inspectList from "./utils/inspect-list";

const inspectAttribute = ([key, value]: [unknown, unknown], _: unknown, options: Options): string => {
    // eslint-disable-next-line no-param-reassign
    options.truncate -= 3;

    if (!value) {
        return options.stylize(String(key), "yellow");
    }

    return `${options.stylize(String(key), "yellow")}=${options.stylize(`"${value as string}"`, "string")}`;
};

/**
 * Reads `length` off an untrusted collection once, under a guard, and hands back a
 * view whose `length` is an own data property — so every downstream read (in
 * `inspectList`, and in the truncation marker below) sees a plain value that cannot
 * throw on a second call. Element reads still go through to the original via the
 * prototype chain, where `inspectNode` guards them per member.
 *
 * `undefined` means the getter threw.
 */
const withPinnedLength = (collection: ArrayLike<Node>): ArrayLike<Node> | undefined => {
    try {
        return Object.create(collection, { length: { value: collection.length } }) as ArrayLike<Node>;
    } catch {
        return undefined;
    }
};

export const inspectNode = (node: Node, _from: unknown, options: Options, inspect: InternalInspect): string => {
    // `NodeList` and `HTMLCollection` are host tags with no ES-level brand, so this
    // inspector is reachable by any value that simply claims one via
    // `Symbol.toStringTag` — at which point the DOM reads here and in
    // `inspectHTMLElement` are unguarded calls on an untrusted object. Each such read
    // is guarded on its own; the recursion below deliberately runs outside the guard,
    // so a throw raised by a legitimate subtree (or by a bug in this package) is not
    // swallowed into the marker along with it.
    let nodeType: unknown;

    try {
        nodeType = node.nodeType;
    } catch {
        return INSPECTION_THREW;
    }

    if (nodeType === 1) {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        return inspectHTMLElement(node as Element, node, options, inspect);
    }

    if (nodeType === 3) {
        let data: unknown;

        try {
            data = (node as Text).data;
        } catch {
            return INSPECTION_THREW;
        }

        return inspect(data, undefined, options);
    }

    return inspect(node, undefined, options);
};

export const inspectNodeCollection: InspectType<ArrayLike<Node>> = (collection: ArrayLike<Node>, options: Options, inspect: InternalInspect, _: Indent | undefined): string => {
    // `inspectList` reads `collection.length` before the first `inspectNode` guard
    // runs, so on a forged collection that read is the one thing that can still escape.
    const list = withPinnedLength(collection);

    if (list === undefined) {
        return INSPECTION_THREW;
    }

    return inspectList(list, collection, options, inspect, inspectNode, "\n");
};

export const inspectHTMLElement = (element: Element, object: unknown, options: Options, inspect: InternalInspect): string => {
    let properties: [string, string | null][];
    let name: string;

    try {
        properties = element.getAttributeNames().map((key: string) => [key, element.getAttribute(key)]);
        name = element.tagName.toLowerCase();
    } catch {
        return INSPECTION_THREW;
    }

    const head = options.stylize(`<${name}`, "special");
    const headClose = options.stylize(`>`, "special");
    const tail = options.stylize(`</${name}>`, "special");

    // eslint-disable-next-line no-param-reassign
    options.truncate -= name.length * 2 + 5;

    let propertyContents = "";

    if (properties.length > 0) {
        propertyContents += " ";
        propertyContents += inspectList(properties, object, options, inspect, inspectAttribute, " ");
    }

    // eslint-disable-next-line no-param-reassign
    options.truncate -= propertyContents.length;

    const { truncate } = options;

    // `withPinnedLength` guards the `length` read; this `try` guards the `children`
    // read that feeds it. An element whose child list is unreadable still renders its
    // own tag and attributes, with the marker standing in for the subtree.
    let childCollection: ArrayLike<Node> | undefined;

    try {
        childCollection = withPinnedLength(element.children);
    } catch {
        childCollection = undefined;
    }

    let children: string;

    if (childCollection === undefined) {
        children = INSPECTION_THREW;
    } else {
        children = inspectNodeCollection(childCollection, options, inspect, undefined);

        if (children && children.length > truncate) {
            children = `${TRUNCATOR}(${String(childCollection.length)})`;
        }
    }

    return `${head}${propertyContents}${headClose}${children}${tail}`;
};
