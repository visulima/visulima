/**
 * `vis release ci setup` — print the GH Actions / token configuration
 * checklist for new adopters. Read-only: does not modify any files.
 */

import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import type { ReleaseCiSetupOptions } from "./index";

const CHECKLIST = `
🔧 vis release CI setup

1. Workflow permissions
   Add to .github/workflows/vis-release.yml:
       permissions:
         contents: write
         pull-requests: write
         id-token: write   # required for OIDC trusted publishing on npm

2. Secrets
   Required:
     - VIS_GH_TOKEN — PAT or GitHub App token. Used to force-push the
       version-PR branch and create/edit the version PR. The default
       \${{ github.token }} is anti-recursion-locked and cannot trigger
       downstream workflows on the version-PR.
     - GH_TOKEN — \${{ github.token }} works for read-only / commenting.
   Optional:
     - NPM_TOKEN — fallback when OIDC is not available. Trusted Publishing
       (id-token: write) is preferred.

3. Trusted Publishing on npm
   For each published package:
     a. https://npmjs.com/package/<name>/access  →  Publishing access
     b. Add a Trusted Publisher with provider=GitHub Actions
     c. Repository: visulima/visulima
     d. Workflow filename: vis-release.yml
     e. Environment name: (leave blank unless you use one)

4. Concurrency group (recommended)
       concurrency:
         group: vis-release-\${{ github.ref }}
         cancel-in-progress: false

5. Husky pre-commit gate (optional)
   Add to .husky/pre-commit:
       vis release check --hook pre-commit --no-fail
   (Or run \`vis release init\` and confirm the prompt — it'll auto-wire
   the hook if you say yes.)

📚 RFC: packages/tooling/vis/rfc/design-release-manager.md (§16)
`;

const execute = async ({ logger }: Toolbox<Console, ReleaseCiSetupOptions>): Promise<void> => {
    logger.info(CHECKLIST);
};

export default execute as CommandExecute<Toolbox>;
