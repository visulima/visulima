import yaml from "yaml";
import type { OpenAPIV2, OpenAPIV3, OpenAPIV3_1 } from "openapi-types";

import yamlLoc from "./yaml-loc";

const ALLOWED_KEYS = new Set(["swagger", "openapi", "info", "servers", "security", "tags", "externalDocs", "components", "paths"]);

const parseYaml = (
    yamlString: string,
):
    | {
          loc: number;
          spec: OpenAPIV2.Document | OpenAPIV3_1.Document | OpenAPIV3.Document;
      }
    | undefined => {
    const spec = yaml.parse(yamlString);

    if (Object.keys(spec).some((key) => ALLOWED_KEYS.has(key))) {
        const loc = yamlLoc(yamlString);
        const filteredSpec = Object.fromEntries(Object.entries(spec).filter(([key]) => ALLOWED_KEYS.has(key)));

        return { loc, spec: filteredSpec as OpenAPIV2.Document | OpenAPIV3_1.Document | OpenAPIV3.Document };
    }

    return undefined;
};

export default parseYaml;
