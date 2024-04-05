import type { BuildContext } from "../types";

const warn = (context: BuildContext, message: string): void => {
    if (context.warnings.has(message)) {
        return;
    }

    context.warnings.add(message);
};

export default warn;
