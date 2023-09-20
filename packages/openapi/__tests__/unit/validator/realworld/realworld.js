// test the validator against the APIs of https://apis.guru
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { JSON_SCHEMA, load } from "js-yaml";
import { argv, exit } from "node:process";
import { Validator } from "../..";
import { createReport } from "./createReport.js";

const importJSON = createRequire(import.meta.url);
const localFile = (fileName) => new URL(fileName, import.meta.url).pathname;
const validator = new Validator();
const yamlOptions = { schema: JSON_SCHEMA };
const failedFile = localFile("./failed.json");
const reportFile = localFile("./failed.md");
const newFailedFile = localFile("./failed.updated.json");
const newReportFile = localFile("./failed.updated.md");
const defaultPercentage = 10;
const failedMap = loadFailedData(failedFile);

function loadFailedData(fileName) {
    const dataMap = new Map();
    try {
        const data = importJSON(fileName);
        data.failedTests = data.failedTests || [];
        data.failedTests.forEach((item) => dataMap.set(item.name, item));
        return dataMap;
    } catch {
        return dataMap;
    }
}

function sample(fullMap, percentage) {
    const { floor, random } = Math;
    const length_ = fullMap.size;
    const size = floor(length_ * (percentage / 100));
    const sampleMap = new Map();
    const mapKeys = [...fullMap.keys()];
    for (let index = 0; index < size; index++) {
        let index;
        let key;
        do {
            index = floor(random() * length_);
            key = mapKeys[index];
        } while (sampleMap.has(key));

        sampleMap.set(key, fullMap.get(key));
    }
    return sampleMap;
}

function unescapeJsonPointer(string_) {
    return string_.replaceAll("~1", "/").replaceAll("~0", "~");
}

function escapeRegExp(string) {
    return string.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

function makeRexp(pathItem) {
    const res = unescapeJsonPointer(pathItem);
    return escapeRegExp(res);
}

function yamlLine(yamlSpec, path) {
    const lines = yamlSpec.split("\n");
    const paths = path.split("/").slice(1);
    let number_ = 0;
    for (const pathItem of paths) {
        number_ = Number.isInteger(+pathItem) && number_ ? findArrayItem(lines, number_, pathItem) : findItem(lines, number_, pathItem);
    }
    return number_ + 1;
}

function findArrayItem(lines, number_, pathIndex) {
    if (number_ > lines.length - 2) {
        return number_;
    }
    const firstItem = lines[number_ + 1];
    const match = firstItem.match(/^\s*-/);
    if (match === null) {
        // it was not an array index, but a key
        return findItem(lines, number_, pathIndex);
    }
    const prefix = match[0];
    let lineNumber = number_;
    let pathIndexCtr = pathIndex;
    while (pathIndexCtr > 0) {
        lineNumber++;
        if (lines[lineNumber].startsWith(prefix)) {
            pathIndexCtr--;
        }
    }
    return lineNumber + 1;
}

function findItem(lines, number_, pathItem) {
    let lineNumber = number_;
    const token = new RegExp(`^\\s*"?${makeRexp(pathItem)}"?:`);
    const maxNumber = lines.length - 1;
    while (!lines[lineNumber].match(token) && lineNumber < maxNumber) {
        lineNumber++;
    }
    return lineNumber;
}

function getInstanceValue(yamlSpec, path) {
    if (path === "") {
        return [false, "content too large to display here"];
    }
    const object = load(yamlSpec, yamlOptions);
    const paths = path.split("/").slice(1);
    const result = paths.reduce((o, n) => o[unescapeJsonPointer(n)], object);
    return [true, result];
}

function yamlToGitHub(url) {
    return url.replace("https://api.apis.guru/v2/specs/", "https://github.com/APIs-guru/openapi-directory/blob/main/APIs/");
}

async function fetchApiList(percentage, onlyFailed = false) {
    const response = await fetch("https://api.apis.guru/v2/list.json");

    if (!response.ok) {
        throw new Error("Unable to download real-world APIs from apis.guru");
    }
    const apiList = await response.json();
    const apiListSize = Object.keys(apiList).length;
    const apiMap = new Map();
    for (const key in apiList) {
        if (!onlyFailed || failedMap.has(key)) {
            const api = apiList[key];
            const latestVersion = api.versions[api.preferred];
            apiMap.set(key, {
                apiVersion: api.preferred,
                gitHubUrl: yamlToGitHub(latestVersion.swaggerYamlUrl),
                jsonUrl: latestVersion.swaggerUrl,
                name: key,
                openApiVersion: latestVersion.openapiVer,
                updated: latestVersion.updated,
                yamlUrl: latestVersion.swaggerYamlUrl,
            });
        }
    }
    if (percentage !== 100) {
        console.log(`testing a random set containing ${percentage}% of ${apiMap.size} available APIs`);
        return [sample(apiMap, percentage), apiListSize, apiMap.size];
    }
    console.log(`testing ${apiMap.size} of ${apiListSize} available APIs`);
    return [apiMap, apiListSize, apiMap.size];
}

async function fetchYaml(url) {
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Unable to download ${url}`);
    }
    return await response.text();
}

function writeReport(ci, totalSize, results, failed) {
    const jsonFile = ci ? failedFile : newFailedFile;
    const mdFile = ci ? reportFile : newReportFile;
    const data = {
        failedAPICount: results.invalid,
        failedTests: [...failed.values()],
        knownFailedCount: results.knownFailed,
        testDate: new Date().toISOString(),
        testedAPICount: results.total,
        totalApiCount: totalSize,
    };
    console.log("new/updated failures found");
    console.log(`creating ${jsonFile}`);
    writeFileSync(jsonFile, JSON.stringify(data, null, "\t"), "utf8");
    console.log(`creating new report ${mdFile}`);
    writeFileSync(mdFile, createReport(data), "utf8");
}

async function doTest(apiList) {
    const failed = new Map();
    const results = {
        current: 0,
        invalid: 0,
        knownFailed: 0,
        total: apiList.size,
        valid: 0,
    };
    for (const [name, api] of apiList) {
        const spec = await fetchYaml(api.yamlUrl);
        results.current++;
        api.result = await validator.validate(spec);
        api.validatorVersion = validator.version;
        api.specificationType = validator.specificationType;
        api.specificationVersion = validator.specificationVersion;
        if (api.result.valid === true) {
            results.valid++;
        } else {
            results.invalid++;
            api.result.errors.map((item) => {
                const [res, value] = getInstanceValue(spec, item.instancePath);
                item.hasInstanceValue = res;
                item.instanceValue = value;
                item.gitHubUrl = `${api.gitHubUrl}#L${yamlLine(spec, item.instancePath)}`;
            });
            if (failedMap.has(name)) {
                const failedApiErrors = JSON.stringify(failedMap.get(name).result.errors);
                if (failedApiErrors === JSON.stringify(api.result.errors)) {
                    results.knownFailed++;
                    api.knownFailed = true;
                }
            }
            failed.set(name, api);
        }
        console.log(JSON.stringify(results), name);
    }
    return { failed, results };
}

