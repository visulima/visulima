import { defineCommand } from "@visulima/cerebro";

/**
 * `vis release` — umbrella entry for the release subsystem.
 *
 * Every real subcommand is registered as a nested `commandPath: ["release"]`
 * command, which left the parent path unclaimed. That had two consequences
 * (visulima/visulima#863):
 *
 *  1. **Undiscoverable.** `vis --help` groups by `command.group`, so the
 *     subsystem only ever showed up as ~23 `release &lt;sub>` rows in the very
 *     last group of a long listing, with no one-line entry naming it.
 *  2. **Mis-dispatched.** `vis release ci release` has the leaf name
 *     `release`, so cerebro's name-keyed lookup mapped a bare `vis release`
 *     (and `vis release --help`, `vis help release`) onto the CI
 *     version-PR/publish command. Declaring a flat `release` command is what
 *     fixes that: `Cli.addCommand` re-keys the nested namesake under its full
 *     path so the flat one owns the bare name (`cerebro/src/cli.ts:865-878`
 *     handles this in EITHER registration order — the order below is about
 *     help-group placement only, not correctness).
 *
 * Registered ahead of the nested subcommands in `register-commands.ts` so the
 * "Release" group lands with the other top-level groups instead of at the
 * bottom of `vis --help`, which is grouped by first registration.
 */
const releaseRoot = defineCommand({
    description: "Version, changelog and publish workspace packages (unstable)",
    examples: [
        ["vis release", "List the release subcommands"],
        ["vis release status", "Show what is about to release"],
        ["vis release doctor", "Diagnose the release setup"],
    ],
    group: "Release",
    loader: () => import("./root-handler"),
    name: "release",
});

export default releaseRoot;
