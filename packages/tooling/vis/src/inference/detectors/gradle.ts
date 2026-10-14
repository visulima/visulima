import type { DetectContext, DetectedTargets, Detector } from "../types";

/**
 * Applies only to Gradle modules (a build script in a module listed by
 * `settings.gradle(.kts)`); `discoverWorkspace` keeps it off JS packages.
 *
 * Each command calls the build root's wrapper with the module's task path, so it
 * runs from the module directory. Checks are `type: "test"`: cacheable pass/fail
 * with no outputs, like the Maven detector.
 * The wrapper path is POSIX (`../gradlew`); Windows task runs are not verified.
 */
const inputs = [
    "{projectRoot}/build.gradle*",
    "{projectRoot}/gradle.properties",
    "{projectRoot}/src/**/*",
    "{workspaceRoot}/settings.gradle*",
    "{workspaceRoot}/build.gradle*",
    "{workspaceRoot}/gradle.properties",
    "{workspaceRoot}/gradle/libs.versions.toml",
    "{workspaceRoot}/gradle/wrapper/gradle-wrapper.properties",
    "{workspaceRoot}/buildSrc/**/*",
    "{workspaceRoot}/build-logic/**/*",
];

const segments = (directory: string): string[] => directory.split(/[\\/]/).filter((part) => part !== "" && part !== ".");

export const gradleDetector: Detector = {
    configFiles: ["build.gradle", "build.gradle.kts"],
    detect: (context: DetectContext): DetectedTargets => {
        const parts = segments(context.projectDirectory);
        const wrapper = `${"../".repeat(parts.length)}gradlew`;
        const taskPath = `:${parts.join(":")}`;

        return {
            targets: {
                build: {
                    cache: false,
                    command: `${wrapper} ${taskPath}:build`,
                    description: "gradle build (inferred)",
                    inputs,
                },
                test: {
                    command: `${wrapper} ${taskPath}:test`,
                    description: "gradle test (inferred)",
                    inputs,
                    outputs: [],
                    type: "test",
                },
            },
        };
    },
    name: "gradle",
};