async function testAPIs(testPercentage, onlyFailed, ci) {
    let percentage = testPercentage;
    if (onlyFailed || ci) {
        percentage = 100;
    }
    const [apiList, totalSize, latestSize] = await fetchApiList(percentage, onlyFailed);
    const { failed, results } = await doTest(apiList);
    console.log(
        `Finished testing ${results.total} APIs
     ${results.invalid} tests failed of which ${results.knownFailed} were known failures`,
    );
    if (failedMap.size !== results.knownFailed || results.knownFailed !== results.invalid || (onlyFailed && results.invalid !== results.total)) {
        const exitCode = ci ? 0 : 1;
        if (percentage === 100) {
            writeReport(ci, totalSize, results, failed);
        }
        process.exit(exitCode);
    }
}

function parseArguments() {
    const arguments_ = argv.slice(2);
    const parameters_ = new Set();
    const options = ["failedOnly", "all", "ci"];
    arguments_.forEach((argument) => {
        options.forEach((opt) => {
            if (`--${opt}`.startsWith(argument)) {
                parameters_.add(opt);
            }
        });
    });
    if (parameters_.size !== arguments_.length) {
        console.log(`
        usage: ${argv[1].split("/").pop()} [--failedOnly] [--all]
        where:
        --failedOnly will only try all APIs that have previously been found failing
        --all will test all APIs on the list, by default only ${defaultPercentage}% of APIs will be tested.
        --ci switch to ci mode
        `);
        exit(1);
    }
    return parameters_;
}

const parameters = parseArguments();
const failedOnly = parameters.has("failedOnly");
const percentage = parameters.has("all") ? 100 : defaultPercentage;
if (parameters.has("ci")) {
    console.log("Working in CI mode, overwriting results if anything changed");
}
testAPIs(percentage, failedOnly, parameters.has("ci"));
