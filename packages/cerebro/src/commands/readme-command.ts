// packages/cerebro/src/commands/readme-command.ts
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

import GithubSlugger from "github-slugger";

import type { Command as ICommand, OptionDefinition } from "../types/command";
import type { Section } from "../types/command-line-usage";
import type { Toolbox as IToolbox } from "../types/toolbox";
import commandLineUsage from "../util/command-line-usage";

const slugger = new GithubSlugger();
const slugify = slugger.slug;

interface ReadmeOptions {
    aliases?: boolean;
    dryRun?: boolean;
    multi?: boolean;
    nestedTopicsDepth?: number;
    outputDir?: string;
    readmePath?: string;
    repositoryPrefix?: string;
    version?: string;
}

const compact = <T>(array: (T | undefined | null | false | "")[]): T[] => array.filter(Boolean);

const uniqBy = <T>(array: T[], keyFunction: (item: T) => string): T[] => {
    const seen = new Set<string>();
    const result: T[] = [];

    for (const item of array) {
        const key = keyFunction(item);

        if (!seen.has(key)) {
            seen.add(key);
            result.push(item);
        }
    }

    return result;
};

/**
 * Formats command usage string from command definition.
 */
const formatCommandUsage = (command: ICommand, cliName: string): string => {
    const fullPath = command.commandPath ? [...command.commandPath, command.name] : [command.name];
    const commandId = fullPath.join(" ");

    if (command.argument) {
        const argumentName = command.argument.name?.toUpperCase() ?? "ARG";
        const argumentString = command.argument.required ? argumentName : `[${argumentName}]`;

        return `${cliName} ${commandId} ${argumentString}`;
    }

    return `${cliName} ${commandId}`;
};

/**
 * Adds environment variables section to usage groups.
 */
const addEnvironmentVariables = (command: ICommand, usageGroups: Section[]): void => {
    if (!Array.isArray(command.env) || command.env.length === 0) {
        return;
    }

    const visibleEnvVariables = command.env.filter((envVariable) => !envVariable.hidden);

    if (visibleEnvVariables.length > 0) {
        usageGroups.push({
            content: visibleEnvVariables.map((envVariable) => [envVariable.name, envVariable.description ?? ""]),
            header: " Environment Variables ",
        });
    }
};

/**
 * Formats command help text as markdown code block.
 */
const formatCommandHelp = (command: ICommand, cliName: string): string => {
    const usageGroups: Section[] = [];

    const fullCommandPath = command.commandPath ? [...command.commandPath, command.name] : [command.name];
    const commandDisplay = fullCommandPath.join(" ");
    const hasArgument = Boolean(command.argument);
    const hasOptions = Boolean(command.options);

    usageGroups.push({
        content: `${cliName} ${commandDisplay}${hasArgument ? " [positional arguments]" : ""}${hasOptions ? " [options]" : ""}`,
        header: " Usage ",
    });

    if (command.description) {
        usageGroups.push({ content: command.description, header: " Description " });
    }

    if (command.argument) {
        usageGroups.push({ header: "Command Positional Arguments", isArgument: true, optionList: [command.argument] });
    }

    if (Array.isArray(command.options) && command.options.length > 0) {
        usageGroups.push({
            header: " Command Options ",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            optionList: command.options.filter((option: any) => !option.hidden) as OptionDefinition<any>[],
        });
    }

    addEnvironmentVariables(command, usageGroups);

    if (command.alias !== undefined && command.alias.length > 0) {
        const alias = Array.isArray(command.alias) ? command.alias : [command.alias];

        usageGroups.splice(1, 0, {
            content: alias,
            header: "Alias(es)",
        });
    }

    if (Array.isArray(command.examples) && command.examples.length > 0) {
        usageGroups.push({
            content: command.examples,
            header: "Examples",
        });
    }

    return commandLineUsage(usageGroups);
};

/**
 * Renders a single command as markdown.
 */
const renderCommand = (command: ICommand, cliName: string): string => {
    const title = command.description?.trim().split("\n")[0] ?? "";
    const usage = formatCommandUsage(command, cliName);
    const helpText = formatCommandHelp(command, cliName);

    return compact([`## \`${usage}\``, title, `\`\`\`\n${helpText.trim()}\n\`\`\``]).join("\n\n");
};

/**
 * Generates usage section for README.
 */
