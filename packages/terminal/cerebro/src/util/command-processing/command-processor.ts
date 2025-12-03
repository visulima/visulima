import type { CommandLineOptions } from "@visulima/command-line-args";
// eslint-disable-next-line import/no-extraneous-dependencies
import { commandLineArgs } from "@visulima/command-line-args";

import { POSITIONALS_KEY } from "../../constants";
import EmptyToolbox from "../../empty-toolbox";
import type { Command as ICommand, OptionDefinition, PossibleOptionDefinition } from "../../types/command";
import type { Toolbox as IToolbox } from "../../types/toolbox";
import getBooleanValues from "../arg-processing/get-boolean-values";
import removeBooleanValues from "../arg-processing/remove-boolean-values";
import mergeArguments from "../data-processing/merge-arguments";
import processEnvVariables from "../process-env-variables";

/**
 * Builds option lookup maps for O(1) access instead of O(n) find() operations.
 * @template OD The option definition type.
 * @param commandOptions The command options to build maps from.
 * @returns Maps keyed by option name and alias for fast lookups.
 */
const buildOptionMaps = <OD extends OptionDefinition<unknown>>(
    commandOptions: PossibleOptionDefinition<OD>[],
): {
    optionMapByAlias: Map<string, PossibleOptionDefinition<OD>>;
    optionMapByName: Map<string, PossibleOptionDefinition<OD>>;
} => {
    const optionMapByName = new Map<string, PossibleOptionDefinition<OD>>();
    const optionMapByAlias = new Map<string, PossibleOptionDefinition<OD>>();

    for (const option of commandOptions) {
        optionMapByName.set(option.name, option);

        if (option.alias) {
            const aliases = Array.isArray(option.alias) ? option.alias : [option.alias];

            for (const alias of aliases) {
                optionMapByAlias.set(alias, option);
            }
        }
    }

    return { optionMapByAlias, optionMapByName };
};

/**
 * Prepares the toolbox for command execution.
 * @template OD The option definition type.
 * @param command The command to prepare toolbox for.
 * @param parsedArgs Parsed command-line arguments.
 * @param booleanValues Extracted boolean flag values.
 * @param extraOptions Additional options to merge into toolbox.
 * @returns The prepared toolbox instance.
 */
export const prepareToolbox = <OD extends OptionDefinition<unknown>, TLogger extends Console = Console>(
    command: ICommand<OD, TLogger>,
    parsedArgs: CommandLineOptions,
    booleanValues: Record<string, unknown>,
    extraOptions: Record<string, unknown>,
): IToolbox<TLogger> => {
    const toolbox = new EmptyToolbox(command.name, command as unknown as ICommand) as unknown as IToolbox<TLogger>;

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { _all, positionals } = parsedArgs;

    const hasBooleanValues = Object.keys(booleanValues).length > 0;
    const mergedAll = hasBooleanValues ? { ..._all, ...booleanValues } : _all;

    if (POSITIONALS_KEY in mergedAll) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete mergedAll[POSITIONALS_KEY];
    }

    toolbox.argument = positionals?.[POSITIONALS_KEY] ?? [];

    const hasExtraOptions = Object.keys(extraOptions).length > 0;

    toolbox.options = hasExtraOptions ? { ...mergedAll, ...extraOptions } : mergedAll;

    toolbox.env = processEnvVariables(command.env);

    return toolbox;
};

/**
 * Processes command arguments and options.
 * @template OD The option definition type.
 * @param command The command to process arguments for.
 * @param commandArguments Raw command-line argument strings.
 * @param defaultOptions Default option definitions to merge.
 * @returns Object containing merged arguments, boolean values, and parsed args.
 * @throws {Error} When an argument has both multiple and lazyMultiple options.
 */
export const processCommandArgs = <OD extends OptionDefinition<unknown>, TLogger extends Console = Console>(
    command: ICommand<OD, TLogger>,
    commandArguments: string[],
    defaultOptions: OptionDefinition<unknown>[],
): {
    arguments_: ReturnType<typeof mergeArguments>;
    booleanValues: Record<string, unknown>;
    parsedArgs: CommandLineOptions;
} => {
    const commandOptions = command.options ?? [];
    const hasCommandOptions = commandOptions.length > 0;

    // eslint-disable-next-line @typescript-eslint/naming-convention
    let arguments_ = hasCommandOptions ? mergeArguments([...commandOptions, ...defaultOptions]) : mergeArguments(defaultOptions);

    if (arguments_.length > 0) {
        for (const argument of arguments_) {
            if (argument.multiple && argument.lazyMultiple) {
                throw new Error(`Argument "${argument.name}" cannot have both multiple and lazyMultiple options, please choose one.`);
            }
        }
    }

    if (command.argument) {
        arguments_ = [
            {
                defaultOption: true,
                description: command.argument?.description,
                group: "positionals",
                multiple: true,
                name: POSITIONALS_KEY,
                type: command.argument?.type,
                typeLabel: command.argument?.typeLabel,
            },
            ...arguments_,
        ];
    }

    let argvForParsing: string[];
    let booleanValues: Record<string, unknown>;

    if (hasCommandOptions) {
        const { optionMapByAlias, optionMapByName } = buildOptionMaps(commandOptions);

        argvForParsing = removeBooleanValues(commandArguments, commandOptions, optionMapByName, optionMapByAlias);
        booleanValues = getBooleanValues(commandArguments, commandOptions, optionMapByName, optionMapByAlias);
    } else {
        argvForParsing = commandArguments;
        booleanValues = {};
    }

    const parsedArgs = commandLineArgs(arguments_, {
        argv: argvForParsing,
        camelCase: true,
        partial: true,
        stopAtFirstUnknown: true,
    });

    return { arguments_, booleanValues, parsedArgs };
};

/**
 * Executes a command and returns its result.
 * @template OD The option definition type.
 * @param command The command to execute.
 * @param toolbox The prepared toolbox for command execution.
 * @param _commandArgs Parsed command arguments.
 * @returns Promise resolving to the command execution result.
 */
export const executeCommand = async <OD extends OptionDefinition<unknown>, TLogger extends Console = Console>(
    command: ICommand<OD, TLogger>,
    toolbox: IToolbox<TLogger>,
    _commandArgs: CommandLineOptions,
): Promise<unknown> => await command.execute(toolbox);
