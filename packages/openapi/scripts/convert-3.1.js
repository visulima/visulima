import { readFileSync, readdirSync, writeFileSync } from "node:fs";

function localPath(path) {
    return new URL(path, import.meta.url).pathname;
}
const openApiSrcDir = localPath("../schemas.orig");
const openApiDestDir = localPath("../schemas");
const version = "3.1";
const destinationFilePath = `${openApiDestDir}/v${version}/schema.json`;

function importJSON(file) {
    return JSON.parse(readFileSync(file));
}

function getLatestSchema(version) {
    const sourcePath = `${openApiSrcDir}/${version}/schema/`;
    const schemaList = readdirSync(sourcePath);
    const lastSchema = schemaList.pop();
    return importJSON(`${sourcePath}/${lastSchema}`);
}

function escapeJsonPointer(string_) {
    return string_.replaceAll('~', "~0").replaceAll('/', "~1");
}

const isObject = (object) => typeof object === "object" && object !== null;

const pointerWords = new Set(["$dynamicRef", "$dynamicAnchor"]);

const pointers = {};
for (const word of pointerWords) {
    pointers[word] = [];
}

function parse(object, path, id) {
    if (!isObject(object)) {
        return;
    }
    const objectId = object.$id || id;

    for (const property in object) {
        if (pointerWords.has(property)) {
            pointers[property].push({ obj: object, objId: objectId, path, prop: property, ref: object[property] });
        }
        parse(object[property], `${path}/${escapeJsonPointer(property)}`, objectId);
    }
}
const schema = getLatestSchema(version);
// find all refs
parse(schema, "#", "");
const dynamicAnchors = {};
pointers.$dynamicAnchor.forEach((item) => {
    const { path, prop, ref } = item;
    console.log({ path, prop, ref });
    dynamicAnchors[`#${ref}`] = path;
});
pointers.$dynamicRef.forEach((item) => {
    const { obj, path, prop, ref } = item;
    if (!dynamicAnchors[ref]) {
        throw `Can't find $dynamicAnchor for '${ref}'`;
    }
    console.log({ newRef: dynamicAnchors[ref], path, prop, ref });
    obj[prop] = undefined;
    obj.$ref = dynamicAnchors[ref];
});

writeFileSync(`${destinationFilePath}`, JSON.stringify(schema, null, "\t"));
console.log(`Written converted schema to ${destinationFilePath}`);
console.log(`$id: ${schema.$id}`);