const generateUsage = (cliName: string, packageName: string, version: string | undefined, nodeVersion: string): string => {
    const versionFlags = ["--version", "-V"];
    const versionFlagsString = `(${versionFlags.join("|")})`;

    return `\`\`\`sh-session
$ npm install -g ${packageName}
$ ${cliName} COMMAND
running command...
$ ${cliName} ${versionFlagsString}
${packageName}/${version ?? "unknown"} ${process.platform}-${process.arch} node-v${nodeVersion}
$ ${cliName} --help [COMMAND]
USAGE
  $ ${cliName} COMMAND
...
\`\`\`
`;
};

/**
 * Generates commands section for README.
 */
const generateCommands = async (commands: ICommand[], cliName: string, _options: ReadmeOptions): Promise<string> => {
    const commandList = await Promise.all(
        commands.map(async (command) => {
            const usage = formatCommandUsage(command, cliName);

            return `* [\`${usage}\`](#${await slugify(usage)})`;
        }),
    );

    const commandDocumentation = commands.map((command) => renderCommand(command, cliName)).map((s) => `${s.trim()}\n`);

    return [...commandList, "", ...commandDocumentation].join("\n").trim();
};

/**
 * Writes file ensuring directory exists.
 */
const writeFileWithDirectory = async (filePath: string, content: string): Promise<void> => {
    const directory = dirname(filePath);

    if (!existsSync(directory)) {
        await mkdir(directory, { recursive: true });
    }

    await writeFile(filePath, content, "utf8");
};

/**
 * Generates multi-file commands documentation.
 */
const generateMultiCommands = async (commands: ICommand[], outputDirectory: string, cliName: string, options: ReadmeOptions): Promise<string> => {
    // Group commands by their group property
    const groupedCommands = new Map<string, ICommand[]>();

    for (const command of commands) {
        const group = command.group ?? "__Other";
        const groupCommands = groupedCommands.get(group) ?? [];

        groupCommands.push(command);
        groupedCommands.set(group, groupCommands);
    }

    const groups = [...groupedCommands.entries()].filter(([group]) => group !== "__Other");

    // Create topic files for each group
    await Promise.all(
        groups.map(async ([group, groupCommands]) => {
            const groupPath = group.replaceAll(":", "/");
            const filePath = join(".", outputDirectory, `${groupPath}.md`);
            const bin = `\`${cliName} ${group}\``;

            const document = `${[
                bin,
                "=".repeat(bin.length),
                "",
                `Commands in the ${group} group.`,
                "",
                await generateCommands(groupCommands, cliName, options),
            ]
                .join("\n")
                .trim()}\n`;

            if (!options.dryRun) {
                await writeFileWithDirectory(resolve(process.cwd(), filePath), document);
            }
        }),
    );

    // Generate topic index
    const topicLinks = groups.map(([group]) => {
        const groupPath = group.replaceAll(":", "/");

        return `* [\`${cliName} ${group}\`](${outputDirectory}/${groupPath}.md)`;
    });

    return `${["# Command Topics\n", ...topicLinks].join("\n").trim()}\n`;
};

/**
 * Normalizes line endings to LF.
 */
const normalizeLineEndings = (text: string): string => text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");

/**
 * Generates table of contents from README content.
 */
const generateTableOfContents = async (readme: string): Promise<string> => {
    const normalizedReadme = normalizeLineEndings(readme);
    const toc = await Promise.all(
        normalizedReadme
            .split("\n")
            .filter((line) => line.startsWith("# "))
            .map((line) => line.trim().slice(2))
            .map(async (line) => `* [${line}](#${await slugify(line)})`),
    );

    return toc.join("\n");
};

/**
 * Escapes special regex characters in a string.
 */
const escapeRegex = (string_: string): string => string_.replaceAll(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);

/**
 * Replaces a tag in README with new content.
 */
const replaceTag = (readme: string, tag: string, body: string): string => {
    const normalizedReadme = normalizeLineEndings(readme);
    const tagStart = `<!-- ${tag} -->`;
    const tagStop = `<!-- ${tag}stop -->`;

    if (normalizedReadme.includes(tagStart) && normalizedReadme.includes(tagStop)) {
        const escapedStart = escapeRegex(tagStart);
        const escapedStop = escapeRegex(tagStop);
        const tagPattern = new RegExp(`${escapedStart}(.|\\n)*${escapedStop}`, "m");

        return normalizedReadme.replace(tagPattern, `${tagStart}\n${body}\n${tagStop}`);
    }

    return normalizedReadme.replace(tagStart, `${tagStart}\n${body}\n${tagStop}`);
};

/**
 * Generates README documentation for cerebro CLI commands.
 */
