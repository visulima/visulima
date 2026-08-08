import { readFileSync } from "node:fs";
import path from "node:path";

import { parse as parseYaml } from "@visulima/yaml";

import type { BaseDefinition } from "../exported";

const parseFile = (file: string): BaseDefinition => {
    const extension = path.extname(file);

    if (extension !== ".yaml" && extension !== ".yml" && extension !== ".json") {
        throw new Error("OpenAPI definition path must be YAML or JSON.");
    }

    const fileContent = readFileSync(file, { encoding: "utf8" });

    if (extension === ".yaml" || extension === ".yml") {
        return parseYaml(fileContent) as BaseDefinition;
    }

    return JSON.parse(fileContent) as BaseDefinition;
};

export default parseFile;
