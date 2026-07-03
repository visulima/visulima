/**
 * Reading the ancestry of the current process — the parent-chain of command
 * names — so session detection can spot agents that spawn shells WITHOUT
 * marking them with an environment variable (Octofriend, Devin, Factory Droid).
 * This is the opt-in, meaningfully-slower complement to the env-marker table in
 * `session.ts`: it spawns a subprocess (or reads `/proc`), so callers reach for
 * it only when they explicitly ask to `checkProcesses`.
 *
 * The pure parsers (`parsePsRow`, `parseWmicRow`, `parseProcStat`) and the
 * `walkAncestry`/`normalizeProcessName` helpers are exported for unit testing;
 * only `getProcessAncestry` is re-exported from the package entrypoint.
 */
import { execFile } from "node:child_process";
import { readFileSync } from "node:fs";
import { promisify } from "node:util";

import { DETECTION_TIMEOUT, IS_WINDOWS } from "./constants";

const execFileAsync = promisify(execFile);

/** Trailing executable suffix stripped from a process name (`.exe`/`.cmd`/`.bat`). */
const EXECUTABLE_SUFFIX_REGEX = /\.(?:bat|cmd|exe)$/i;

/** Runs of whitespace separating the columns of a `ps` listing. */
const WHITESPACE_REGEX = /\s+/;

/**
 * Max bytes buffered from `ps`/`wmic`. Node's default is 1 MB, which a host
 * with tens of thousands of processes can exceed — that would reject the exec
 * and lose detection. 16 MB comfortably covers pathological process counts.
 */
const MAX_PROCESS_LIST_BYTES = 16 * 1024 * 1024;

/** One parsed row of a process listing. */
interface ProcessRow {
    comm: string;
    pid: number;
    ppid: number;
}

/** Strip a trailing `.exe`/`.cmd`/`.bat` and directory prefix from a process name. */
const normalizeProcessName = (name: string): string => {
    const base = name.replaceAll("\\", "/").split("/").pop() ?? name;

    return base.replace(EXECUTABLE_SUFFIX_REGEX, "").toLowerCase();
};

/** Walk a `pid -> { comm, ppid }` map from `startPid` up to the root, collecting command names. */
const walkAncestry = (table: Map<number, { comm: string; ppid: number }>, startPid: number): string[] => {
    const names: string[] = [];
    const seen = new Set<number>();
    let pid = startPid;

    while (pid > 0 && !seen.has(pid)) {
        seen.add(pid);

        const entry = table.get(pid);

        if (!entry) {
            break;
        }

        names.push(normalizeProcessName(entry.comm));
        pid = entry.ppid;
    }

    return names;
};

/** Parse one `ps -Ao pid=,ppid=,comm=` row (`comm` may contain spaces). Returns `undefined` for header/blank/malformed lines. */
const parsePsRow = (line: string): ProcessRow | undefined => {
    const columns = line.trim().split(WHITESPACE_REGEX);

    if (columns.length < 3) {
        return undefined;
    }

    const pid = Number.parseInt(columns[0] ?? "", 10);
    const ppid = Number.parseInt(columns[1] ?? "", 10);

    if (!Number.isFinite(pid) || !Number.isFinite(ppid)) {
        return undefined;
    }

    return { comm: columns.slice(2).join(" "), pid, ppid };
};

/** Parse one `wmic process ... /format:csv` row (columns: `Node,Name,ParentProcessId,ProcessId`). */
const parseWmicRow = (line: string): ProcessRow | undefined => {
    const columns = line.trim().split(",");

    if (columns.length < 4) {
        return undefined;
    }

    const pid = Number.parseInt(columns[3] ?? "", 10);
    const ppid = Number.parseInt(columns[2] ?? "", 10);

    if (!Number.isFinite(pid) || !Number.isFinite(ppid)) {
        return undefined;
    }

    return { comm: columns[1] ?? "", pid, ppid };
};

/** Parse the `comm` and `ppid` out of a Linux `/proc/&lt;pid>/stat` string. */
const parseProcStat = (content: string): { comm: string; ppid: number } | undefined => {
    // Format: "pid (comm) state ppid ...". `comm` may contain spaces and parentheses,
    // so slice between the FIRST "(" and the LAST ")".
    const open = content.indexOf("(");
    const close = content.lastIndexOf(")");

    if (open === -1 || close === -1) {
        return undefined;
    }

    const ppid = Number.parseInt(content.slice(close + 2).split(" ")[1] ?? "", 10);

    if (!Number.isFinite(ppid)) {
        return undefined;
    }

    return { comm: content.slice(open + 1, close), ppid };
};

/** Spawn a process listing, parse each row with `parseRow`, then walk the ancestry from `startPid`. */
const buildTableAncestry = async (
    command: string,
    arguments_: string[],
    parseRow: (line: string) => ProcessRow | undefined,
    startPid: number,
): Promise<string[]> => {
    const { stdout } = await execFileAsync(command, arguments_, { encoding: "utf8", maxBuffer: MAX_PROCESS_LIST_BYTES, timeout: DETECTION_TIMEOUT });
    const table = new Map<number, { comm: string; ppid: number }>();

    for (const line of stdout.split("\n")) {
        const row = parseRow(line);

        if (row) {
            table.set(row.pid, { comm: row.comm, ppid: row.ppid });
        }
    }

    return walkAncestry(table, startPid);
};

/** Read the Linux `/proc` filesystem to build the ancestry without spawning a subprocess. */
const readLinuxAncestry = (startPid: number): string[] => {
    const names: string[] = [];
    const seen = new Set<number>();
    let pid = startPid;

    while (pid > 1 && !seen.has(pid)) {
        seen.add(pid);

        const parsed = parseProcStat(readFileSync(`/proc/${String(pid)}/stat`, "utf8"));

        if (!parsed) {
            break;
        }

        names.push(normalizeProcessName(parsed.comm));

        if (parsed.ppid <= 1) {
            break;
        }

        pid = parsed.ppid;
    }

    return names;
};

/**
 * Return the command names of the current process and its ancestors, nearest
 * first, lowercased and stripped of any `.exe`/`.cmd`/`.bat` suffix. Resolves
 * to `[]` on any failure (missing `/proc`, `ps`/`wmic` absent or timed out) so
 * callers can treat it as "no ancestry signal" rather than an error.
 * @param startPid PID to start from; defaults to the current process.
 */
const getProcessAncestry = async (startPid: number = process.pid): Promise<string[]> => {
    try {
        if (IS_WINDOWS) {
            return await buildTableAncestry("wmic", ["process", "get", "ProcessId,ParentProcessId,Name", "/format:csv"], parseWmicRow, startPid);
        }

        if (process.platform === "linux") {
            return readLinuxAncestry(startPid);
        }

        return await buildTableAncestry("ps", ["-Ao", "pid=,ppid=,comm="], parsePsRow, startPid);
    } catch {
        return [];
    }
};

export { getProcessAncestry, normalizeProcessName, parseProcStat, parsePsRow, parseWmicRow, walkAncestry };
