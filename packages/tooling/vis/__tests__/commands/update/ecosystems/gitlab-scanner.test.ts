import { describe, expect, it } from "vitest";

import { extractFromGitlabCi } from "../../../../src/commands/update/ecosystems/gitlab/scanner";

const GITLAB_YAML = `
image: node:22

services:
  - name: postgres:14.5
  - redis:7.2

include:
  - project: 'group/shared-pipelines'
    ref: 'v1.2.3'
    file: '/templates/test.yml'
  - component: gitlab.com/group/components/ci@2.0.0

# vis-update-ignore-next-line
include:
  - project: 'group/ignored'
    ref: 'v9.9.9'
`;

describe(extractFromGitlabCi, () => {
    it("captures top-level image", () => {
        expect.assertions(1);

        const { images } = extractFromGitlabCi("/tmp/.gitlab-ci.yml", GITLAB_YAML);
        const node = images.find((image) => image.name === "node");

        expect(node?.tag).toBe("22");
    });

    it("captures services - name: and bare service entries", () => {
        expect.assertions(2);

        const { images } = extractFromGitlabCi("/tmp/.gitlab-ci.yml", GITLAB_YAML);
        const postgres = images.find((image) => image.name === "postgres");
        const redis = images.find((image) => image.name === "redis");

        expect(postgres?.tag).toBe("14.5");
        expect(redis?.tag).toBe("7.2");
    });

    it("captures project include refs", () => {
        expect.assertions(2);

        const { includes } = extractFromGitlabCi("/tmp/.gitlab-ci.yml", GITLAB_YAML);
        const shared = includes.find((include) => include.project === "group/shared-pipelines");

        expect(shared).toBeDefined();
        expect(shared?.ref).toBe("v1.2.3");
    });

    it("captures component include refs", () => {
        expect.assertions(2);

        const { includes } = extractFromGitlabCi("/tmp/.gitlab-ci.yml", GITLAB_YAML);
        const component = includes.find((include) => include.kind === "component");

        expect(component?.project).toBe("gitlab.com/group/components/ci");
        expect(component?.ref).toBe("2.0.0");
    });

    it("propagates `# vis-update-ignore-next-line` to the include block that follows", () => {
        expect.assertions(1);

        const { includes } = extractFromGitlabCi("/tmp/.gitlab-ci.yml", GITLAB_YAML);
        const ignored = includes.find((include) => include.project === "group/ignored");

        // The fixture has `# vis-update-ignore-next-line` above the
        // ignored include. The directive must survive across the
        // `project:` line and land on the `ref:` line so the include is
        // emitted as ignored.
        expect(ignored?.ignoreReason).toBeDefined();
    });
});
