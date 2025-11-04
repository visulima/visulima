import type { CommandLineOptions } from "@visulima/command-line-args";
// eslint-disable-next-line import/no-extraneous-dependencies
import { commandLineArgs } from "@visulima/command-line-args";

import { POSITIONALS_KEY } from "../../constants";
import EmptyToolbox from "../../empty-toolbox";
import type { Command as ICommand, OptionDefinition } from "../../types/command";
import type { Toolbox as IToolbox } from "../../types/toolbox";
import getBooleanValues from "../arg-processing/get-boolean-values";
import removeBooleanValues from "../arg-processing/remove-boolean-values";
import mergeArguments from "../data-processing/merge-arguments";
import processEnvVariables from "../process-env-processor";

/**
 * Prepares the toolbox for command execution.
 * @template OD The option definition type.
 * @param command The command to prepare toolbox for.
 * @param parsedArgs Parsed command-line arguments.
 * @param booleanValues Extracted boolean flag values.
 * @param extraOptions Additional options to merge into toolbox.
 * @returns The prepared toolbox instance.
 */
export const prepareToolbox = <OD extends OptionDefinition<unknown>>(
    command: ICommand<OD>,
    parsedArgs: CommandLineOptions,
    booleanValues: Record<string, unknown>,
    extraOptions: Record<string, unknown>,
): IToolbox => {
    // prepare the execute toolbox
    const toolbox = new EmptyToolbox(command.name, command) as unknown as IToolbox;

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { _all, positionals } = parsedArgs;

    // Merge boolean values into _all without creating intermediate object

    const mergedAll = { ..._all, ...booleanValues };

    if (mergedAll[POSITIONALS_KEY]) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete mergedAll[POSITIONALS_KEY];
    }

    toolbox.argument = positionals?.[POSITIONALS_KEY] ?? [];
    // Merge in single operation instead of spreading twice
    toolbox.options = { ...mergedAll, ...extraOptions };
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
export const processCommandArgs = <OD extends OptionDefinition<unknown>>(
    command: ICommand<OD>,
    commandArguments: string[],
    defaultOptions: OptionDefinition<unknown>[],
): {
    arguments_: ReturnType<typeof mergeArguments>;
    booleanValues: Record<string, unknown>;
    parsedArgs: CommandLineOptions;
} => {
    // eslint-disable-next-line @typescript-eslint/naming-convention,no-underscore-dangle
    let arguments_ = mergeArguments([...command.options ?? [], ...defaultOptions]);

    arguments_.forEach((argument) => {
        if (argument.multiple && argument.lazyMultiple) {
            throw new Error(`Argument "${argument.name}" cannot have both multiple and lazyMultiple options, please choose one.`);
        }
    });

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

    const parsedArgs = commandLineArgs(arguments_, {
        argv: removeBooleanValues(commandArguments, command.options ?? []),
        camelCase: true,
        partial: true,
        stopAtFirstUnknown: true,
    });

    const booleanValues = getBooleanValues(commandArguments, command.options ?? []);

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
export const executeCommand = async <OD extends OptionDefinition<unknown>>(
    command: ICommand<OD>,
    toolbox: IToolbox,
    _commandArgs: CommandLineOptions,
): Promise<unknown> => await command.execute(toolbox);
