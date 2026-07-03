import { describe, expect, it } from "vitest";

import { extractFromGitlabCi } from "../../../../src/commands/update/ecosystems/gitlab/scanner";

describe("gitlab CI scanner — nested services blocks", () => {
    it("captures `services:` indented under a job (the canonical layout)", () => {
        expect.assertions(2);

        const yaml = ["test:", "  image: node:22", "  services:", "    - postgres:14", "    - name: redis:7.2", "  script:", "    - pnpm test", ""].join("\n");

        const { images } = extractFromGitlabCi("/tmp/.gitlab-ci.yml", yaml);
        const postgres = images.find((image) => image.name === "postgres");
        const redis = images.find((image) => image.name === "redis");

        expect(postgres?.tag).toBe("14");
        expect(redis?.tag).toBe("7.2");
    });

    it("still works for top-level services blocks", () => {
        expect.assertions(1);

        const yaml = ["services:", "  - postgres:14", ""].join("\n");

        const { images } = extractFromGitlabCi("/tmp/.gitlab-ci.yml", yaml);

        expect(images.find((image) => image.name === "postgres")?.tag).toBe("14");
    });

    it("de-asserts services scope when a sibling key appears at the same indent", () => {
        expect.assertions(2);

        const yaml = [
            "test:",
            "  services:",
            "    - postgres:14",
            "  script:",
            "    - postgres:18", // This is a script command, not a service.
            "",
        ].join("\n");

        const { images } = extractFromGitlabCi("/tmp/.gitlab-ci.yml", yaml);
        const tags = images.filter((image) => image.name === "postgres").map((image) => image.tag);

        // Only the actual service should be recorded — the postgres
        // reference inside the script block lives outside `services:`.
        expect(tags).toContain("14");
        expect(tags).not.toContain("18");
    });
});
