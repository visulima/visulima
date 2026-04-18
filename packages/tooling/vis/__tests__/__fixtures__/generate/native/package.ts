import { createTemplate } from "../../../../src/generate";

export default createTemplate({
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
});
