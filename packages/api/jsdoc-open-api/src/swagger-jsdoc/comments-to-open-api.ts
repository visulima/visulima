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
        const hasContent = spec.description !== "" || spec.name.startsWith("/") || spec.name.endsWith(":");

        if ((spec.tag === "openapi" || spec.tag === "swagger" || spec.tag === "asyncapi") && hasContent) {
            // Combine name and description if name is a path (starts with "/") or a top-level property (ends with ":")
            let yamlContent = spec.description;

            if (spec.name.startsWith("/") || spec.name.endsWith(":")) {
                // If description starts with newlines, preserve them; otherwise add one newline
                yamlContent = yamlContent.trim() === "" ? spec.name : `${spec.name}\n${yamlContent}`;
            }

            const parsed = yaml.parseDocument(yamlContent);

            if (parsed.errors.length > 0) {
                parsed.errors.forEach((error) => {
                    // eslint-disable-next-line no-param-reassign
                    (error as ExtendedYAMLError).annotation = yamlContent;
                });

                let errorString = "Error parsing YAML in @openapi spec:";

                errorString += verbose
                    ? (parsed.errors as ExtendedYAMLError[])
                        .map((error) => `${error.toString()}\nImbedded within:\n\`\`\`\n  ${error.annotation?.replaceAll("\n", "\n  ") as string}\n\`\`\``)
                        .join("\n")
                    : parsed.errors.map((error) => error.toString()).join("\n");

                throw new Error(errorString);
            }

            const parsedDocument = parsed.toJSON();
            const specification: Record<string, any> = {
                tags: [],
            };

            specificationTemplate[getSwaggerVersionFromSpec(spec)].forEach((property) => {
                specification[property] = specification[property] ?? {};
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

    return jsDocumentComments.map((comment) => {
        // Line count, number of tags + 1 for description.
        // - Don't count line-breaking due to long descriptions
        // - Don't count empty lines
        const loc = comment.tags.length + 1;
        const result = mergeWith({}, ...tagsToObjects(comment.tags, verbose), customizer);

        ["definitions", "responses", "parameters", "securityDefinitions", "components", "tags"].forEach((property) => {
            if (result[property] !== undefined && hasEmptyProperty(result[property])) {
                // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
                delete result[property];
            }
        });

        // Purge all undefined properties — the JSON roundtrip drops them.
        // eslint-disable-next-line unicorn/prefer-structured-clone
        const spec = JSON.parse(JSON.stringify(result));

        return {
            loc,
            spec,
        };
    });
};

export default commentsToOpenApi;
