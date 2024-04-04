/**
 * Modified copy of https://github.com/rollup/rollup/blob/master/build-plugins/generate-license-file.ts
 *
 * The MIT License (MIT)
 *
 * Copyright (c) 2017 these people -> https://github.com/rollup/rollup/graphs/contributors
 */
import { readFileSync, writeFileSync } from "@visulima/fs";
import type { Plugin } from "rollup";
import licensePlugin from "rollup-plugin-license";

import logger from "../../../logger";

const sortLicenses = (licenses: Set<string>) => {
    const withParenthesis: string[] = [];
    const noParenthesis: string[] = [];

    licenses.forEach((l: string) => {
        if (l.startsWith("(")) {
            withParenthesis.push(l);
        } else {
            noParenthesis.push(l);
        }
    });

    // eslint-disable-next-line @typescript-eslint/require-array-sort-compare,etc/no-assign-mutated-array
    return [...noParenthesis.sort(), ...withParenthesis.sort()];
};

const replaceContentWithin = (content: string, marker: string, replacement: string): string | undefined => {
    /** Replaces the content within the comments and re appends/prepends the comments to the replace for follow-up workflow runs. */
    const regex = new RegExp(`(<!-- ${marker} -->)[\\s\\S]*?(<!-- ${marker} -->)`, "g");

    if (!regex.test(content)) {
        return undefined;
    }

    return content.replace(regex, `$1\n${replacement}\n$2`);
};

export interface LicenseOptions {
    dtsMarker?: string;
    dtsTemplate?: (licenses: string[], dependencyLicenseTexts: string, packageName: string | undefined) => string;
    marker?: string;
    path?: string;
    template?: (licenses: string[], dependencyLicenseTexts: string, packageName: string | undefined) => string;
}

export const license = (
    licenseFilePath: string,
    marker: string,
    packageName: string | undefined,
    licenseTemplate: (licenses: string[], dependencyLicenseTexts: string, packageName: string | undefined) => string,
    mode: "dependencies" | "types",
): Plugin =>
    licensePlugin({
        // eslint-disable-next-line sonarjs/cognitive-complexity
        thirdParty(dependencies) {
            const licenses = new Set<string>();

            const dependencyLicenseTexts = dependencies
                .sort(({ name: nameA }, { name: nameB }) => (nameA! > nameB! ? 1 : nameB! > nameA! ? -1 : 0))
                .map(({ author, contributors, license: dependencylicense, licenseText, maintainers, name, repository }) => {
                    let text = `## ${name}\n`;

                    if (dependencylicense) {
                        text += `License: ${dependencylicense}\n`;
                    }

                    const names = new Set();

                    // eslint-disable-next-line no-loops/no-loops,no-restricted-syntax
                    for (const person of [author, ...maintainers, ...contributors]) {
                        const personName = typeof person === "string" ? person : person?.name;

                        if (personName) {
                            names.add(personName);
                        }
                    }

                    if (names.size > 0) {
                        text += `By: ${[...names].join(", ")}\n`;
                    }

                    if (repository) {
                        text += `Repository: ${typeof repository === "string" ? repository : repository.url}\n`;
                    }

                    if (licenseText) {
                        text +=
                            "\n" +
                            licenseText
                                .trim()
                                .replaceAll(/(\r\n|\r)/g, "\n")
                                .split("\n")
                                .map((line) => `> ${line}`)
                                .join("\n") +
                            "\n";
                    }

                    if (dependencylicense) {
                        licenses.add(dependencylicense);
                    }

                    return text;
                })
                .join("\n---------------------------------------\n\n");

            const licenseText = licenseTemplate(sortLicenses(licenses), dependencyLicenseTexts, packageName);

            try {
                const existingLicenseText = readFileSync(licenseFilePath);

                const content = replaceContentWithin(existingLicenseText, marker, licenseText);

                if (!content) {
                    logger.error(`Could not find the license marker: <!-- ${marker} --> in ${licenseFilePath}`);

                    return;
                }

                if (existingLicenseText !== content) {
                    writeFileSync(licenseFilePath, content);

                    logger.info({
                        message: `${licenseFilePath} updated.`,
                        prefix: `license:${mode}`,
                    });
                }
            } catch (error) {
                logger.error(error);
            }
        },
    });
