import { strict as assert } from "node:assert";
import { resolve } from "node:path";
import { URL, pathToFileURL } from "node:url";
import { JSON_SCHEMA, load } from "yaml";

import deepClone from "@visulima/deep-clone";
import JsonNavigation from "./json-navigation";
import { isRef as isReference, visitRefObjects as visitReferenceObjects, walkObject } from "./ref-visitor";
import type { ApiObject, ApiReferenceOptions, ApiReferenceResolution, ApiResource, ComponentLocation, JsonItem, JsonKey } from "./types";
import asJsonFragment from "./util/as-json-fragment";
import urlNonFragment from "./util/url-non-fragment";

/**
 * Check if the nav and the resolved component are the same component name
 * @param nav The location of the element contains a $ref
 * @param componentKeys The path of keys in a reference component
 * @returns `true` iff the current component location has the same name as the referenced component.
 * For example, `/components/securitySchemes/accessToken` contains just
 * `$ref: uriToOtherDocument#/components/securitySchemes/accessToken
 * Both locations must be exactly 3 elements long, [ `components`, _sectionName_, _componentsName_ ].
 */
const sameComponentName = (nav: JsonNavigation, componentKeys: JsonKey[]) => {
    const path = nav.path();
    const nameLeft = path.at(-1);
    const nameRight = componentKeys.at(-1);

    return path.length === 3 && componentKeys.length === 3 && nameLeft === nameRight;
};

/**
 * Return the URL fragment part of the URL (with the `#`)
 * or `undefined` if there is no fragment.
 * @param url a URL
 * @returns the fragment string or undefined if there is no fragment
 */
const urlFragment = (url: URL): string | undefined => (url.hash === "" ? undefined : url.hash);

const apiItem = (api: ApiObject, itemPath: string[]): JsonItem | undefined => JsonNavigation.itemAtFragment(api, asJsonFragment(itemPath, true));

/**
 * ApiRefResolver resolves multi-file API definition documents by replacing
 * external `{$ref: "uri"}` [JSON Reference](https://datatracker.ietf.org/doc/html/draft-pbryan-zyp-json-ref-03)
 * objects with the object referenced at the `uri`.
 */
class ApiReferenceResolver {
    /**
     * A `RegExp` which only matches an API component relative-uri fragment `#/components/<section>/<componentName>`
     */
    private static readonly COMPONENT_REGEXP = /^#\/components(?:\/[^\\/]+){2}$/;

    /**
     * Marker to indicate when an object was resolved (unless options.noMarker is true)
     * See tag()
     */
    private static readonly RESOLVED_AT_MARKER = "x-resolved-at";

    // The protocol of `this.url`; usually one of '`file'|'http'|'https'`
    /**
     * Marker to indicate where an object was resolved from (unless options.noMarker is true)
     * See tag()
     */
    private static readonly RESOLVED_FROM_MARKER = "x-resolved-from";

    /**
     * Temporary marker added to object to prevent re-resolving them.
     * Removed in cleanup().
     */
    private static readonly TEMPORARY_MARKER = "x__resolved__";

    private readonly alreadyRewritten: {
        fragment: Record<string, boolean>;
        path: Record<string, boolean>;
    };

    private apiDocument: ApiObject;

    /**
     * Tracks whether the resolve function changed anything
     */
    private changed;

    /**
     * Date-time when we resolved this API
     */
    private readonly dateTime: string;

    // private urlProtocol : string;
    private options: ApiReferenceOptions;

    /**
     * Maps $ref strings to their resolved $ref strings
     */
    private resolvedRefToRefMap: Record<string, string>;

    /** The URL of the current API being processed */
    private readonly url: URL;

    /**
     * Maps normalized path names or URLs to API document objects
     */
    private urlToApiObjectMap: Record<string, ApiObject>;

    /**
     * Build a new `$ref` resolver
     * @param uri The location of the API document: a file name or URL
     * @param apiDocument Optional document object. If omitted, the
     * {@link resolve()} function will read it.
     */
    public constructor(uri: URL | string, apiDocument?: ApiObject) {
        this.resolvedRefToRefMap = {};
        this.urlToApiObjectMap = {};
        this.dateTime = new Date().toISOString();
        this.alreadyRewritten = { fragment: {}, path: {} };

        if (typeof uri === "string") {
            this.url = /^\w+:/.test(uri) ? new URL(uri) : pathToFileURL(resolve(process.cwd(), uri));
        } else {
            this.url = uri;
        }

        if (apiDocument) {
            this.apiDocument = apiDocument;
        }
    }

