import { cwd } from "node:process";
import { join } from "node:path";

/**
 * @param string_ {string}
 * @returns {string}
 */
const capitalize = (string_) => {
    return string_.charAt(0).toUpperCase() + string_.slice(1);
};

/**
 * @param string_ {string}
 * @returns {string}
 */
const camelCase = (string_) => {
    return string_.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
};

/**
 *
 * @param plop {import('plop').NodePlopAPI}
 * @returns {void}
 */
// eslint-disable-next-line no-unused-vars,import/no-unused-modules,func-names
export default function (plop) {
    plop.setHelper("capitalize", (text) => {
        return capitalize(camelCase(text));
    });
    plop.setHelper("camelCase", (text) => {
        return camelCase(text);
    });

    plop.setGenerator("package", {
        description: `Generates a package`,
        prompts: [
            {
                type: "input",
                name: `packageName`,
                message: `Enter package name:`,
                validate: (value) => {
                    if (!value) {
                        return `package name is required`;
                    }

                    // check is case is correct
                    if (value !== value.toLowerCase()) {
                        return `package name must be in lowercase`;
                    }

                    // cannot have spaces
                    if (value.includes(" ")) {
                        return `package name cannot have spaces`;
                    }

                    return true;
                },
            },
            {
                type: "input",
                name: "description",
                message: `The description of this package:`,
            },
        ],
        actions(answers) {
            /**
             * @type {import("plop").ActionType[]}
             */
            const actions = [];

            if (!answers) {
                return actions;
            }

            const { description, outDir } = answers;
            const generatorName = answers[`packageName`] ?? "";

            const data = {
                [`packageName`]: generatorName,
                description,
                outDir,
            };

            actions.push({
                type: "addMany",
                templateFiles: `plop/package/**`,
                destination: `./packages/{{dashCase packageName}}`,
                base: `plop/package`,
                globOptions: { dot: true },
                data,
                abortOnFail: true,
            });

            actions.push({
                type: "append",
                path: join(cwd(), "package.json"),
                pattern: /"scripts": {/,
                templateFile: `plop/package-scripts.hbs`,
                data,
            });

            return actions;
        },
    });
}
