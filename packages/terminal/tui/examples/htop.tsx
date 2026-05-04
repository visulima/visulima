/* eslint-disable @typescript-eslint/no-confusing-void-expression, e18e/prefer-static-regex, func-style, sonarjs/no-nested-conditional, sonarjs/no-os-command-from-path, unicorn/no-process-exit */

/**
 * htop.tsx — htop-style system monitor (Unix-like environments)
 *
 * Uses Node `os` metrics plus `ps aux` process sampling.
 *
 * Controls:
 *   q / Esc   quit
 *   c         sort by CPU
 *   m         sort by memory
 *
 * Run: node --import @oxc-node/core/register examples/htop.tsx
 */

import { exec } from "node:child_process";
import os from "node:os";

import { Box, Spacer, Text } from "@visulima/tui";
import { render, useApp, useInput, useWindowSize } from "@visulima/tui/react";
import React, { useEffect, useRef, useState } from "react";

if (process.platform === "win32") {
    console.error("examples/htop.tsx is Unix-only (uses `ps aux`).");
    process.exit(1);
}

type CpuSnapshot = ReturnType<typeof os.cpus>;

interface ProcInfo {
    cmd: string;
    cpu: number;
    mem: number;
    pid: string;
    user: string;
}

type SortMode = "cpu" | "mem";

function cpuPercents(previous: CpuSnapshot, current: CpuSnapshot): number[] {
    return current.map((cpu, i) => {
        const p = previous[i].times;
        const c = cpu.times;
        const previousTotal = p.user + p.nice + p.sys + p.idle + p.irq;
        const currentTotal = c.user + c.nice + c.sys + c.idle + c.irq;
        const totalDiff = currentTotal - previousTotal;
        const idleDiff = c.idle - p.idle;

        if (totalDiff === 0) {
            return 0;
        }

        return Math.round(((totalDiff - idleDiff) / totalDiff) * 100);
    });
}

function readProcs(callback: (procs: ProcInfo[]) => void) {
    exec("ps aux", { timeout: 2000 }, (error, stdout) => {
        if (error) {
            callback([]);

            return;
        }

        const procs = stdout
            .trim()
            .split("\n")
            .slice(1)
            .map((line) => {
                const parts = line.trim().split(/\s+/);

                return {
                    cmd: parts.slice(10).join(" "),
                    cpu: Number.parseFloat(parts[2] ?? "0"),
                    mem: Number.parseFloat(parts[3] ?? "0"),
                    pid: parts[1] ?? "",
                    user: parts[0] ?? "",
                };
            });

        callback(procs);
    });
}

function miniBar(pct: number, width: number, color: string) {
    const filled = Math.round((Math.min(pct, 100) / 100) * width);
    const empty = width - filled;

    return (
        <Box flexDirection="row">
            <Text color={color}>{"|".repeat(filled)}</Text>
            <Text dim>{"·".repeat(empty)}</Text>
        </Box>
    );
}

