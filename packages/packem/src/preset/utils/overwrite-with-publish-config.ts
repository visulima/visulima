import type { NormalizedPackageJson } from "@visulima/package";

// eslint-disable-next-line sonarjs/cognitive-complexity
const overwriteWithPublishConfig = (package_: NormalizedPackageJson): NormalizedPackageJson => {
    const { publishConfig } = package_;

    if (publishConfig) {
        if (publishConfig.bin && (typeof publishConfig.bin === "object" || typeof publishConfig.bin === "string")) {
            // eslint-disable-next-line no-param-reassign
            package_.bin = publishConfig.bin as NormalizedPackageJson["bin"];
        }

        if (publishConfig.type && typeof publishConfig.type === "string" && publishConfig.type !== "") {
            // eslint-disable-next-line no-param-reassign
            package_.type = publishConfig.type as NormalizedPackageJson["type"];
        }

        if (publishConfig.main && typeof publishConfig.main === "string" && publishConfig.main !== "") {
            // eslint-disable-next-line no-param-reassign
            package_.main = publishConfig.main as NormalizedPackageJson["main"];
        }

        if (publishConfig.module && typeof publishConfig.module === "string" && publishConfig.module !== "") {
            // eslint-disable-next-line no-param-reassign
            package_.module = publishConfig.module as NormalizedPackageJson["module"];
        }

        if (publishConfig.types && typeof publishConfig.types === "string" && publishConfig.types !== "") {
            // eslint-disable-next-line no-param-reassign
            package_.types = publishConfig.types as NormalizedPackageJson["types"];
        } else if (publishConfig.typings && typeof publishConfig.typings === "string" && publishConfig.typings !== "") {
            // eslint-disable-next-line no-param-reassign
            package_.typings = publishConfig.typings as NormalizedPackageJson["typings"];
        }

        if (publishConfig.exports && typeof publishConfig.exports === "object") {
            // eslint-disable-next-line no-param-reassign
            package_.exports = publishConfig.exports as NormalizedPackageJson["exports"];
        }
    }

    return package_;
};

export default overwriteWithPublishConfig;
