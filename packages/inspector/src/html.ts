import { inspectList, truncator } from "./helpers";
import type { Inspect, Options } from "./types";

export function inspectAttribute([key, value]: [unknown, unknown], options: Options) {
    options.truncate -= 3;
    if (!value) {
        return `${options.stylize(String(key), "yellow")}`;
    }
    return `${options.stylize(String(key), "yellow")}=${options.stylize(`"${value}"`, "string")}`;
}

// @ts-expect-error (Deno doesn't have Element)
export function inspectHTMLCollection(collection: ArrayLike<Element>, options: Options): string {
    return inspectList(collection, options, inspectHTML as Inspect, "\n");
}

// @ts-expect-error (Deno doesn't have Element)
export default function inspectHTML(element: Element, options: Options): string {
    const properties = element.getAttributeNames();
    const name = element.tagName.toLowerCase();
    const head = options.stylize(`<${name}`, "special");
    const headClose = options.stylize(`>`, "special");
    const tail = options.stylize(`</${name}>`, "special");
    options.truncate -= name.length * 2 + 5;
    let propertyContents = "";
    if (properties.length > 0) {
        propertyContents += " ";
        propertyContents += inspectList(
            properties.map((key: string) => [key, element.getAttribute(key)]),
            options,
            inspectAttribute as Inspect,
            " ",
        );
    }
    options.truncate -= propertyContents.length;
    const { truncate } = options;
    let children = inspectHTMLCollection(element.children, options);
    if (children && children.length > truncate) {
        children = `${truncator}(${element.children.length})`;
    }
    return `${head}${propertyContents}${headClose}${children}${tail}`;
}
