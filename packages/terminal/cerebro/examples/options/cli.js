import { Cerebro } from "@visulima/cerebro";
import { errorHandlerPlugin } from "@visulima/cerebro/plugins/error-handler";

import optionsBooleanOrValue from "./options-boolean-or-value.js";
import optionsCommon from "./options-common.js";
import optionsConflicts from "./options-conflicts.js";
import optionsDefault from "./options-defaults.js";
import optionsImplies from "./options-implies.js";
import optionsNegatable from "./options-negatable.js";
import optionsRequired from "./options-required.js";

const cli = new Cerebro("cerebro");

cli.addPlugin(
    errorHandlerPlugin({
        detailed: true,
    }),
);

// Options commands
optionsCommon(cli);
optionsConflicts(cli);
optionsDefault(cli);
optionsNegatable(cli);
optionsImplies(cli);
optionsRequired(cli);
optionsBooleanOrValue(cli);

await cli.run();
