/**
 * Pre-publish check of GitHub's server-side push rules (rulesets and classic
 * branch protection) against the pushes a release is about to make.
 *
 * A `git push --dry-run` only proves the token authenticates: GitHub evaluates
 * rulesets and branch protection when the push is received, so a dry-run
 * passes and the real tag push is rejected after the packages are already on
 * the registry. These rules are readable through the REST API with the same
 * token (`current_user_can_bypass` says whether *this* token is exempt), so
 * the release can fail before publishing instead.
 *
 * Severity mirrors what the later push failure would do: a blocked release
 * tag fails the publish, while blocked branch commits (publish lock, staged
 * registry, workspace changelog) and floating-major-tag updates only warn —
 * those pushes are soft-fail today. Any API error fails open with a warning.
 */

import zeptomatch from "zeptomatch";

import type { CommandRunner } from "../package-managers/interface";

export interface GithubPushRulesInput {
    /** Branch release commits are pushed to (`HEAD:&lt;branch>`), if any. */
    branch?: string;
    /** Release tags this run will create. */
    createdTags: ReadonlyArray<string>;
    cwd: string;
    /** Env for `gh`: carries `GH_TOKEN` (the push token) and `GH_HOST`. */
    env?: NodeJS.ProcessEnv;
    /** `owner/name` of the repository pushed to. */
    repo: string;
    /** Whether release commits are signed (`gitSignCommits`). */
    signedCommits: boolean;
    /** Existing tags this run force-moves (floating major tags). */
    updatedTags: ReadonlyArray<string>;
}

export interface GithubPushRulesResult {
    /** Pushes that will be rejected and fail the release. */
    blocked: string[];
    /** Pushes that will be rejected but only warn, or rules that couldn't be checked. */
    warnings: string[];
}

interface RuleSummary {
    ruleset_id?: number;
    type: string;
}

interface Ruleset {
    conditions?: { ref_name?: { exclude?: string[]; include?: string[] } };
    current_user_can_bypass?: string;
    enforcement?: string;
    id: number;
    name?: string;
    rules?: RuleSummary[];
    target?: string;
}

interface ClassicProtection {
    enforce_admins?: { enabled?: boolean };
    required_pull_request_reviews?: unknown;
    required_status_checks?: { checks?: unknown[]; contexts?: string[] };
}

/** `current_user_can_bypass` values that let the push through. */
const BYPASSES = new Set(["always", "exempt"]);

/** Rule types that reject a plain (fast-forward) commit push to a branch. */
const BRANCH_PUSH_BLOCKERS = new Set(["merge_queue", "pull_request", "required_deployments", "required_status_checks", "update"]);

/** Rule types that reject creating a tag. */
const TAG_CREATE_BLOCKERS = new Set(["creation"]);

/** Rule types that reject force-moving an existing tag. */
const TAG_UPDATE_BLOCKERS = new Set(["non_fast_forward", "update"]);

const ghApi = async <T>(runner: CommandRunner, input: GithubPushRulesInput, path: string): Promise<T> => {
    const result = await runner.run("gh", ["api", "-H", "Accept: application/vnd.github+json", path], { cwd: input.cwd, env: input.env, silent: true });

    if (result.exitCode !== 0) {
        throw new Error(result.stderr.trim() || `gh api ${path} exited with ${String(result.exitCode)}`);
    }

    return JSON.parse(result.stdout) as T;
};

/** GitHub's ref-name condition: `~ALL`, or fnmatch-style globs over the full ref. */
const refMatches = (patterns: ReadonlyArray<string> | undefined, ref: string): boolean =>
    (patterns ?? []).some((pattern) => pattern === "~ALL" || pattern === ref || zeptomatch(pattern, ref));

const appliesTo = (ruleset: Ruleset, ref: string): boolean =>
    refMatches(ruleset.conditions?.ref_name?.include, ref) && !refMatches(ruleset.conditions?.ref_name?.exclude, ref);

const rulesetLabel = (ruleset: Ruleset): string => `ruleset "${ruleset.name ?? String(ruleset.id)}"`;

