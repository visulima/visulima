import { readFileSync } from "node:fs";
import path from "node:path";
import yaml from "yaml";

import type { BaseDefinition } from "../exported.d";

function parseFile(file: string): BaseDefinition {
    const extension = path.extname(file);
    if (extension !== ".yaml" && extension !== ".yml" && extension !== ".json") {
        throw new Error("OpenAPI definition path must be YAML or JSON.");
    }

    const fileContent = readFileSync(file, { encoding: "utf8" });

    if (extension === ".yaml" || extension === ".yml") {
        return yaml.parse(fileContent);
    }

    return JSON.parse(fileContent);
}

export default parseFile;
