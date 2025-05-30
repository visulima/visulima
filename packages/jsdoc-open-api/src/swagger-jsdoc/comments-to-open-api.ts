import type { Spec } from "comment-parser";
import { parse as parseComments } from "comment-parser";
// eslint-disable-next-line no-restricted-imports
import mergeWith from "lodash.mergewith";
import type { YAMLError } from "yaml";
import yaml from "yaml";

import type { OpenApiObject } from "../exported";
import customizer from "../util/customizer";
import organizeSwaggerObject from "./organize-swagger-object";
import { getSwaggerVersionFromSpec, hasEmptyProperty } from "./utils";

const specificationTemplate = {
    v2: ["paths", "definitions", "responses", "parameters", "securityDefinitions"],
    v3: ["paths", "definitions", "responses", "parameters", "securityDefinitions", "components"],
    v4: ["components", "channels"],
};

// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents,perfectionist/sort-intersection-types
type ExtendedYAMLError = YAMLError & { annotation?: string };

const tagsToObjects = (specs: Spec[], verbose?: boolean) =>
    specs.map((spec: Spec) => {
        if ((spec.tag === "openapi" || spec.tag === "swagger" || spec.tag === "asyncapi") && spec.description !== "") {
            const parsed = yaml.parseDocument(spec.description);

            if (parsed.errors.length > 0) {
                parsed.errors.map<ExtendedYAMLError>((error) => {
                    const newError: ExtendedYAMLError = error;

                    newError.annotation = spec.description;

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                    return newError as ExtendedYAMLError;
                });

                let errorString = "Error parsing YAML in @openapi spec:";

                errorString += (verbose
                    ? (parsed.errors as ExtendedYAMLError[])
                          .map((error) => `${(error as ExtendedYAMLError).toString() as string}\nImbedded within:\n\`\`\`\n  ${(error as ExtendedYAMLError).annotation?.replace(/\n/gu, "\n  ") as string}\n\`\`\``)
                          .join("\n")
                    : // eslint-disable-next-line @typescript-eslint/no-unsafe-return
                      parsed.errors.map((error) => error.toString()).join("\n")) as string;

                throw new Error(errorString);
            }

            const parsedDocument = parsed.toJSON();
            const specification: Record<string, any> = {
                tags: [],
            };

            specificationTemplate[getSwaggerVersionFromSpec(spec)].forEach((property) => {
                specification[property] = specification[property] || {};
            });

            Object.keys(parsedDocument).forEach((property) => {
                organizeSwaggerObject(specification, parsedDocument, property);
            });

            return specification;
        }

        return {};
    });

const commentsToOpenApi = (fileContents: string, verbose?: boolean): { loc: number; spec: OpenApiObject }[] => {
    const jsDocumentComments = parseComments(fileContents, { spacing: "preserve" });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return jsDocumentComments.map((comment) => {
        // Line count, number of tags + 1 for description.
        // - Don't count line-breaking due to long descriptions
        // - Don't count empty lines
        const loc = (comment.tags.length as number) + 1;
        const result = mergeWith({}, ...tagsToObjects(comment.tags, verbose), customizer);

        ["definitions", "responses", "parameters", "securityDefinitions", "components", "tags"].forEach((property) => {
            if (result[property] !== undefined && hasEmptyProperty(result[property])) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete result[property];
            }
        });

        // Purge all undefined objects/arrays.
        const spec = JSON.parse(JSON.stringify(result));

        return {
            loc,
            spec,
        };
    });
};

export default commentsToOpenApi;