function formatUptime(secs: number) {
    const d = Math.floor(secs / 86_400);
    const h = Math.floor((secs % 86_400) / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const parts = [];

    if (d > 0) {
        parts.push(`${d}d`);
    }

    if (h > 0 || d > 0) {
        parts.push(`${h}h`);
    }

    parts.push(`${m}m`);

    return parts.join(" ");
}

function formatMem(bytes: number) {
    if (bytes >= 1e9) {
        return `${(bytes / 1e9).toFixed(1)}G`;
    }

    return `${(bytes / 1e6).toFixed(0)}M`;
}

const App = () => {
    const { exit } = useApp();
    const { columns } = useWindowSize();

    const [cpuPcts, setCpuPcts] = useState<number[]>(() => os.cpus().map(() => 0));
    const [memUsed, setMemUsed] = useState(os.totalmem() - os.freemem());
    const [loadAvg, setLoadAvg] = useState(os.loadavg());
    const [uptime, setUptime] = useState(os.uptime());
    const [procs, setProcs] = useState<ProcInfo[]>([]);
    const [sort, setSort] = useState<SortMode>("cpu");

    const previousCpus = useRef(os.cpus());

    useEffect(() => {
        readProcs(setProcs);

        const timer = setInterval(() => {
            const current = os.cpus();

            setCpuPcts(cpuPercents(previousCpus.current, current));
            previousCpus.current = current;
            setMemUsed(os.totalmem() - os.freemem());
            setLoadAvg(os.loadavg());
            setUptime(os.uptime());
            readProcs(setProcs);
        }, 1000);

        return () => clearInterval(timer);
    }, []);

    useInput((input, key) => {
        if (key.escape || input === "q" || input === "Q") {
            exit();
        }

        if (input === "c" || input === "C") {
            setSort("cpu");
        }

        if (input === "m" || input === "M") {
            setSort("mem");
        }
    });

    const totalMem = os.totalmem();
    const memPct = Math.round((memUsed / totalMem) * 100);
    const cpuCount = cpuPcts.length;
    const barW = Math.max(8, Math.floor((columns - 20) / Math.min(cpuCount, 10)) - 2);

    const sorted = procs.toSorted((a, b) => (sort === "cpu" ? b.cpu - a.cpu : b.mem - a.mem)).slice(0, 20);
    const hostname = os.hostname().split(".")[0];

    return (
        <Box flexDirection="column" gap={1}>
            <Box borderColor="green" borderStyle="round" flexDirection="row" flexShrink={0} gap={4} paddingX={2}>
                <Text bold color="green">
                    {hostname}
                </Text>
                <Text dim>
                    up
{" "}
<Text color="white">{formatUptime(uptime)}</Text>
                </Text>
                <Text dim>
                    load
{" "}
<Text color={loadAvg[0] > cpuCount ? "red" : loadAvg[0] > cpuCount * 0.7 ? "yellow" : "green"}>{loadAvg[0].toFixed(2)}</Text>
{" "}
                    <Text dim>
                        {loadAvg[1].toFixed(2)}
{" "}
{loadAvg[2].toFixed(2)}
                    </Text>
                </Text>
                <Spacer />
                <Text dim>
{cpuCount}
{" "}
cores ·
{" "}
                </Text>
                <Text color="cyan">{formatMem(totalMem)}</Text>
                <Text dim> RAM · q quit</Text>
            </Box>

            <Box borderColor="gray" borderStyle="single" flexDirection="column" flexShrink={0} paddingX={2} paddingY={1}>
                <Text bold dim>
                    CPU
                </Text>
                <Box flexDirection="row" flexWrap="wrap" gap={1} marginTop={1}>
                    {cpuPcts.map((pct, i) => {
                        const color = pct > 80 ? "red" : pct > 50 ? "yellow" : "green";

                        return (
                            <Box flexDirection="row" key={i} width={barW + 12}>
                                <Text dim>
{String(i + 1).padStart(2)}
{" "}
                                </Text>
                                <Text color={color}>[</Text>
                                {miniBar(pct, barW, color)}
                                <Text color={color}>]</Text>
                                <Text bold color={color}>
                                    {" "}
                                    {String(pct).padStart(3)}
%
                                </Text>
                            </Box>
                        );
                    })}
                </Box>
            </Box>

            <Box borderColor="gray" borderStyle="single" flexDirection="row" flexShrink={0} gap={2} paddingX={2} paddingY={1}>
                <Text bold dim>
                    Mem
                </Text>
                <Text color="cyan">[</Text>
                {miniBar(memPct, 40, memPct > 80 ? "red" : memPct > 60 ? "yellow" : "cyan")}
                <Text color="cyan">]</Text>
                <Text bold color="cyan">
                    {String(memPct).padStart(3)}
%
                </Text>
                <Text dim>
                    {formatMem(memUsed)}
{" "}
/
{formatMem(totalMem)}
                </Text>
            </Box>

            <Box borderColor="gray" borderStyle="single" flexDirection="column" flexGrow={1} paddingX={2} paddingY={1}>
                <Box flexDirection="row" marginBottom={1}>
                    <Box width={7}>
                        <Text bold dim>
                            PID
                        </Text>
                    </Box>
                    <Box width={14}>
                        <Text bold dim>
                            USER
                        </Text>
                    </Box>
                    <Box width={8}>
                        <Text bold color={sort === "cpu" ? "yellow" : undefined} dim={sort !== "cpu"}>
                            %CPU
                        </Text>
                    </Box>
                    <Box width={8}>
                        <Text bold color={sort === "mem" ? "yellow" : undefined} dim={sort !== "mem"}>
                            %MEM
                        </Text>
                    </Box>
                    <Text bold dim>
                        COMMAND
                    </Text>
                    <Spacer />
                    <Text dim>sort: </Text>
                    <Text bold={sort === "cpu"} color={sort === "cpu" ? "yellow" : "gray"}>
                        C
                    </Text>
                    <Text dim>pu </Text>
                    <Text bold={sort === "mem"} color={sort === "mem" ? "yellow" : "gray"}>
                        M
                    </Text>
                    <Text dim>em</Text>
                </Box>

                {sorted.length === 0
                    ? (
                    <Text dim>no process rows available (check `ps` availability)</Text>
                    )
                    : (
                        sorted.map((p, i) => {
                            const cpuColor = p.cpu > 50 ? "red" : p.cpu > 20 ? "yellow" : "white";
                            const memColor = p.mem > 10 ? "red" : p.mem > 5 ? "yellow" : "white";
                            const cmd = p.cmd.length > columns - 40 ? `${p.cmd.slice(0, columns - 43)}…` : p.cmd;
                            const cmdDisplay = cmd.startsWith("/") ? (cmd.split("/").pop() ?? cmd) : cmd;

                            return (
                            <Box flexDirection="row" key={`${p.pid}-${i}`}>
                                <Box width={7}>
                                    <Text dim>{p.pid}</Text>
                                </Box>
                                <Box width={14}>
                                    <Text color="cyan">{p.user.slice(0, 12)}</Text>
                                </Box>
                                <Box width={8}>
                                    <Text bold={p.cpu > 20} color={cpuColor}>
                                        {p.cpu.toFixed(1).padStart(5)}
                                    </Text>
                                </Box>
                                <Box width={8}>
                                    <Text color={memColor}>{p.mem.toFixed(1).padStart(5)}</Text>
                                </Box>
                                <Text color={i === 0 ? "white" : "gray"}>{cmdDisplay}</Text>
                            </Box>
                            );
                        })
                    )}
            </Box>
        </Box>
    );
};

render(<App />);
