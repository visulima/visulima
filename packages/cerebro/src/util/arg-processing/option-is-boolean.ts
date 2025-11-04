import type { OptionDefinition, PossibleOptionDefinition } from "../../types/command";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const optionIsBoolean = <OD extends OptionDefinition<any>>(option: PossibleOptionDefinition<OD>): boolean => option.type?.name === "Boolean";

export default optionIsBoolean;
