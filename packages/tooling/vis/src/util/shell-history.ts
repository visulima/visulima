import { appendFile } from "node:fs/promises";
import { homedir, platform } from "node:os";

import { basename, join } from "@visulima/path";

/**
 * Best-effort append of a command string to the user's shell history
 * file so bare `vis run` followed by an interactive pick shows up in
 * the terminal history — up-arrow then re-runs the resolved target.
 *
 * Detects the shell from `$SHELL`/`$ZDOTDIR` and writes in the
 * shell-specific format. Never throws; silently returns when:
 * - the platform is Windows (history formats vary by terminal host),
 * - no recognizable shell is detected,
 * - the history file can't be opened,
 * - `VIS_NO_SHELL_HISTORY` is set (escape hatch).
 *
 * Scoped intentionally to the interactive-picker path. Explicit
 * `vis run &lt;target>` invocations already appear in history verbatim.
 */
export const appendToShellHistory = async (commandLine: string): Promise<void> => {
    if (process.env["VIS_NO_SHELL_HISTORY"]) {
        return;
    }

    if (platform() === "win32") {
        return;
    }

    const shellPath = process.env["SHELL"];

    if (!shellPath) {
        return;
    }

    const shell = basename(shellPath);

    try {
        if (shell === "zsh") {
            await writeZshHistory(commandLine);

            return;
        }

        if (shell === "bash") {
            await writeBashHistory(commandLine);

            return;
        }

        if (shell === "fish") {
            await writeFishHistory(commandLine);
        }
    } catch {
        // History is a nicety, not a requirement. Stay silent on failure.
    }
};

const writeZshHistory = async (commandLine: string): Promise<void> => {
    const target = process.env["HISTFILE"] ?? join(process.env["ZDOTDIR"] ?? homedir(), ".zsh_history");
    // Extended zsh format: `: <start-time>:<elapsed>;<command>\n`
    const entry = `: ${Math.floor(Date.now() / 1000)}:0;${commandLine}\n`;

    await appendFile(target, entry);
};

const writeBashHistory = async (commandLine: string): Promise<void> => {
    const target = process.env["HISTFILE"] ?? join(homedir(), ".bash_history");

    await appendFile(target, `${commandLine}\n`);
};

const writeFishHistory = async (commandLine: string): Promise<void> => {
    const target = join(homedir(), ".local", "share", "fish", "fish_history");
    // fish YAML-ish format; escape backslashes and newlines conservatively.
    const escaped = commandLine.replaceAll("\\", "\\\\").replaceAll("\n", String.raw`\n`);
    const entry = `- cmd: ${escaped}\n  when: ${Math.floor(Date.now() / 1000)}\n`;

    await appendFile(target, entry);
};
