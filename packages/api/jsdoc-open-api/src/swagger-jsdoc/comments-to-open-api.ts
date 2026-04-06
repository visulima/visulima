import type { Spec } from "comment-parser";
import { parse as parseComments } from "comment-parser";
// eslint-disable-next-line no-restricted-imports,e18e/ban-dependencies
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

type ExtendedYAMLError = YAMLError & { annotation?: string };

const tagsToObjects = (specs: Spec[], verbose?: boolean) =>
    specs.map((spec: Spec) => {
        // Check if we have content to parse (description or name that should be combined)
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,sonarjs/different-types-comparison
        const hasContent = spec.description !== "" || (spec.name !== undefined && (spec.name.startsWith("/") || spec.name.endsWith(":")));

        if ((spec.tag === "openapi" || spec.tag === "swagger" || spec.tag === "asyncapi") && hasContent) {
            // Combine name and description if name is a path (starts with "/") or a top-level property (ends with ":")
            let yamlContent = spec.description;

            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition,sonarjs/different-types-comparison
            if (spec.name !== undefined && (spec.name.startsWith("/") || spec.name.endsWith(":"))) {
                // If description starts with newlines, preserve them; otherwise add one newline
                yamlContent = yamlContent.trim() === "" ? spec.name : `${spec.name}\n${yamlContent}`;
            }

            const parsed = yaml.parseDocument(yamlContent);

            if (parsed.errors.length > 0) {
                parsed.errors.forEach((error) => {
                    const newError: ExtendedYAMLError = error;

                    newError.annotation = yamlContent;
                });

                let errorString = "Error parsing YAML in @openapi spec:";

                errorString += (
                    verbose
                        ? (parsed.errors as ExtendedYAMLError[])
                            .map(
                                (error) =>
                                    `${error.toString()}\nImbedded within:\n\`\`\`\n  ${error.annotation?.replaceAll("\n", "\n  ") as string}\n\`\`\``,
                            )
                            .join("\n")
                        : parsed.errors.map((error) => error.toString()).join("\n")
                );

                throw new Error(errorString);
            }

            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const parsedDocument = parsed.toJSON();
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const specification: Record<string, any> = {
                tags: [],
            };

            specificationTemplate[getSwaggerVersionFromSpec(spec)].forEach((property) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment,@typescript-eslint/prefer-nullish-coalescing
                specification[property] = specification[property] || {};
            });

            // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
            Object.keys(parsedDocument).forEach((property) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                organizeSwaggerObject(specification, parsedDocument, property);
            });

            return specification;
        }

        return {};
    });

const commentsToOpenApi = (fileContents: string, verbose?: boolean): { loc: number; spec: OpenApiObject }[] => {
    const jsDocumentComments = parseComments(fileContents, { spacing: "preserve" });

    return jsDocumentComments.map((comment) => {
        // Line count, number of tags + 1 for description.
        // - Don't count line-breaking due to long descriptions
        // - Don't count empty lines
        const loc = comment.tags.length + 1;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const result = mergeWith({}, ...tagsToObjects(comment.tags, verbose), customizer);

        ["definitions", "responses", "parameters", "securityDefinitions", "components", "tags"].forEach((property) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-argument
            if (result[property] !== undefined && hasEmptyProperty(result[property])) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete,@typescript-eslint/no-unsafe-member-access
                delete result[property];
            }
        });

        // Purge all undefined objects/arrays.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const spec = structuredClone(result);

        return {
            loc,
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            spec,
        };
    });
};

export default commentsToOpenApi;
