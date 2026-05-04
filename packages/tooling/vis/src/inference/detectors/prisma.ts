import type { DetectedTargets, Detector } from "../types";

export const prismaDetector: Detector = {
    configFiles: ["prisma/schema.prisma", "schema.prisma"],
    detect: ({ matchedConfigs }) => {
        const configRef = matchedConfigs[0] ? `{projectRoot}/${matchedConfigs[0]}` : undefined;

        const targets: DetectedTargets["targets"] = {
            // `db:*` namespace keeps prisma orthogonal to bundler/test
            // detectors. drizzle uses the same namespace — only one of
            // them ships in any given project, and prisma wins on
            // collision (registered first).
            "db:generate": {
                command: "prisma generate",
                description: "prisma generate (inferred)",
                inputs: [...(configRef ? [configRef] : []), "{projectRoot}/package.json"],
                outputs: ["{projectRoot}/node_modules/.prisma", "{projectRoot}/node_modules/@prisma/client"],
                type: "build",
            },
            "db:migrate": {
                command: "prisma migrate dev",
                description: "prisma migrate dev (inferred)",
            },
            "db:push": {
                command: "prisma db push",
                description: "prisma db push (inferred)",
            },
            "db:studio": {
                command: "prisma studio",
                description: "prisma studio (inferred)",
                preset: "server",
            },
        };

        return { targets };
    },
    fallbackDependency: "prisma",
    name: "prisma",
};