const readmeCommand: ICommand = {
    description: "Generate README documentation for CLI commands",
    execute: async ({ logger, options, runtime }: IToolbox) => {
        const cliName = runtime.getCliName();
        const packageName = runtime.getPackageName() ?? cliName;
        const packageVersion = runtime.getPackageVersion();
        const nodeVersion = process.versions.node;

        const readmeOptions: ReadmeOptions = {
            aliases: options?.aliases as boolean | undefined,
            dryRun: options?.dryRun as boolean | undefined,
            multi: options?.multi as boolean | undefined,
            nestedTopicsDepth: options?.nestedTopicsDepth as number | undefined,
            outputDir: (options?.outputDir as string | undefined) ?? "docs",
            readmePath: (options?.readmePath as string | undefined) ?? "README.md",
            repositoryPrefix: options?.repositoryPrefix as string | undefined,
            version: (options?.version as string | undefined) ?? packageVersion ?? undefined,
        };

        const commandsMap = runtime.getCommands();
        const commands = [...commandsMap.values()]
            .filter((c) => !c.hidden)
            .filter((c) => {
                if (readmeOptions.aliases) {
                    return true;
                }

                return c.name === commandsMap.get(c.name)?.name;
            })
            .toSorted((a, b) => {
                const aPath = a.commandPath ? [...a.commandPath, a.name].join(" ") : a.name;
                const bPath = b.commandPath ? [...b.commandPath, b.name].join(" ") : b.name;

                return aPath.localeCompare(bPath);
            });

        const uniqueCommands = uniqBy(commands, (c) => {
            const path = c.commandPath ? [...c.commandPath, c.name].join(" ") : c.name;

            return path;
        });

        logger.debug(`Processing ${uniqueCommands.length} commands for README generation`);

        // Read existing README or create template
        let readme: string;

        const readmePath = resolve(process.cwd(), readmeOptions.readmePath ?? "README.md");

        if (existsSync(readmePath)) {
            const rawReadme = await readFile(readmePath, "utf8");

            readme = normalizeLineEndings(rawReadme);
        } else {
            logger.warn(`README file not found at ${readmePath}, creating template`);
            readme = `# ${packageName}\n\n<!-- usage -->\n<!-- usagestop -->\n\n<!-- commands -->\n<!-- commandsstop -->\n\n<!-- toc -->\n<!-- tocstop -->\n`;
        }

        // Replace tags
        const outputDirectory = readmeOptions.outputDir ?? "docs";
        const version = readmeOptions.version ?? packageVersion ?? "unknown";

        readme = replaceTag(readme, "usage", generateUsage(cliName, packageName, version, nodeVersion));
        readme = replaceTag(
            readme,
            "commands",
            readmeOptions.multi
                ? await generateMultiCommands(uniqueCommands, outputDirectory, cliName, readmeOptions)
                : await generateCommands(uniqueCommands, cliName, readmeOptions),
        );
        readme = replaceTag(readme, "toc", await generateTableOfContents(readme));
        readme = `${readme.trimEnd()}\n`;

        // Write README
        if (readmeOptions.dryRun) {
            logger.info("Dry run mode - README not written");
            logger.info(`Generated README content:\n${readme}`);
        } else {
            await writeFileWithDirectory(readmePath, readme);
            logger.info(`README generated successfully at ${readmePath}`);
        }
    },
    name: "readme",
    options: [
        {
            description: "Include aliases in command list",
            name: "aliases",
            type: Boolean,
        } satisfies OptionDefinition<boolean>,
        {
            description: "Show what would be generated without writing files",
            name: "dry-run",
            type: Boolean,
        } satisfies OptionDefinition<boolean>,
        {
            description: "Generate multi-file documentation by command groups",
            name: "multi",
            type: Boolean,
        } satisfies OptionDefinition<boolean>,
        {
            description: "Maximum depth for nested topics when using multi-file mode",
            name: "nested-topics-depth",
            type: Number,
        } satisfies OptionDefinition<number>,
        {
            description: "Output directory for multi-file documentation",
            name: "output-dir",
            type: String,
            typeLabel: "{underline directory}",
        } satisfies OptionDefinition<string>,
        {
            description: "Path to README file to generate",
            name: "readme-path",
            type: String,
            typeLabel: "{underline path}",
        } satisfies OptionDefinition<string>,
        {
            description: "Repository prefix for code links",
            name: "repository-prefix",
            type: String,
            typeLabel: "{underline prefix}",
        } satisfies OptionDefinition<string>,
        {
            description: "Version to use in generated documentation",
            name: "version",
            type: String,
            typeLabel: "{underline version}",
        } satisfies OptionDefinition<string>,
    ],
};

export default readmeCommand;