    // eslint-disable-next-line no-secrets/no-secrets
    /**
     * Track whether we have already rewritten all the `$ref` objects in an API document
     * by its URL.
     * @param normalizedApiDocumentUrl the (normalized) URL of the API document
     * @param what which type of update to track: `path` for {@link rewriteRefPaths} or `fragment` for {@link rewriteRefFragments}
     * @returns `false` if we have not rewritten then.
     */
    private areRefsAlreadyRewritten(normalizedApiDocumentUrl: URL, what: "fragment" | "path"): boolean {
        const map = this.alreadyRewritten[what];
        const key = normalizedApiDocumentUrl.href;

        return !!map[key];
    }

    /**
     * Check if the inlined component already exists.
     * If it exists and it was resolved from a different URL, then:
     *   * if the component conflictStrategy in the option is `error`, throw an error
     *   * if the policy is `rename`, change the name by adding a unique suffix
     * Also create the components object and components section (componentKeys[1])
     * object if they do not exist on `this.apiObject`.
     * @param refObject the current reference object
     * @param componentKeys the JSON keys to the component, [components, sectionName, componentName]
     * @param originalUrl $ref object URL of the component
     * @returns component location
     */
    private checkComponentConflict(referenceObject: ApiObject, componentKeys: JsonKey[], originalUrl: URL): ComponentLocation {
        assert(componentKeys[0] === "components");

        const urlNoFragment = urlNonFragment(originalUrl);
        const sectionName = componentKeys[1] as string;
        const componentName = componentKeys[2] as string;

        if (!this.apiDocument.components) {
            this.apiDocument.components = {};
        }

        const { components } = this.apiDocument;

        if (!components[sectionName]) {
            components[sectionName] = {};
        }

        const section = components[sectionName];
        const existing = this.apiDocument?.[componentKeys[0]]?.[sectionName]?.[componentKeys[2]];

        if (!existing) {
            return { componentName, section, sectionName };
        }

        if (existing === referenceObject) {
            // The component is defined by a ref and we're processing it!
            return { componentName, section, sectionName };
        }

        const resolvedFrom = existing["x-resolved-from"];
        const sameResolution = resolvedFrom === urlNoFragment.href;

        if (!sameResolution && this.options.conflictStrategy === "error") {
            const resolvedFromText = resolvedFrom ? ` from ${resolvedFrom}` : "";
            throw new Error(`Cannot embed component ${componentKeys} from ${originalUrl.href}: component already exists${resolvedFromText}`);
        }

        if (this.options.conflictStrategy === "ignore") {
            this.note(`Component conflict ignored. ${componentName} found at both ${resolvedFrom} and ${urlNoFragment.href}`);
            return { componentName, section, sectionName };
        }

        let candidateName = componentName;
        let suffix = 0;

        while (section.hasOwnProperty(candidateName)) {
            suffix += 1;
            candidateName = `${componentName}${suffix}`;
        }

        componentKeys[2] = candidateName;

        this.note(`Renamed components.${sectionName}.${componentName} from ${urlNoFragment.href} as ${candidateName}`);

        return { componentName: candidateName, section, sectionName };
    }

    /**
     * Cleanup the final resolved object by removing temporary `x__resolved__` tags
     * @param resolved the APi document after resolving the `$ref` objects
     * @returns the cleansed `resolved` object
     */
    private async cleanup(resolved: ApiObject): Promise<object> {
        return (await walkObject(resolved, async (node: object) => {
            if (this.options.noMarkers) {
                if (node.hasOwnProperty(ApiReferenceResolver.RESOLVED_FROM_MARKER)) {
                    delete node[ApiReferenceResolver.RESOLVED_FROM_MARKER];
                }
                if (node.hasOwnProperty(ApiReferenceResolver.RESOLVED_AT_MARKER)) {
                    delete node[ApiReferenceResolver.RESOLVED_AT_MARKER];
                }
            }
            if (node.hasOwnProperty(ApiReferenceResolver.TEMPORARY_MARKER)) {
                delete node[ApiReferenceResolver.TEMPORARY_MARKER];
            }
            return node;
        })) as object;
    }

