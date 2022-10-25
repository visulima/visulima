import type { Spec } from "comment-parser";
import { parse as parseComments } from "comment-parser";
import mergeWith from "lodash.mergewith";
import yaml, { YAMLError } from "yaml";

import { OpenApiObject } from "../exported";
import customizer from "../util/customizer";
import organizeSwaggerObject from "./organize-swagger-object";
import { getSwaggerVersionFromSpec, hasEmptyProperty } from "./utils";

const specificationTemplate = {
    v2: ["paths", "definitions", "responses", "parameters", "securityDefinitions"],
    v3: ["paths", "definitions", "responses", "parameters", "securityDefinitions", "components"],
    v4: ["components", "channels"],
};

type ExtendedYAMLError = YAMLError & { annotation?: string };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const tagsToObjects = (specs: Spec[], verbose?: boolean) => specs.map((spec: Spec) => {
    if ((spec.tag === "openapi" || spec.tag === "swagger" || spec.tag === "asyncapi") && spec.description !== "") {
        const parsed = yaml.parseDocument(spec.description);

        if (parsed.errors && parsed.errors.length > 0) {
            parsed.errors.map<ExtendedYAMLError>((error) => {
                const newError: ExtendedYAMLError = error;

                newError.annotation = spec.description;

                return newError;
            });

            let errorString = "Error parsing YAML in @openapi spec:";

            errorString += verbose
                ? (parsed.errors as ExtendedYAMLError[])
                    .map((error) => `${error.toString()}\nImbedded within:\n\`\`\`\n  ${error?.annotation?.replace(/\n/g, "\n  ")}\n\`\`\``)
                    .join("\n")
                : parsed.errors.map((error) => error.toString()).join("\n");

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

const commentsToOpenApi = (fileContents: string, verbose?: boolean): { spec: OpenApiObject; loc: number }[] => {
    const jsDocumentComments = parseComments(fileContents, { spacing: "preserve" });

    return jsDocumentComments.map((comment) => {
        // Line count, number of tags + 1 for description.
        // - Don't count line-breaking due to long descriptions
        // - Don't count empty lines
        const loc = comment.tags.length + 1;
        const result = mergeWith({}, ...tagsToObjects(comment.tags, verbose), customizer);

        ["definitions", "responses", "parameters", "securityDefinitions", "components", "tags"].forEach((property) => {
            if (typeof result[property] !== "undefined" && hasEmptyProperty(result[property])) {
                delete result[property];
            }
        });

        // Purge all undefined objects/arrays.
        const spec = JSON.parse(JSON.stringify(result));

        return {
            spec,
            loc,
        };
    });
};

export default commentsToOpenApi;
