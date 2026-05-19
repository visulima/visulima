import type { CommandExecute, Toolbox } from "@visulima/cerebro";

import { pail } from "../../io/logger";
import { detectPm } from "../../pm/pm-runner";
import { LOCKFILE_NAMES } from "../../security/dependency-scan";
import { formatLockfileVerification, verifyLockfile } from "../../security/lockfile-verification";
import type { SecurityVerifyLockfileOptions } from "./index";

const execute = async ({ options, visConfig, workspaceRoot: wsRoot }: Toolbox<Console, SecurityVerifyLockfileOptions>): Promise<void> => {
    const cwd = wsRoot ?? process.cwd();
    const pm = detectPm(cwd);

    if (!LOCKFILE_NAMES[pm.name]) {
        pail.warn(`Package manager '${pm.name}' has no lockfile vis can verify.`);

        return;
    }

    const result = await verifyLockfile({
        offline: Boolean(options.offline),
        packageManager: pm.name,
        visConfig: visConfig ?? {},
        workspaceRoot: cwd,
    });

    if (options.json) {
        process.stdout.write(`${JSON.stringify(result, undefined, 2)}\n`);

        if (result.status === "fail") {
            process.exitCode = 1;
        }

        return;
    }

    const [headline, ...details] = formatLockfileVerification(result);

    if (result.status === "skipped") {
        pail.info(headline);

        return;
    }

    if (result.status === "pass") {
        pail.success(headline);

        return;
    }

    pail.error(headline);

    for (const line of details) {
        pail.error(line);
    }

    process.exitCode = 1;
};

export default execute as CommandExecute<Toolbox>;