    /**
     * Return `true` if `refObject` does not contains any additional properties.
     * @param refObject an object with a `$ref` key
     * @returns  `true` iff `refObject` does not contains any additional properties.
     */
    private isSimpleRef(referenceObject: ReferenceObject) {
        return Object.keys(referenceObject).length === 1;
    }

    /**
     * Track that we have already rewritten all the `$ref` objects in an API document
     * by its URL.
     * @param normalizedApiDocUrl the (normalized) URL of the API document
     * @param what which type of update to track: `path` for {@link rewriteRefPaths} or `fragment` for {@link rewriteRefFragments}
     */
    private markRefsAlreadyRewritten(normalizedApiDocumentUrl: URL, what: "fragment" | "path") {
        const map = this.alreadyRewritten[what];
        const key = normalizedApiDocumentUrl.href;

        map[key] = true;
    }

    /**
     * Read an API document from a file: URL
     * @param url the URL where the API is located
     */
    /**
     * Log a message if this.options.verbose is true
     * @param message message text
     */
    private note(message: string) {
        if (this.options.verbose) {
            console.log(`api-ref-resolver: ${message}`);
        }
    }

    /**
     * Inline the content for a `{ $ref: "http://path/to/resource#/components/section/componentName"}`
     * or `{ $ref: "../path/to/resource#/components/section/componentName"}` where
     * just a component from an API is referenced.
     * For example,
     *
     * ```
     * paths:
     *   /thing:
     *     post:
     *       operationId: createThing
     *       requestBody:
     *         description: A new thing.
     *         content:
     *             application/json:
     *               schema:
     *                 $ref: '../api-a/api.yaml#/components/schemas/thing'
     * components:
     *   securitySchemes:
     *     apiKey:
     *       $ref: '../api-a/api.yaml#/components/securitySchemes/apiKey'
     * ```
     * In the first case (`$ref: '../api-a/api.yaml#/components/schemas/thing'`), we
     * add the schema component `thing` from `../api-a/api.yaml`
     * to this API's `components/schemas` object, and replace the remote `$ref` object
     * with a local reference, $ref: '#/components/schemas/thing'.
     *
     * If there is a name conflict (i.e. the component `thing` already exists
     * and it came from a _different_ normalized URL), then apply the `conflictStrategy` from
     * the `options`.
     *
     * In the second place (a reference directly in a component),  simply
     * replace the `$ref` object (the `apiKey` security scheme) with the corresponding referenced object directly.
     *
     * The result of processing both component `#ref` objects is:
     * ```
     * paths:
     *   /thing:
     *     post:
     *       operationId: createThing
     *       requestBody:
     *         description: A new thing.
     *         content:
     *             application/json:
     *               schema:
     *                 $ref: '#/components/schemas/thing'
     * components:
     *   securitySchemes:
     *     apiKey:
     *       type: apiKey
     *       name: API-Key
     *       in: header
     *       description: 'API Key based client identification.'
     *       $ref: '../api-a/api.yaml#/components/securitySchemes/apiKey'
     *   schemas:
     *     thing:
     *       title: Thing
     *       description: A Thing!
     *       type: object
     *       ...
     * ```
     *
     * Before the content is merged into the current API document, update base URL of
     * all the `$ref` objects within the referenced API document.
     *
     * @param normalizedRefUrl the URL in the `$ref` object after normalizing it against the URL of the current target API document
     * @param refObject the `$ref` object
     * @param nav The location of the `$ref` object in the target API document
     * @returns the updated JSON item (usually an object, but may be an array or primitive)
     */
    private async processComponentReplacement(normalizedReferenceUrl: URL, referenceObject: ReferenceObject, nav: JsonNavigation): Promise<JsonItem> {
        assert(nav);
        assert(normalizedReferenceUrl.hash);
        assert(ApiReferenceResolver.COMPONENT_REGEXP.exec(normalizedReferenceUrl.hash));

        const reference: string = normalizedReferenceUrl.href;
        const seen = this.replacementRefFor(reference);

        if (seen) {
            referenceObject.$ref = seen;

            return referenceObject;
        }

        const urlNoFragment = urlNonFragment(normalizedReferenceUrl);
        const { api, itemPath } = await this.api(normalizedReferenceUrl);
        const baseUrl = new URL(urlNoFragment.href, this.url);

        await this.rewriteRefPaths(baseUrl, api);

        const item = apiItem(api, itemPath);
        const componentKeys = JsonNavigation.asKeys(normalizedReferenceUrl.hash);

        this.tag(item, normalizedReferenceUrl, nav);

        // Simplest case:
        // components/foo/bar: { $ref: uri:/components/foo/bar }
        if (nav.isAtComponent() && this.isSimpleRef(referenceObject) && sameComponentName(nav, componentKeys)) {
            this.rememberReplacementForRef(reference, nav.asFragment());

            return item; // item is already safely cloned cia this.api()
        }

        const { componentName, section, sectionName } = this.checkComponentConflict(referenceObject, componentKeys, normalizedReferenceUrl); // this may rename the new resolved component
        const newValue = deepClone(item, {
            circles: true,
            proto: true,
        });

        section[componentName] = newValue;

        const resolvedReference = asJsonFragment(["components", sectionName, componentName], true);

        this.rememberReplacementForRef(reference, resolvedReference);

        referenceObject.$ref = resolvedReference;

        return referenceObject;
    }

