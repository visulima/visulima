/**
 * Git download module — clone repositories from GitHub, GitLab, or Bitbucket
 * without the .git directory.
 *
 * Supports full repos, subdirectories, single files, branches, tags, commits,
 * and private repos via environment tokens.
 */

export { cloneRepo } from "./clone";
export type { CloneOptions } from "./clone";
export { getDefaultBranch, parseGitUrl } from "./parse-url";
export type { GitHost, GitRepoConfig, GitResourceType } from "./parse-url";
