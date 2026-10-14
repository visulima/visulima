import type { DetectedTargets, Detector } from "../types";

/**
 * Applies only to Maven projects (a `pom.xml` with an `&lt;artifactId>` and no
 * `package.json`); `discoverWorkspace` keeps it off JS packages.
 *
 * Commands run through Maven in batch mode. Checks are `type: "test"`:
 * cacheable pass/fail with no outputs.
 */
const inputs = ["{projectRoot}/pom.xml", "{projectRoot}/src/**/*", "{workspaceRoot}/pom.xml"];

export const mavenDetector: Detector = {
    configFiles: ["pom.xml"],
    detect: (): DetectedTargets => {
        return {
            targets: {
                build: {
                    cache: false,
                    command: "mvn -B package",
                    description: "mvn package (inferred)",
                    inputs,
                },
                test: {
                    command: "mvn -B test",
                    description: "mvn test (inferred)",
                    inputs,
                    outputs: [],
                    type: "test",
                },
            },
        };
    },
    name: "maven",
};