    /**
     * Inline the content for a `{ $ref: "http://path/to/resource" }`
     * or `{ $ref: "../path/to/resource"}` where the entire
     * file contents are embedded at the place of the `$ref` object
     * indicated by the `nav` location. For example,
     * ```
     * components:
     *   schemas:
     *     range:
     *       $ref: ../schemas/percentageRange.yaml
     * ```
     * the current `nav` location of the `$ref` object is `/components/schemas/range`
     * Fetch the API document from the location, then replace
     * the `$ref` object with the API contents, then update
     * all the `{ $ref` : "#/path" } objects within that object, adjusting
     * the path to account for the new location. For example,
     * if `percentageRange.yaml` contains
     *
     * ```
     * properties:
     *   low:
     *     description: The lower-bound of the percentage range.
     *     $ref: 'percentage.yaml'
     *   high:
     *     description: The lower-bound of the percentage range.
     *     $ref: '#/properties/low'
     * ```
     *
     * we adjust all the `$ref` objects , yielding corrected
     * locations
     *
     * ```
     * components:
     *   schemas:
     *     range:
     *       type: object
     *       description: A range of low and high percentages.
     *       properties:
     *         low:
     *           description: The lower-bound of the percentage range.
     *           $ref: '../schemas/percentage.yaml'
     *         high:
     *           description: The lower-bound of the percentage range.
     *           $ref: '#/components/schemas/range/properties/low'
     *       ```
     * The first `$ref` is relative to the the current API;
     * the second `$ref` is updated with the prefix of the current `nav` location.
     * @param normalizedRefUrl the URL in the `$ref` object after normalizing it against the URL of the current target API document
     * @param refObject the `$ref` object
     * @param nav The location of the `$ref` object in the target API document
     * @returns the updated JSON item (usually an object, but may be an array or primitive)
     */
    private async processFullReplacement(normalizedReferenceUrl: URL, referenceObject: ReferenceObject, nav: JsonNavigation): Promise<JsonItem> {
        assert(normalizedReferenceUrl.hash === "");

        const reference: string = normalizedReferenceUrl.href;
        const seen = this.replacementRefFor(reference);

        if (seen) {
            referenceObject.$ref = seen;

            return referenceObject;
        }

        const { api } = await this.api(normalizedReferenceUrl); // no fragment or item
        // remember the mapping from the original `$ref` to the new inline
        // location of the current object from the target API document navigation
        const resolvedReference = nav.asFragment();

        this.rememberReplacementForRef(reference, resolvedReference);

        await this.rewriteRefFragments(normalizedReferenceUrl, api, nav);
        await this.rewriteRefPaths(normalizedReferenceUrl, api); // always call this after rewriteLocalRefsWithPrefix

        const merged = this.mergeRefObject(referenceObject, api);

        this.tag(merged, normalizedReferenceUrl, nav);

        return merged;
    }

