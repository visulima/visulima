/**
 * `vis release` command tree (RFC §7).
 *
 * Each subcommand is a separate cerebro `Command` registered via the
 * `commandPath: ["release"]` + `name: "&lt;sub>"` pattern.
 *
 * Loaders are lazy — `import()` inside `loader: () => …` so the heavy
 * release deps (`yaml`, `semver`, `conventional-commits-parser`,
 * `zeptomatch`) only load when a release subcommand is actually invoked.
 *
 * `vis run`/`vis ci`/`vis audit` cold-start cost is unaffected.
 */

import type { Command } from "@visulima/cerebro";

import addCommand from "./add";
import changelogCommand from "./changelog";
import checkCommand from "./check";
import ciCheckCommand from "./ci/check";
import ciPlanCommand from "./ci/plan";
import ciRebasePrCommand from "./ci/rebase-pr";
import ciReleaseCommand from "./ci/release";
import ciSetupCommand from "./ci/setup";
import ciSnapshotCommand from "./ci/snapshot";
import doctorCommand from "./doctor";
import generateCommand from "./generate";
import initCommand from "./init";
import nextVersionCommand from "./next-version";
import notificationsCommand from "./notifications";
import planCommand from "./plan";
import preCommand from "./pre";
import pretrustCommand from "./pretrust";
import publishCommand from "./publish";
import snapshotCommand from "./snapshot";
import stageCommand from "./stage";
import statusCommand from "./status";
import versionCommand from "./version";

const releaseCommands: Command[] = [
    // Read-only / authoring
    addCommand,
    generateCommand,
    statusCommand,
    planCommand,
    changelogCommand,
    checkCommand,
    doctorCommand,
    nextVersionCommand,
    // Apply / publish
    versionCommand,
    publishCommand,
    snapshotCommand,
    stageCommand,
    preCommand,
    pretrustCommand,
    // Init / migration
    initCommand,
    // Notifications dry-run
    notificationsCommand,
    // CI
    ciCheckCommand,
    ciPlanCommand,
    ciReleaseCommand,
    ciRebasePrCommand,
    ciSnapshotCommand,
    ciSetupCommand,
];

export default releaseCommands;
