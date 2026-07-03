import type { DetectedTargets, Detector } from "../types";

export const drizzleDetector: Detector = {
    configFiles: ["drizzle.config.ts", "drizzle.config.js", "drizzle.config.mjs", "drizzle.config.mts", "drizzle.config.cjs"],
    detect: ({ matchedConfigs }) => {
        const configRef = matchedConfigs[0] ? `{projectRoot}/${matchedConfigs[0]}` : undefined;

        const targets: DetectedTargets["targets"] = {
            "db:generate": {
                command: "drizzle-kit generate",
                description: "drizzle-kit generate (inferred)",
                inputs: ["{projectRoot}/src/**/*", ...(configRef ? [configRef] : []), "{projectRoot}/package.json"],
                outputs: ["{projectRoot}/drizzle"],
                type: "build",
            },
            "db:migrate": {
                command: "drizzle-kit migrate",
                description: "drizzle-kit migrate (inferred)",
            },
            "db:push": {
                command: "drizzle-kit push",
                description: "drizzle-kit push (inferred)",
            },
            "db:studio": {
                command: "drizzle-kit studio",
                description: "drizzle-kit studio (inferred)",
                preset: "server",
            },
        };

        return { targets };
    },
    fallbackDependency: "drizzle-kit",
    name: "drizzle",
};
