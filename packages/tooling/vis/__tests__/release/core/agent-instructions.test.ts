import { describe, expect, it } from "vitest";

import { renderAgentSection, upsertAgentSection } from "../../../src/release/core/agent-instructions";

describe("agent-instructions: upsertAgentSection", () => {
    it("creates a fresh AGENTS.md when none exists", () => {
        expect.hasAssertions();

        const { changed, content } = upsertAgentSection(undefined);

        expect(changed).toBe(true);
        expect(content).toContain("# AGENTS.md");
        expect(content).toContain("## Releasing with vis");
        expect(content).toContain("vis release add");
    });

    it("appends to an existing AGENTS.md without clobbering hand-written content", () => {
        expect.hasAssertions();

        const existing = "# AGENTS.md\n\n## House rules\n\nBe nice.\n";
        const { changed, content } = upsertAgentSection(existing);

        expect(changed).toBe(true);
        expect(content).toContain("## House rules");
        expect(content).toContain("## Releasing with vis");
    });

    it("is idempotent — re-running does not duplicate the section", () => {
        expect.hasAssertions();

        const first = upsertAgentSection("# AGENTS.md\n\nhi\n").content;
        const second = upsertAgentSection(first);

        expect(second.changed).toBe(false);
        expect(second.content).toBe(first);
        expect(second.content.match(/## Releasing with vis/g)).toHaveLength(1);
    });

    it("replaces an out-of-date managed section in place", () => {
        expect.hasAssertions();

        const stale = `# AGENTS.md\n\n<!-- BEGIN vis release (managed) -->\n\nOLD CONTENT\n\n<!-- END vis release (managed) -->\n`;
        const { changed, content } = upsertAgentSection(stale);

        expect(changed).toBe(true);
        expect(content).not.toContain("OLD CONTENT");
        expect(content).toContain("vis release add");
        // Still exactly one managed block.
        expect(content.match(/BEGIN vis release/g)).toHaveLength(1);
    });

    it("renderAgentSection is wrapped in idempotency markers", () => {
        expect.hasAssertions();

        const section = renderAgentSection();

        expect(section.startsWith("<!-- BEGIN vis release (managed) -->")).toBe(true);
        expect(section.trimEnd().endsWith("<!-- END vis release (managed) -->")).toBe(true);
    });
});
