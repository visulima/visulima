/**
 * ApiObject represents an OpenAPI or Async API object
 */
export type ApiObject = boolean | number | object | string | [] | null;

/**
 * Location of a component.
 * For example for the component at `#/components/schemas/mySchema`
 * `.section` is the components/schemas object
 * `.sectionName` is `'schemas``
 * `.componentName` is `'mySchema'`
 */
export interface ComponentLocation {
    componentName: string;
    section: Record<string, ApiObject>;
    sectionName: string;
}

/**
 * An ApiObject read from a URL and optional fragment
 */
export interface ApiResource {
    /** The API document at the URL */
    api: ApiObject;
    /** The URL fragment, if it existed in the `url` */
    fragment?: string;
    /** The path to an item within the API document at the given fragment, if any */
    itemPath: JsonKey[];
    /** The URL that was used to fetch the resource */
    url: URL;
}

export interface ApiReferenceOptions {
    /**
     * What to do id two different resolutions define the same component,
     * either rename the second one by adding a unique integer suffix, or
     * throw an error. The default is `rename`. The result includes a list
     * of renamed components.
     */
    conflictStrategy?: "error" | "ignore" | "rename";

    /** If true, do not inject x-resolved-from and x-resolved-at markers */
    noMarkers?: boolean;

    /**
     * Output format for stdout; default is `yaml`
     */
    outputFormat?: "json" | "yaml";

    /** If true, log more info to console.warn */
    verbose?: boolean;
}

export interface ApiReferenceResolution {
    api: ApiObject;
    options: ApiReferenceOptions;
}

/**
 * Represents a JSON Reference object, such as
 * `{"$ref": "#/components/schemas/problemResponse" }`
 */
export interface ReferenceObject {
    $ref: string;
}

export interface JsonNavigation {}

/**
 * Function signature for the visitRefObjects callback
 */
export type ReferenceVisitor = (node: ReferenceObject, nav: JsonNavigation) => Promise<JsonItem>;

/**
 * Function signature for the walkObject callback
 */
export type ObjectVisitor = (node: ApiObject, nav: JsonNavigation) => Promise<JsonItem>;

/**
 * `JsonKey` is an element of a JsonNavigation _path_.
 * For example in
 * ```
 * { a: { b : [ 0, 1, { c: "here"}]}}
 * ```
 * the value `"here"` is at the path defined by
 * the `JsonKey` values
 * ```
 * [ "a", "b", 2, "c" ]
 * ```
 */
export type JsonKey = number | string;

/**
 * Represents a value inside a JSON document
 */
export type JsonItem = boolean | number | object | string | [] | null;
