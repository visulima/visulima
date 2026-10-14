/**
 * Turns user-facing git template sources into something giget can download,
 * and picks the auth token that belongs to the host being contacted.
 *
 * giget only understands `provider:owner/repo`. It treats `https://…` as a raw
 * tarball URL, and it falls back to its template registry for bare `git@host:…`,
 * `host/owner/repo` and `owner/repo/tree/ref/sub` inputs, so those are
 * rewritten to the provider form here before the download.
 */

import { downloadTemplate } from "giget";

type GitProvider = "bitbucket" | "github" | "gitlab" | "sourcehut";

export interface ResolvedGitSource {
    /** Token embedded in the URL (`https://&lt;token>@host/...`). */
    auth?: string;
    /** Base URL of a self-hosted GitLab (`gitlab://host/...`). */
    gitlabUrl?: string;
    /** Source string to hand to giget. */
    source: string;
}

const HOST_PROVIDERS: Record<string, GitProvider> = {
    "bitbucket.org": "bitbucket",
    "git.sr.ht": "sourcehut",
    "github.com": "github",
    "gitlab.com": "gitlab",
};

/** URL path segment that separates the repository from `&lt;ref>/&lt;subdir>`. */
const TREE_MARKERS: Record<GitProvider, string> = {
    bitbucket: "/src/",
    github: "/tree/",
    gitlab: "/-/tree/",
    sourcehut: "/tree/",
};

const TOKEN_ENV: Record<string, string[]> = {
    bitbucket: ["BITBUCKET_TOKEN"],
    github: ["GITHUB_TOKEN", "GH_TOKEN"],
    gitlab: ["GITLAB_TOKEN"],
};

const BARE_HOST = /^(bitbucket\.org|git\.sr\.ht|github\.com|gitlab\.com)\/(.+)$/;
const SCP_LIKE = /^[\w.-]+@([\w.-]+):(.+)$/;
const SELF_HOSTED_GITLAB = /^gitlab:\/\/([^/]+)\/(.+)$/;
const TREE_SHORTHAND = /^[^/:@]+\/[^/:@]+\/tree\//;

const toProviderSource = (provider: GitProvider, path: string, fragmentRef: string): string => {
    let repo = path.replaceAll(/^\/+|\/+$/g, "").replace(/\.git$/, "");
    let ref = fragmentRef;
    let subdir = "";

    const marker = repo.indexOf(TREE_MARKERS[provider]);

    if (marker !== -1) {
        const [treeRef = "", ...rest] = repo.slice(marker + TREE_MARKERS[provider].length).split("/");

        repo = repo.slice(0, marker);
        ref ||= treeRef;
        subdir = rest.join("/");
    }

    // giget's sourcehut provider adds the `~` itself, so `sourcehut:~user/repo` would 404.
    if (provider === "sourcehut") {
        repo = repo.replace(/^~/, "");
    }

    return `${provider}:${repo}${subdir ? `/${subdir}` : ""}${ref ? `#${ref}` : ""}`;
};

/**
 * Normalise a git template source to the form giget resolves correctly.
 * Inputs that are already giget-native (or unknown tarball URLs) pass through untouched.
 * @param input Raw source as typed by the user.
 * @returns The giget source plus any auth/host information extracted from it.
 */
export const resolveGitSource = (input: string): ResolvedGitSource => {
    const hashIndex = input.indexOf("#");
    const body = hashIndex === -1 ? input : input.slice(0, hashIndex);
    const ref = hashIndex === -1 ? "" : input.slice(hashIndex + 1);

    const selfHosted = SELF_HOSTED_GITLAB.exec(body);

    if (selfHosted) {
        return { gitlabUrl: `https://${selfHosted[1]}`, source: toProviderSource("gitlab", selfHosted[2] as string, ref) };
    }

    if (body.startsWith("sourcehut:")) {
        return { source: toProviderSource("sourcehut", body.slice("sourcehut:".length), ref) };
    }

    const scp = SCP_LIKE.exec(body);

    if (scp) {
        const provider = HOST_PROVIDERS[scp[1] as string];

        // Unknown hosts clone over SSH with the user's own git credentials.
        return { source: provider ? toProviderSource(provider, scp[2] as string, ref) : `git:${input}` };
    }

    const bare = BARE_HOST.exec(body);

    if (bare) {
        return { source: toProviderSource(HOST_PROVIDERS[bare[1] as string] as GitProvider, bare[2] as string, ref) };
    }

    if (/^https?:\/\//.test(body)) {
        let url: URL;

        try {
            url = new URL(body);
        } catch {
            return { source: input };
        }

        const provider = HOST_PROVIDERS[url.hostname];

        if (!provider || /\.(?:tar\.gz|tgz)$/.test(url.pathname)) {
            return { source: input };
        }

        const auth = decodeURIComponent(url.password || url.username) || undefined;

        return { auth, source: toProviderSource(provider, url.pathname, ref) };
    }

    if (TREE_SHORTHAND.test(body)) {
        return { source: toProviderSource("github", body, ref) };
    }

    return { source: input };
};

/**
 * Token for the host a giget source points at. A token for one host is never
 * sent to another, and plain tarball/`git:` sources get none.
 * @param source Normalised giget source.
 * @param defaultProvider Provider giget assumes for sources without a prefix.
 * @returns The matching token from the environment, if any.
 */
const tokenForSource = (source: string, defaultProvider?: string): string | undefined => {
    const prefix = /^([a-z]+):/.exec(source)?.[1];
    const provider = prefix === "gh" ? "github" : (prefix ?? defaultProvider ?? "github");

    for (const name of TOKEN_ENV[provider] ?? []) {
        if (process.env[name]) {
            return process.env[name];
        }
    }

    return undefined;
};

type DownloadOptions = NonNullable<Parameters<typeof downloadTemplate>[1]>;

/**
 * Download a git template, normalising the source and choosing a host-matched token.
 * `options.auth` (explicit config) wins over a token embedded in the URL, which wins over
 * the host's environment variable, which is skipped for a self-hosted GitLab. giget itself lets `GIGET_AUTH` override all of them.
 * @param input Raw template source.
 * @param options Options forwarded to giget's `downloadTemplate`.
 * @returns giget's download result.
 */
export const downloadGitSource = async (input: string, options: DownloadOptions): ReturnType<typeof downloadTemplate> => {
    const { auth: inlineAuth, gitlabUrl, source } = resolveGitSource(input);
    // GITLAB_TOKEN belongs to gitlab.com. A `gitlab://host/…` source names a host the template author chose, so
    // the environment token is never sent there: use `create.auth`, a token in the URL, or GIGET_AUTH instead.
    const auth = options.auth || inlineAuth || (gitlabUrl ? undefined : tokenForSource(source, options.provider));

    // ponytail: giget reads the GitLab base URL from the environment, so it is set for the
    // duration of one download; concurrent downloads to different GitLab hosts would race.
    const previous = process.env.GIGET_GITLAB_URL;

    if (gitlabUrl) {
        process.env.GIGET_GITLAB_URL = gitlabUrl;
    }

    try {
        return await downloadTemplate(source, { ...options, auth });
    } finally {
        if (gitlabUrl) {
            if (previous === undefined) {
                delete process.env.GIGET_GITLAB_URL;
            } else {
                process.env.GIGET_GITLAB_URL = previous;
            }
        }
    }
};
