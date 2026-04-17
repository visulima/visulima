import { relative } from "@visulima/path";

import { ConfigError } from "../errors";
import { matchFiles } from "../match";
import type { CommandDescriptor, CustomTask, PatternDescriptor, StagedTask } from "../types";

const isCustomTask = (value: unknown): value is CustomTask =>
    typeof value === "object" && value !== null && typeof (value as CustomTask).title === "string" && typeof (value as CustomTask).task === "function";

export interface BuildTaskGraphOptions {
    /** Match globs case-insensitively — enable on HFS+/APFS (macOS) and NTFS (Windows). */
    readonly caseInsensitive?: boolean;
    readonly config: Readonly<Record<string, StagedTask>>;
    readonly cwd: string;
    readonly files: ReadonlyArray<string>;
    readonly relative?: boolean;
}

/** Builds the list of pattern descriptors that the runner will execute. */
export const buildTaskGraph = async (options: BuildTaskGraphOptions): Promise<PatternDescriptor[]> => {
    // Counters are scoped to this call so ids don't leak across invocations and the module stays side-effect-free.
    let patternCounter = 0;
    let commandCounter = 0;

    const nextPatternId = (): string => {
        patternCounter += 1;

        return `pattern-${patternCounter}`;
    };

    const nextCommandId = (): string => {
        commandCounter += 1;

        return `cmd-${commandCounter}`;
    };

    const expandTask = async (value: StagedTask, files: ReadonlyArray<string>, commands: CommandDescriptor[]): Promise<void> => {
        if (typeof value === "string") {
            commands.push({
                command: value,
                files,
                id: nextCommandId(),
                source: "string",
                title: value,
            });

            return;
        }

        if (Array.isArray(value)) {
            for (const item of value) {
                await expandTask(item as StagedTask, files, commands);
            }

            return;
        }

        if (typeof value === "function") {
            const generated = await value([...files]);

            if (typeof generated === "string") {
                commands.push({
                    command: generated,
                    files,
                    id: nextCommandId(),
                    source: "function",
                    title: generated,
                });

                return;
            }

            if (Array.isArray(generated)) {
                for (const item of generated) {
                    if (typeof item === "string") {
                        commands.push({
                            command: item,
                            files,
                            id: nextCommandId(),
                            source: "function",
                            title: item,
                        });
                    } else if (isCustomTask(item)) {
                        commands.push({
                            files,
                            id: nextCommandId(),
                            run: item.task,
                            source: "custom",
                            title: item.title,
                        });
                    } else {
                        throw new ConfigError("Task function returned an array with an unsupported entry — expected strings or { title, task }.");
                    }
                }

                return;
            }

            if (isCustomTask(generated)) {
                commands.push({
                    files,
                    id: nextCommandId(),
                    run: generated.task,
                    source: "custom",
                    title: generated.title,
                });

                return;
            }

            throw new ConfigError("Task function returned an unsupported value — expected string, string[], or { title, task }.");
        }

        if (isCustomTask(value)) {
            commands.push({
                files,
                id: nextCommandId(),
                run: value.task,
                source: "custom",
                title: value.title,
            });

            return;
        }

        throw new ConfigError("Unsupported task value — expected string, string[], function, or { title, task }.");
    };

    const patterns: PatternDescriptor[] = [];

    for (const [pattern, value] of Object.entries(options.config)) {
        const matched = matchFiles(pattern, options.files, options.cwd, { caseInsensitive: options.caseInsensitive === true });

        if (matched.length === 0) {
            continue;
        }

        const view = options.relative ? matched.map((file) => relative(options.cwd, file)) : matched;
        const commands: CommandDescriptor[] = [];

        await expandTask(value, view, commands);

        if (commands.length === 0) {
            continue;
        }

        patterns.push({
            commands,
            files: view,
            id: nextPatternId(),
            pattern,
            title: `${pattern} — ${matched.length} file${matched.length === 1 ? "" : "s"}`,
        });
    }

    return patterns;
};

export { isCustomTask };
