import { TRUNCATOR } from "./constants";
import type { InternalInspect, Options } from "./types";
import inspectList from "./utils/inspect-list";

const inspectAttribute = ([key, value]: [unknown, unknown], _: unknown, options: Options): string => {
    // eslint-disable-next-line no-param-reassign
    options.truncate -= 3;

    if (!value) {
        return `${options.stylize(String(key), "yellow")}`;
    }

    return `${options.stylize(String(key), "yellow")}=${options.stylize(`"${value as string}"`, "string")}`;
};

export const inspectHTMLCollection = (collection: ArrayLike<Element>, options: Options, inspect: InternalInspect): string =>
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    inspectList(collection, collection, options, inspect, inspectHTMLElement, "\n");

export const inspectHTMLElement = (element: Element, object: unknown, options: Options, inspect: InternalInspect): string => {
    const properties = element.getAttributeNames();
    const name = element.tagName.toLowerCase();
    const head = options.stylize(`<${name}`, "special");
    const headClose = options.stylize(`>`, "special");
    const tail = options.stylize(`</${name}>`, "special");

    // eslint-disable-next-line no-param-reassign
    options.truncate -= name.length * 2 + 5;

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
    options.truncate -= propertyContents.length;

    const { truncate } = options;

    let children = inspectHTMLCollection(element.children, options, inspect);

    if (children && children.length > truncate) {
        children = `${TRUNCATOR}(${element.children.length})`;
    }

    return `${head}${propertyContents}${headClose}${children}${tail}`;
};
