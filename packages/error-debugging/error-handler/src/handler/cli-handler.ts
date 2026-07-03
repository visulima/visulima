import type { BaseCliOptions } from "../../../../../shared/utils/cli-error-builder";
import { buildOutput } from "../../../../../shared/utils/cli-error-builder";

export type { BaseCliOptions, CliHandlerOptions } from "../../../../../shared/utils/cli-error-builder";

export const ansiHandler = async (error: Error, options: BaseCliOptions = {}): Promise<string> => {
    const { errorAnsi, solutionBox } = await buildOutput(error, options);

    if (solutionBox === undefined) {
        return errorAnsi;
    }

    return `${errorAnsi}\n\n${solutionBox}`;
};

export { terminalOutput as cliHandler } from "../../../../../shared/utils/cli-error-builder";