    /**
     * Inline the content for a `{ $ref: "path/to/resource#/path/to/non-component"}`
     * where the `$ref` URL contains a non-empty `#` fragment
     * (Use `processFullReplacement` if the fragment is empty,
     * and use `processComponentReplacement` if the fragment is
     * of the form `/components/section/componentName`.)
     * For example,
     *
     * ```
     * paths:
     *   /health:
     *     $ref: '../root.yaml#/paths/~1health/get'
     * ```
     *
     * We read the APi document (`../root.yaml` in this case),
     * scan it to redirect any $ref in it so that they are relative
     * to the current API document, then extract the API element
     * at the fragment and return it.
     *
     * If the `GET /heath` operation in root.yaml
     *
     * ```
     * /health:
     *   get:
     *     operationId: apiHealth
     *     description: Return API Health
     *     tags:
     *       - Health
     *     responses:
     *       '200':
     *         description: OK. The API is alive and active.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#/components/schemas/health'
     * ```
     *
     * the result will be
     *
     * ```
     * /health:
     *   get:
     *     operationId: apiHealth
     *     description: Return API Health
     *     tags:
     *       - Health
     *     responses:
     *       '200':
     *         description: OK. The API is alive and active.
     *         content:
     *           application/json:
     *             schema:
     *               $ref: '#../root.yaml/components/schemas/health'
     * ```
     *
     * Note that the `$ref` to the `health` schema, which was a local `#/...` reference
     * within `../root.yaml`,  was re-written as a remote `$ref` to the `health`
     * schema in that document, because `health` does not (yet) exist in the target
     * API document. However, that `$ref` will get resolved in a later stage.
     *
     * @param normalizedRefUrl the URL in the `$ref` object after normalizing it against the URL of the current target API document
     * @param refObject the `$ref` object
     * @param reference the $ref value
     * @param nav where in the API document the refObject resides
     * @returns the updated JSON item (usually an object, but may be an array or primitive)
     */
    private async processOtherReplacement(
        normalizedReferenceUrl: URL,
        referenceObject: ReferenceObject,
        reference: string,
        nav: JsonNavigation,
    ): Promise<JsonItem> {
        assert(normalizedReferenceUrl.hash);
        assert(!ApiReferenceResolver.COMPONENT_REGEXP.test(normalizedReferenceUrl.hash));

        const seen = this.replacementRefFor(reference);

        if (seen) {
            referenceObject.$ref = seen;

            return referenceObject;
        }

        const { api, itemPath } = await this.api(normalizedReferenceUrl);
        const urlNoFragment = urlNonFragment(normalizedReferenceUrl);
        const baseUrl = new URL(urlNoFragment.href, this.url);

        // await this.rewriteRefFragments(baseUrl, api, nav);  // always call this before rewriteRefPaths
        await this.rewriteRefPaths(baseUrl, api);

        const item = apiItem(api, itemPath);
        const resolvedReference = normalizedReferenceUrl.hash;

        this.rememberReplacementForRef(reference, resolvedReference);
        this.tag(item, normalizedReferenceUrl, nav);

        return this.mergeRefObject(referenceObject, item);
    }

    private async refResolvingVisitor(referenceObject: ReferenceObject, nav: JsonNavigation): Promise<JsonItem> {
        const reference = referenceObject.$ref as string;

        // console.log(`seen $ref ${ref} at path ${nav.toJsonPointer()}`);
        if (reference.startsWith("#")) {
            return referenceObject;
        }

        const replacementReference = this.replacementRefFor(reference);

        if (replacementReference) {
            referenceObject.$ref = replacementReference;

            return referenceObject;
        }

        // below process*Replacement operations will inline content
        // that must be resolved again with a second scan in resolve()
        this.changed = true;

        const url = this.relativeUrl(reference);
        const fragment = urlFragment(url);

        if (!fragment) {
            return await this.processFullReplacement(url, referenceObject, nav);
        }

        if (ApiReferenceResolver.COMPONENT_REGEXP.test(fragment)) {
            return await this.processComponentReplacement(url, referenceObject, nav);
        }

        return await this.processOtherReplacement(url, referenceObject, reference, nav);
    }

