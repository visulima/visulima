import yaml from "yaml";
import type { OpenAPIV3, OpenAPIV3_1 } from "openapi-types";
import yamlLoc from "./yaml-loc";
import ParseError from "../parse-error";

const ALLOWED_KEYS = new Set(["openapi", "info", "servers", "security", "tags", "externalDocs", "components", "paths"]);

const parseYaml = (
    yamlString: string,
    filePath: string,
): {
    loc: number;
    spec: OpenAPIV3_1.Document | OpenAPIV3.Document;
}[] => {
    const spec = yaml.parse(yamlString);
    const invalidKeys = Object.keys(spec).filter((key) => !ALLOWED_KEYS.has(key));

    if (invalidKeys.length > 0) {
        const error = new ParseError(`Unexpected keys: ${invalidKeys.join(", ")}`);

        error.filePath = filePath;

        throw error;
    }

    if (Object.keys(spec).some((key) => ALLOWED_KEYS.has(key))) {
        const loc = yamlLoc(yamlString);

        return [{ loc, spec }];
    }

    return [];
};

export default parseYaml;
