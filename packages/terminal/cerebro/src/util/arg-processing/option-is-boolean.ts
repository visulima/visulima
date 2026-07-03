// packages/cerebro/src/util/arg-processing/option-is-boolean.ts
import type { OptionDefinition, PossibleOptionDefinition } from "../../types/command";

/**
 * Determines whether an option definition is typed as Boolean.
 * @template OD
 * @param option Option definition to inspect.
 * @returns True when the option's type constructor is the built-in `Boolean`.
 */
const optionIsBoolean = <OD extends OptionDefinition<unknown>>(option: PossibleOptionDefinition<OD>): boolean => option.type?.name === "Boolean";

export default optionIsBoolean;
