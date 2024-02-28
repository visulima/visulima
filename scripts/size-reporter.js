// eslint-disable-next-line import/no-unused-modules
import { readGitHubWorkflowEnv, reportFileSizeImpactInGitHubPullRequest } from "@jsenv/file-size-impact";

await reportFileSizeImpactInGitHubPullRequest({
    ...readGitHubWorkflowEnv(),
    buildCommand: "pnpm run build:prod:packages",
    // eslint-disable-next-line compat/compat
    fileSizeReportUrl: new URL("size-generator.js#fileSizeReport", import.meta.url),
    installCommand: "pnpm install --frozen-lockfile",
});
