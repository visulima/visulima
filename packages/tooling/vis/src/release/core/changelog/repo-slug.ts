/**
 * Repository detection shared by the link-emitting changelog formatters
 * (`github`, `conventional`): which forge the working copy points at, and the
 * `owner/name` slug on it.
 *
 * Resolution order for the slug: explicit option → the active remote
 * provider's `detectRepoSlug` → `undefined`. The *provider* is resolved even
 * when the slug is configured, because it decides the shape of every link the
 * formatters emit — rendering a GitLab slug into a `github.com` URL points the
 * reader at an unrelated repository that happens to share the path.
 *
 * Two deliberate defences:
 *
 *   - The remote module is imported lazily so a formatter that never needs a
 *     slug doesn't drag the provider clients (and their shell calls) into the
 *     module graph.
 *   - The whole detection path runs under one `try`/`catch`. It shells out
 *     (`git config --get remote.origin.url`, `gh repo view`), and both
 *     built-in formatters await this before rendering a single line — so a
 *     rejecting runner has to degrade to the documented link-free plain text
 *     rather than fail the entire workspace changelog run.
 */

import type { CommandRunner } from "../package-managers/interface";
import type { RemoteProvider } from "../remote/interface";
import { remoteWebUrls } from "../remote/web-urls";

/** Everything the formatters need to build links: the forge, and the repo on it. */
export interface DetectedRepo {
    /** Forge the links point at. Falls back to `github` when detection fails. */
    provider: RemoteProvider;

    /** `owner/name`, or `undefined` when there is no remote worth linking to. */
    slug: string | undefined;
}

export const detectRepo = async (option: string | undefined, runner: CommandRunner, cwd: string): Promise<DetectedRepo> => {
    try {
        const { createRemoteClient, detectRemoteProvider } = await import("../remote/detect");
        const provider = await detectRemoteProvider(cwd, runner, undefined);

        if (option) {
            return { provider, slug: option };
        }

        return { provider, slug: await createRemoteClient(provider).detectRepoSlug(cwd, runner) };
    } catch {
        // No remote, no `gh` on PATH, a runner that rejects: every formatter
        // renders correctly without links, so this is never fatal.
        return { provider: "github", slug: option };
    }
};

/**
 * Turn bare `#123` references into issue links on the detected provider.
 * Left untouched when no repository was detected, and when the reference is
 * already the label of a Markdown link (`[#123](…)`).
 */
export const linkifyHashRefs = (text: string, repo: DetectedRepo): string => {
    const { slug } = repo;

    if (!slug) {
        return text;
    }

    const urls = remoteWebUrls(repo.provider, slug);

    return text.replaceAll(/(?<!\[)#(\d+)/g, (_match, issueNumber: string) => `[#${issueNumber}](${urls.issue(issueNumber)})`);
};
