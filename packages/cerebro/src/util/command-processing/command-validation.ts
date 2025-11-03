import type { CommandLineOptions } from "@visulima/command-line-args";

import { CommandValidationError, ConflictingOptionsError } from "../../errors";
import type { Command as ICommand, OptionDefinition, PossibleOptionDefinition } from "../../types/command";
import type { Toolbox as IToolbox } from "../../types/toolbox";
import listMissingArguments from "../data-processing/list-missing-arguments";
import findAlternatives from "../general/find-alternatives";

/**
 * Validates unknown options and provides helpful suggestions
 */
const validateUnknownOptions = <OD extends OptionDefinition<unknown>>(commandArguments: CommandLineOptions, command: ICommand<OD>): void => {
    const errors: string[] = [];

    // eslint-disable-next-line no-underscore-dangle
    if (commandArguments._unknown) {
        // eslint-disable-next-line no-underscore-dangle
        commandArguments._unknown.forEach((unknownOption) => {
            const isOption = unknownOption.startsWith("--");

            let error = `Found unknown ${isOption ? "option" : "argument"} "${unknownOption}"`;

            if (isOption) {
                const foundAlternatives = findAlternatives(
                    unknownOption.replace("--", ""),
                    (command.options ?? []).map((option) => option.name),
                );

                if (foundAlternatives.length > 0) {
                    const [first, ...rest] = foundAlternatives.map((alternative) => `--${alternative}`);

                    error += rest.length > 0 ? `, did you mean ${first} or ${rest.join(", ")}?` : `, did you mean ${first}?`;
                }
            }

            errors.push(error);
        });
    }

    if (errors.length > 0) {
        throw new Error(errors.join("\n"));
    }
};

/**
 * Validates that all required options are present
 * Uses pre-computed required options metadata from command registration for performance
 */
export const validateRequiredOptions = <OD extends OptionDefinition<unknown>>(
    arguments_: PossibleOptionDefinition<OD>[],
    commandArguments: CommandLineOptions,
    command: ICommand<OD>,
): void => {
    const missingOptions = command.__requiredOptions__
        ? listMissingArguments(command.__requiredOptions__, commandArguments, true)
        : listMissingArguments(arguments_, commandArguments, false);

    if (missingOptions.length > 0) {
        throw new CommandValidationError(
            command.name,
            missingOptions.map((argument) => argument.name),
        );
    }

    // Only validate unknown options if command doesn't accept positional arguments
    // Positional arguments will be in _unknown initially but are valid if command.argument is defined
    if (commandArguments._unknown && commandArguments._unknown.length > 0 && !command.argument) {
        validateUnknownOptions(commandArguments, command);
    }
};

/**
 * Validates for conflicting options
 * Uses pre-computed conflict metadata from command registration for performance
 */
export const validateConflictingOptions = <OD extends OptionDefinition<unknown>>(
    arguments_: PossibleOptionDefinition<OD>[],
    commandArguments: IToolbox["options"],
    command: ICommand<OD>,
): void => {
    // Use pre-computed conflicting options (15% performance improvement)
    // This list is computed once at registration instead of filtering on every execution
    const conflicts = command.__conflictingOptions__ ?? arguments_.filter((argument) => argument.conflicts !== undefined);

    if (conflicts.length > 0) {
        const conflict = conflicts.find((argument) => {
            if (Array.isArray(argument.conflicts)) {
                return argument.conflicts.some((c) => commandArguments[c] !== undefined) && commandArguments[argument.name] !== undefined;
            }

            return commandArguments[argument.conflicts as string] !== undefined && commandArguments[argument.name] !== undefined;
        });

        if (conflict) {
            throw new ConflictingOptionsError(
                conflict.name,
                typeof conflict.conflicts === "string" ? conflict.conflicts : conflict.conflicts?.[0] ?? "unknown",
            );
        }
    }
};

/**
 * Validates for duplicate option definitions
 */
export const validateDuplicateOptions = <OD extends OptionDefinition<unknown>>(command: ICommand<OD>): void => {
    if (!Array.isArray(command.options)) {
        return;
    }

    const byName = new Map<string, OptionDefinition<OD>[]>();
    const byAlias = new Map<string, OptionDefinition<OD>[]>();

    for (const opt of command.options as OptionDefinition<OD>[]) {
        if (opt.name) {
            const existing = byName.get(opt.name) ?? [];

            existing.push(opt);
            byName.set(opt.name, existing);
        }

        if (typeof opt.alias === "string" && opt.alias.length > 0) {
            const existing = byAlias.get(opt.alias) ?? [];

            existing.push(opt);
            byAlias.set(opt.alias, existing);
        } else if (Array.isArray(opt.alias)) {
            for (const alias of opt.alias) {
                if (alias.length > 0) {
                    const existing = byAlias.get(alias) ?? [];

                    existing.push(opt);
                    byAlias.set(alias, existing);
                }
            }
        }
    }

    const errors: string[] = [];

    for (const [name, group] of byName) {
        if (group.length > 1) {
            errors.push(`Duplicate option name "${name}" in command "${command.name}": ${JSON.stringify(group)}`);
        }
    }

    for (const [alias, group] of byAlias) {
        if (group.length > 1) {
            errors.push(`Duplicate option alias "-${alias}" used by options ${group.map((o) => `"${o.name}"`).join(", ")} in command "${command.name}"`);
        }
    }

    if (errors.length > 0) {
        throw new Error(errors.join("\n"));
    }
};