const checkBranch = async (runner: CommandRunner, input: GithubPushRulesInput, branch: string, warnings: string[]): Promise<void> => {
    const encoded = encodeURIComponent(branch);
    const rules = await ghApi<RuleSummary[]>(runner, input, `repos/${input.repo}/rules/branches/${encoded}`);
    const blockingByRuleset = new Map<number, string[]>();

    for (const rule of rules) {
        const blocks = BRANCH_PUSH_BLOCKERS.has(rule.type) || (rule.type === "required_signatures" && !input.signedCommits);

        if (blocks && rule.ruleset_id !== undefined) {
            blockingByRuleset.set(rule.ruleset_id, [...(blockingByRuleset.get(rule.ruleset_id) ?? []), rule.type]);
        }
    }

    for (const [id, types] of blockingByRuleset) {
        const ruleset = await ghApi<Ruleset>(runner, input, `repos/${input.repo}/rulesets/${String(id)}`);

        if (!BYPASSES.has(ruleset.current_user_can_bypass ?? "never")) {
            warnings.push(
                `branch ${branch}: ${rulesetLabel(ruleset)} requires ${types.join(", ")} — release commits (lock, registry, changelog) will not be pushed`,
            );
        }
    }

    const info = await ghApi<{ protected?: boolean }>(runner, input, `repos/${input.repo}/branches/${encoded}`);

    if (info.protected !== true) {
        return;
    }

    // Reading the full protection settings needs admin rights. A token that can
    // read them is an admin, and admins push past protection unless it is
    // enforced for admins too.
    let protection: ClassicProtection;

    try {
        protection = await ghApi<ClassicProtection>(runner, input, `repos/${input.repo}/branches/${encoded}/protection`);
    } catch {
        warnings.push(`branch ${branch}: classic branch protection is enabled and this token can't read it — release commits may be rejected`);

        return;
    }

    const requiresChecks = (protection.required_status_checks?.contexts?.length ?? 0) > 0 || (protection.required_status_checks?.checks?.length ?? 0) > 0;

    if (protection.enforce_admins?.enabled === true && (protection.required_pull_request_reviews !== undefined || requiresChecks)) {
        warnings.push(
            `branch ${branch}: classic branch protection requires pull requests or status checks, enforced for admins — release commits will not be pushed`,
        );
    }
};

const checkTags = async (runner: CommandRunner, input: GithubPushRulesInput, blocked: string[], warnings: string[]): Promise<void> => {
    const listed = await ghApi<Ruleset[]>(runner, input, `repos/${input.repo}/rulesets?includes_parents=true&per_page=100`);

    for (const summary of listed) {
        if (summary.target !== "tag" || summary.enforcement !== "active") {
            continue;
        }

        const ruleset = await ghApi<Ruleset>(runner, input, `repos/${input.repo}/rulesets/${String(summary.id)}`);

        if (BYPASSES.has(ruleset.current_user_can_bypass ?? "never")) {
            continue;
        }

        const types = new Set((ruleset.rules ?? []).map((rule) => rule.type));

        if ([...TAG_CREATE_BLOCKERS].some((type) => types.has(type))) {
            for (const tag of input.createdTags.filter((name) => appliesTo(ruleset, `refs/tags/${name}`))) {
                blocked.push(`tag ${tag}: ${rulesetLabel(ruleset)} restricts tag creation`);
            }
        }

        if ([...TAG_UPDATE_BLOCKERS].some((type) => types.has(type))) {
            for (const tag of input.updatedTags.filter((name) => appliesTo(ruleset, `refs/tags/${name}`))) {
                warnings.push(`tag ${tag}: ${rulesetLabel(ruleset)} restricts tag updates — the floating major tag will not move`);
            }
        }
    }
};

export const checkGithubPushRules = async (runner: CommandRunner, input: GithubPushRulesInput): Promise<GithubPushRulesResult> => {
    const blocked: string[] = [];
    const warnings: string[] = [];

    if (input.branch !== undefined) {
        try {
            await checkBranch(runner, input, input.branch, warnings);
        } catch (error) {
            warnings.push(`could not check push rules for branch ${input.branch}: ${(error as Error).message}`);
        }
    }

    if (input.createdTags.length > 0 || input.updatedTags.length > 0) {
        try {
            await checkTags(runner, input, blocked, warnings);
        } catch (error) {
            warnings.push(`could not check tag rulesets: ${(error as Error).message}`);
        }
    }

    return { blocked, warnings };
};
