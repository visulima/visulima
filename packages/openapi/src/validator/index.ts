import { readFileSync } from "node:fs";
import { URL, fileURLToPath } from "node:url";
import Ajv04 from "ajv-draft-04";
import addFormats from "ajv-formats";
import Ajv2020 from "ajv/dist/2020";
import { readFile } from "node:fs/promises";
import { JSON_SCHEMA, load } from "js-yaml";

import { resolve } from "./resolve";

const openApiVersions = new Set(["2.0", "3.0", "3.1"]);
const ajvVersions = {
    "http://json-schema.org/draft-04/schema#": Ajv04,
    "https://json-schema.org/draft/2020-12/schema": Ajv2020,
};
const inlinedReferences = "x-inlined-refs";

function localFile(fileName) {
    return fileURLToPath(new URL(fileName, import.meta.url));
}

function importJSON(file) {
    return JSON.parse(readFileSync(localFile(file)));
}

function getOpenApiVersion(specification) {
    for (const version of openApiVersions) {
        const specificationType = version === "2.0" ? "swagger" : "openapi";
        const property = specification[specificationType];
        if (typeof property === "string" && property.startsWith(version)) {
            return {
                specificationType,
                specificationVersion: property,
                version,
            };
        }
    }
    return {
        specificationType: undefined,
        specificationVersion: undefined,
        version: undefined,
    };
}

async function getSpecFromData(data) {
    const yamlOptions = { schema: JSON_SCHEMA };
    if (typeof data === "object") {
        return data;
    }
    if (typeof data === "string") {
        if (data.includes("\n")) {
            try {
                return load(data, yamlOptions);
            } catch {
                return undefined;
            }
        }
        try {
            const fileData = await readFile(data, "utf-8");
            return load(fileData, yamlOptions);
        } catch {
            return undefined;
        }
    }
    return undefined;
}

export class Validator {
    static supportedVersions = openApiVersions;

    constructor(ajvOptions = {}) {
        // AJV is a bit too strict in its strict validation of openAPI schemas
        // so switch strict mode and validateFormats off
        if (ajvOptions.strict !== "log") {
            ajvOptions.strict = false;
        }
        this.ajvOptions = ajvOptions;
        this.ajvValidators = {};
        this.externalRefs = {};
    }

    async addSpecRef(data, uri) {
        const spec = await getSpecFromData(data);
        if (spec === undefined) {
            throw new Error("Cannot find JSON, YAML or filename in data");
        }

        const newUri = uri || spec.$id;
        if (typeof newUri !== "string") {
            throw new TypeError("uri parameter or $id attribute must be a string");
        }

        spec.$id = newUri;
        this.externalRefs[newUri] = spec;
    }

    getAjvValidator(version) {
        if (!this.ajvValidators[version]) {
            const schema = importJSON(`./schemas/v${version}/schema.json`);
            const schemaVersion = schema.$schema;
            const AjvClass = ajvVersions[schemaVersion];
            const ajv = new AjvClass(this.ajvOptions);
            addFormats(ajv);
            ajv.addFormat("media-range", true); // used in 3.1
            this.ajvValidators[version] = ajv.compile(schema);
        }
        return this.ajvValidators[version];
    }

    resolveRefs(options = {}) {
        return resolve(this.specification || options.specification);
    }

    async validate(data) {
        const specification = await getSpecFromData(data);
        this.specification = specification;
        if (specification === undefined || specification === null) {
            return {
                errors: "Cannot find JSON, YAML or filename in data",
                valid: false,
            };
        }
        if (Object.keys(this.externalRefs).length > 0) {
            specification[inlinedReferences] = this.externalRefs;
        }
        const { specificationType, specificationVersion, version } = getOpenApiVersion(specification);
        this.version = version;
        this.specificationVersion = specificationVersion;
        this.specificationType = specificationType;
        if (!version) {
            return {
                errors: "Cannot find supported swagger/openapi version in specification, version must be a string.",
                valid: false,
            };
        }
        const validate = this.getAjvValidator(version);
        const result = {
            valid: validate(specification),
        };
        if (validate.errors) {
            result.errors = validate.errors;
        }
        return result;
    }
}
