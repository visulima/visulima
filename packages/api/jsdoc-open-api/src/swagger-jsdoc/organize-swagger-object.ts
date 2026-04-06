import { isTagPresentInTags, mergeDeep } from "./utils";

/**
 * @param {object} swaggerObject
 * @param {object} annotation
 * @param {string} property
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const organizeSwaggerObject = (swaggerObject: Record<string, any>, annotation: Record<string, any>, property: string): void => {
    // Root property on purpose.
    // eslint-disable-next-line no-secrets/no-secrets
    // @see https://github.com/OAI/OpenAPI-Specification/blob/master/proposals/002_Webhooks.md#proposed-solution
    if (property === "x-webhooks") {
        // eslint-disable-next-line no-param-reassign,@typescript-eslint/no-unsafe-assignment
        swaggerObject[property] = annotation[property];
    }

    // Other extensions can be in varying places depending on different vendors and opinions.
    // The following return makes it so that they are not put in `paths` in the last case.
    // New specific extensions will need to be handled on case-by-case if to be included in `paths`.
    if (property.startsWith("x-")) {
        return;
    }

    const commonProperties = [
        "components",
        "consumes",
        "produces",
        "paths",
        "schemas",
        "securityDefinitions",
        "responses",
        "parameters",
        "definitions",
        "channels",
    ];

    if (commonProperties.includes(property)) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        Object.keys(annotation[property]).forEach((definition) => {
            // eslint-disable-next-line no-param-reassign,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
            swaggerObject[property][definition] = mergeDeep(swaggerObject[property][definition], annotation[property][definition]);
        });
    } else if (property === "tags") {
        const { tags } = annotation;

        if (Array.isArray(tags)) {
            tags.forEach((tag) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                if (!isTagPresentInTags(tag, swaggerObject.tags)) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
                    swaggerObject.tags.push(tag);
                }
            });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
        } else if (!isTagPresentInTags(tags, swaggerObject.tags)) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
            swaggerObject.tags.push(tags);
        }
    } else if (property === "security") {
        const { security } = annotation;

        // eslint-disable-next-line no-param-reassign,@typescript-eslint/no-unsafe-assignment
        swaggerObject.security = security;
    } else if (property.startsWith("/")) {
        // Paths which are not defined as "paths" property, starting with a slash "/"
        // eslint-disable-next-line no-param-reassign,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
        swaggerObject.paths[property] = mergeDeep(swaggerObject.paths[property], annotation[property]);
    }
};

export default organizeSwaggerObject;