    /**
     * Construct a URL to the reference `ref` relative to a base URL.
     * @param reference a `$ref` reference path to an API element, such as
     * and absolute URL `https://host/path/to/resource.json` or a relative
     * URL such as '../alt-path/resource.yaml`
     * @param baseUrl the base URL from which a relative path is resolved.
     * If not passed, use `this.url`
     * @returns the URL of the referenced API object
     */
    private relativeUrl(reference: string, baseUrl?: string) {
        if (reference.startsWith("http:") || reference.startsWith("https:")) {
            return new URL(reference);
        }

        return new URL(reference, baseUrl ?? this.url.href);
    }

    /**
     * Remember that `ref` should now be replaced with `replacementRef`.
     * Look up replacements with `replacementRefRef(reference)`.
     * @param reference an external `$ref` URI that has been resolved
     * @param replacementRef the new reference. It could be relative
     * to the current document (`#/components/schemas/mySchema`)
     * or it could be a ref in another API document
     * (`../apis/other.yaml#/components/schemas/mySchema` or
     * `https://api.eample.com/apis/other.yaml#/components/schemas/mySchema`)
     */
    private rememberReplacementForRef(reference: string, replacementReference: string) {
        assert(!this.resolvedRefToRefMap[reference], `ref ${reference} already has a replacement, ${this.resolvedRefToRefMap[reference]}`);

        this.note(`Replace $ref URL ${reference} with ${replacementReference}`);
        this.resolvedRefToRefMap[reference] = ApiReferenceResolver.deepClone(replacementReference);
    }

    /**
     * @param reference a `$ref` URI
     * @returns the replacement `$ref` to a previously process/resolved `$ref` string
     */
    private replacementRefFor(reference: string): string | undefined {
        return this.resolvedRefToRefMap[reference];
    }

    /**
     * Process a JSON document, updating all of its '#/....' local `$ref` objects  to
     * the location it was embedded in the target ApAPI document.
     * @param documentUrl the normalized URL of the  document being scanned, such as `'file://path/to/apis/models/b.yaml'`
     * in the example.
     * @param api A JSON object that was read from a URL or file
     * @param nav Points to where we are in the containing API document.
     * We extract a fragment from this and insert that as a prefix in the
     * local REF urls. For example, if `nav` is at `/paths/~1health/get`
     * we will insert `/paths/~1health/get` before any `#/...` `$ref` objects.
     */
    private async rewriteRefFragments(documentUrl: URL, api: ApiObject, nav: JsonNavigation) {
        const nonFragmentUrl = urlNonFragment(documentUrl);

        if (this.areRefsAlreadyRewritten(nonFragmentUrl, "fragment")) {
            return;
        }

        const prefix = nav.asFragment();
        const referenceRewriteVisitor = async (node: ReferenceObject): Promise<Node> => {
            const reference = node.$ref;

            if (reference.startsWith("#")) {
                node.$ref = `${prefix}${reference.slice(1)}`;
            }

            return node;
        };

        await visitReferenceObjects(api, referenceRewriteVisitor);

        this.markRefsAlreadyRewritten(nonFragmentUrl, "fragment");
    }

    /**
     * Process a JSON API document, updating all of its `$ref` objects
     * to be relative to the document URL where we read the document.
     * For example, consider `/path/to/apis/api-a/api.yaml` which has a `{ $ref: "../models/b.yaml#/components/schemas/thing" }
     * and `b.yaml` contains `{ $ref: "./c.yaml#/components/schemas/anotherThing" }`,
     * when we resolve the $ref in `a.yaml` and load `../models/b.yaml`
     * the reference from `b.yaml` must be changed
     * to `../c.yaml#/components/schemas/anotherThing` so that it is a correct `$ref` in the
     * context of `a.yaml`. Similarly, local refs such as `"#/components/schemas/thing"`
     * are rewritten as `"../c.yaml#/components/schemas/thing"`
     * TODO: Presently, this uses absolute URLs, but for files the href should be relative to the current file.
     * @param documentUrl the normalized URL of the  document being scanned, such as `'file://path/to/apis/models/b.yaml'`
     * in the example.
     * @param api An API object that was read from `url`
     */
    private async rewriteRefPaths(documentUrl: URL, api: ApiObject) {
        const nonFragmentUrl = urlNonFragment(documentUrl);

        if (this.areRefsAlreadyRewritten(nonFragmentUrl, "path")) {
            return;
        }

        const referenceRewriteVisitor = async (node: ReferenceObject): Promise<Node> => {
            // TODO: fix this to use relative URLs, not absolute URLs.
            const referenceNormalizedUrl = new URL(node.$ref, nonFragmentUrl);

            node.$ref = referenceNormalizedUrl.href;

            return node;
        };

        await visitReferenceObjects(api, referenceRewriteVisitor);

        this.markRefsAlreadyRewritten(nonFragmentUrl, "path");
    }

