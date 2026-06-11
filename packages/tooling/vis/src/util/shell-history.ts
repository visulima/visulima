import { appendFile, mkdir } from "node:fs/promises";
import { homedir, platform } from "node:os";

import { basename, dirname, join } from "@visulima/path";

/**
 * Best-effort append of a command string to the user's shell history
 * file so bare `vis run` followed by an interactive pick shows up in
 * the terminal history — up-arrow then re-runs the resolved target.
 *
 * Detects the shell from `$SHELL`/`$ZDOTDIR` and writes in the
 * shell-specific format. On Windows it appends to PowerShell's PSReadLine
 * history (`ConsoleHost_history.txt`), a plain append-only text file, so
 * the up-arrow replay story works there too. Never throws; silently
 * returns when:
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
        try {
            await writePowerShellHistory(commandLine);
        } catch {
            // History is a nicety, not a requirement. Stay silent on failure.
        }

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

/**
 * Collapse control characters (newlines, carriage returns, NUL, …) in a
 * picked command line into single spaces before writing it to a flat,
 * newline-delimited history file. A task name is repo-controlled (via vis
 * config) and could contain a `\n`, which would otherwise inject an extra,
 * arbitrary entry into `~/.zsh_history` / `~/.bash_history` that the user
 * might later re-execute via up-arrow or Ctrl-R.
 */
// eslint-disable-next-line no-control-regex
const stripControlCharacters = (commandLine: string): string => commandLine.replaceAll(/[\u0000-\u001F\u007F]/gu, " ").trimEnd();

const writeZshHistory = async (commandLine: string): Promise<void> => {
    const target = process.env["HISTFILE"] ?? join(process.env["ZDOTDIR"] ?? homedir(), ".zsh_history");
    // Extended zsh format: `: <start-time>:<elapsed>;<command>\n`
    const entry = `: ${Math.floor(Date.now() / 1000)}:0;${stripControlCharacters(commandLine)}\n`;

    await appendFile(target, entry);
};

const writeBashHistory = async (commandLine: string): Promise<void> => {
    const target = process.env["HISTFILE"] ?? join(homedir(), ".bash_history");

    await appendFile(target, `${stripControlCharacters(commandLine)}\n`);
};

/**
 * Append to PowerShell's PSReadLine history file. It is a plain,
 * append-only, one-command-per-line text file (CRLF-delimited on Windows),
 * so up-arrow / Ctrl-r replay picks the entry up on the next session.
 *
 * Location: `%APPDATA%\Microsoft\Windows\PowerShell\PSReadLine\ConsoleHost_history.txt`,
 * overridable via `VIS_PSREADLINE_HISTORY` (used by tests). Control
 * characters are collapsed for the same injection reason as the POSIX
 * writers.
 */
const writePowerShellHistory = async (commandLine: string): Promise<void> => {
    const override = process.env["VIS_PSREADLINE_HISTORY"];
    const appData = process.env["APPDATA"];

    if (override === undefined && (appData === undefined || appData === "")) {
        return;
    }

    const target = override ?? join(appData as string, "Microsoft", "Windows", "PowerShell", "PSReadLine", "ConsoleHost_history.txt");

    // The PSReadLine directory may not exist yet on a fresh profile.
    await mkdir(dirname(target), { recursive: true });

    await appendFile(target, `${stripControlCharacters(commandLine)}\r\n`);
};

const writeFishHistory = async (commandLine: string): Promise<void> => {
    const target = join(homedir(), ".local", "share", "fish", "fish_history");
    // fish YAML-ish format; escape backslashes and newlines conservatively.
    const escaped = commandLine.replaceAll("\\", "\\\\").replaceAll("\n", String.raw`\n`);
    const entry = `- cmd: ${escaped}\n  when: ${Math.floor(Date.now() / 1000)}\n`;

    await appendFile(target, entry);
};
