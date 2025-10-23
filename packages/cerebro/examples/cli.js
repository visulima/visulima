import { Cerebro } from "../dist/index.js";

import optionsDefault from "./commands/options-defaults.js";
import optionsConflicts from "./commands/options-conflicts.js";
import optionsCommon from "./commands/options-common.js";
import optionsNegatable from "./commands/options-negatable.js";
import optionsImplies from "./commands/options-implies.js";
import optionsRequired from "./commands/options-required.js";
import optionsBooleanOrValue from "./commands/options-boolean-or-value.js";

const cli = new Cerebro("cerebro");

optionsCommon(cli);
optionsConflicts(cli);
optionsDefault(cli);
optionsNegatable(cli);
optionsImplies(cli);
optionsRequired(cli);
optionsBooleanOrValue(cli);

await cli.run();