    private tag(item: JsonItem | undefined, normalizedReferenceUrl: URL, nav: JsonNavigation | undefined, tagDateTime = false) {
        if (item != null && typeof item === "object") {
            const taggable = nav === undefined || this.taggable(item, nav);

            if (taggable) {
                item[ApiReferenceResolver.RESOLVED_FROM_MARKER] = normalizedReferenceUrl.href;

                if (tagDateTime) {
                    item[ApiReferenceResolver.RESOLVED_AT_MARKER] = this.dateTime;
                }
            }

            item[ApiReferenceResolver.TEMPORARY_MARKER] = true; // temporary marker to be removed
        }
    }

    /**
     * Indicate if the location is taggable.
     * The location is taggable if not a $ref object or it's nav is a schema.
     * (OpenAPI does not allow x- specification extension in reference objects,
     * but JSON Schema does.)
     * @param nav the navigation to the current location
     * @returns if the object at this spot can be tagged with an x-resolved-from marker
     */
    private taggable(item: JsonItem, nav: JsonNavigation): boolean {
        if (isReference(item)) {
            const path = nav.path();

            return path.length > 2 && ((path[0] === "components" && path[1] === "schemas") || path.includes("schema"));
        }

        return true;
    }

    /**
     * Read an API document
     * @param uri The string or URL of then API document to read
     * @returns the object at that URL and optionally an API element
     * at the fragment from the API document
     */
    public async api(uri: URL | string): Promise<ApiResource> {
        const url = typeof uri === "string" ? pathToFileURL(uri) : uri;
        const urlKey = urlNonFragment(url);
        const fragment = urlFragment(url);
        const itemPath = fragment ? JsonNavigation.asKeys(fragment) : undefined;

        let api = this.urlToApiObjectMap[urlKey.href];

        if (api) {
            return {
                api,
                fragment,
                itemPath,
                url,
            };
        }

        const text = url.protocol === "file:" ? await readFromFile(url) : await readFromUrl(url);

        api = load(text, { filename: url.href, schema: JSON_SCHEMA });

        // Cache the api object by the URL
        this.urlToApiObjectMap[urlKey.href] = api;
        this.note(`loaded API document from ${url.href}`);

        return {
            api,
            fragment,
            itemPath,
            url: urlKey,
        };
    }

    public async resolve(options?: ApiReferenceOptions): Promise<ApiReferenceResolution> {
        // this.urlProtocol = this.url.protocol;
        this.options = options ?? {};

        if (!this.apiDocument) {
            const apiResource = await this.api(this.url);
            this.apiDocument = apiResource.api;
        }

        if (this.apiDocument["x-resolved-from"]) {
            return { api: this.apiDocument, options: this.options };
        }

        this.urlToApiObjectMap[this.url.href] = this.apiDocument;

        const referenceVisitor: ReferenceVisitor = async (node: ReferenceObject, nav: JsonNavigation) => await this.refResolvingVisitor(node, nav);

        this.changed = true;

        let pass = 0;

        while (this.changed) {
            pass += 1;

            this.changed = false;
            this.apiDocument = (await visitReferenceObjects(this.apiDocument, referenceVisitor)) as ApiObject;

            if (this.changed) {
                this.note(`Pass ${pass} of resolve() resulted in changed $ref. Starting next pass.`);
            }
        }

        this.tag(this.apiDocument, this.url, undefined, true);
        this.apiDocument = await this.cleanup(this.apiDocument);

        return { api: this.apiDocument, options: this.options };
    }
}

export default ApiReferenceResolver;
