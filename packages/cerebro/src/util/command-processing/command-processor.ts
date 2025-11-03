import type { CommandLineOptions } from "@visulima/command-line-args";
import { commandLineArgs } from "@visulima/command-line-args";

import { POSITIONALS_KEY } from "../../constants";
import EmptyToolbox from "../../empty-toolbox";
import type { Command as ICommand, OptionDefinition } from "../../types/command";
import type { Toolbox as IToolbox } from "../../types/toolbox";
import getBooleanValues from "../arg-processing/get-boolean-values";
import removeBooleanValues from "../arg-processing/remove-boolean-values";
import mergeArguments from "../data-processing/merge-arguments";

/**
 * Prepares the toolbox for command execution
 */
export const prepareToolbox = <OD extends OptionDefinition<unknown>>(
    command: ICommand<OD>,
    parsedArgs: CommandLineOptions,
    booleanValues: Record<string, unknown>,
    extraOptions: Record<string, unknown>,
): IToolbox => {
    // prepare the execute toolbox
    const toolbox = new EmptyToolbox(command.name, command) as unknown as IToolbox;

    // eslint-disable-next-line no-underscore-dangle
    const commandArgs = { ...parsedArgs, _all: { ...parsedArgs._all, ...booleanValues } } as typeof parsedArgs;

    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { _all, positionals } = commandArgs;

    if (_all[POSITIONALS_KEY]) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete _all[POSITIONALS_KEY];
    }

    toolbox.argument = positionals?.[POSITIONALS_KEY] ?? [];
    toolbox.options = { ..._all, ...extraOptions };

    return toolbox;
};

/**
 * Processes command arguments and options
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
 * Executes a command and returns its result
 */
export const executeCommand = async <OD extends OptionDefinition<unknown>>(
    command: ICommand<OD>,
    toolbox: IToolbox,
    commandArgs: CommandLineOptions,
): Promise<unknown> => await command.execute(toolbox);
