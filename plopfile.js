const capitalize = (str) => {
    return str.charAt(0).toUpperCase() + str.slice(1);
};

const camelCase = (str) => {
    return str.replace(/[-_](\w)/g, (_, c) => c.toUpperCase());
};

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
            const actions = [];

            if (!answers) return actions;

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
                destination: `./packages//{{dashCase packageName}}`,
                base: `plop/package`,
                globOptions: { dot: true },
                data,
                abortOnFail: true,
            });

            return actions;
        },
    });
}
