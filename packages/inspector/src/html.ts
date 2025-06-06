import { TRUNCATOR } from "./constants";
import type { Indent, InspectType, InternalInspect, Options } from "./types";
import inspectList from "./utils/inspect-list";

const inspectAttribute = ([key, value]: [unknown, unknown], _: unknown, options: Options): string => {
    // eslint-disable-next-line no-param-reassign
    options.maxStringLength -= 3;

    if (!value) {
        return options.stylize(String(key), "yellow");
    }

    return `${options.stylize(String(key), "yellow")}=${options.stylize(`"${value as string}"`, "string")}`;
};

export const inspectNode = (node: Node, inspect: InternalInspect, options: Options): string => {
    switch (node.nodeType) {
        case 1: {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            return inspectHTMLElement(node as Element, node, options, inspect);
        }
        case 3: {
            return inspect((node as Text).data, inspect, options);
        }
        default: {
            return inspect(node, inspect, options);
        }
    }
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const inspectNodeCollection: InspectType<ArrayLike<Node>> = (collection: ArrayLike<Node>, options: Options, inspect: InternalInspect, _: Indent | undefined): string => inspectList(collection, collection, options, inspect, inspectNode, "\n");

export const inspectHTMLElement = (element: Element, object: unknown, options: Options, inspect: InternalInspect): string => {
    const properties = element.getAttributeNames();
    const name = element.tagName.toLowerCase();
    const head = options.stylize(`<${name}`, "special");
    const headClose = options.stylize(`>`, "special");
    const tail = options.stylize(`</${name}>`, "special");

    // eslint-disable-next-line no-param-reassign
    options.maxStringLength -= name.length * 2 + 5;

    let propertyContents = "";

    if (properties.length > 0) {
        propertyContents += " ";
        propertyContents += inspectList(
            properties.map((key: string) => [key, element.getAttribute(key)]),
            object,
            options,
            inspect,
            inspectAttribute,
            " ",
        );
    }

    // eslint-disable-next-line no-param-reassign
    options.maxStringLength -= propertyContents.length;

    const { maxStringLength } = options;

    let children = inspectNodeCollection(element.children, options, inspect, undefined);

    if (children && children.length > maxStringLength) {
        children = `${TRUNCATOR}(${element.children.length})`;
    }

    return `${head}${propertyContents}${headClose}${children}${tail}`;
};
