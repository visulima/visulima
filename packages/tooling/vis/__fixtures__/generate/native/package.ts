// Self-contained native-template fixture: a `type`-only import (erased at
// transpile, so no runtime cross-module resolution) keeps this loadable in any
// environment. `createTemplate` is an identity helper, so the literal below is
// equivalent for exercising loadNativeTemplate's load → validate → produce path.
import type { Template } from "../../../../src/generate/types";

const template: Template = {
    about: { description: "Scaffold a fixture package", name: "package" },
    options: {
        category: { default: "tooling", type: "enum", values: ["api", "fs", "tooling"] },
        name: { prompt: "Package name?", required: true, type: "string" },
    },
    async produce({ options }) {
        const name = String(options.name);
        const category = String(options.category);

        return {
            files: {
                [`packages/${category}/${name}/package.json`]: JSON.stringify({ name }, null, 2),
                [`packages/${category}/${name}/src/index.ts`]: "export {};\n",
            },
            scripts: ["echo done"],
            suggestions: ["Run pnpm install"],
        };
    },
};

export default template;
