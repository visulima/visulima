/**
 * `vis release init --agent` — scaffold AI-agent guidance for the release flow
 * (tegami's `init-agent` parity).
 *
 * Pure functions only; the init handler does the fs read/write. The section is
 * delimited by HTML-comment markers so re-running replaces (rather than
 * duplicates) it, and so hand edits outside the markers are preserved.
 */

const BEGIN = "<!-- BEGIN vis release (managed) -->";
const END = "<!-- END vis release (managed) -->";

export const AGENT_SECTION_BODY = `## Releasing with vis

This repo uses \`@visulima/vis\` for releases. To record a change for the next release, add a change file:

\`\`\`bash
vis release add --packages '@scope/pkg:minor' --message 'Describe the change'
\`\`\`

Change files live in \`.vis/release/*.md\` as YAML-frontmatter Markdown — one per logical change:

\`\`\`markdown
---
"@scope/pkg": minor
---

What changed, in changelog prose.
\`\`\`

- Pick the bump by impact: \`major\` (breaking), \`minor\` (feature), \`patch\` (fix). You may also omit the level and let a heading decide (\`#\`→major, \`##\`→minor, \`###\`→patch).
- Do NOT bump versions or edit \`CHANGELOG.md\` by hand — \`vis release version\` does that from the change files.
- Preview the effect with \`vis release status\`; never run \`vis release publish\` locally.
- One change file per PR is expected; an empty frontmatter (\`---\\n{}\\n---\`) records a deliberate no-release change.`;

/** The managed section, wrapped in its idempotency markers. */
export const renderAgentSection = (): string => `${BEGIN}\n\n${AGENT_SECTION_BODY}\n\n${END}`;

const escapeRe = (value: string): string => value.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
const SECTION_RE = new RegExp(String.raw`${escapeRe(BEGIN)}[\s\S]*?${escapeRe(END)}`);

/**
 * Insert or replace the managed release section in an AGENTS.md body.
 * Returns the new content and whether anything changed (so the caller can
 * skip a no-op write + report accurately).
 */
export const upsertAgentSection = (existing: string | undefined): { changed: boolean; content: string } => {
    const section = renderAgentSection();

    if (existing === undefined || existing.trim() === "") {
        return { changed: true, content: `# AGENTS.md\n\n${section}\n` };
    }

    if (SECTION_RE.test(existing)) {
        const replaced = existing.replace(SECTION_RE, section);

        return { changed: replaced !== existing, content: replaced };
    }

    return { changed: true, content: `${existing.replace(/\n*$/, "\n")}\n${section}\n` };
};
