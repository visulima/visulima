import { Cerebro } from "@visulima/cerebro";
import { errorHandlerPlugin } from "@visulima/cerebro/plugins/error-handler";

import optionsBooleanOrValue from "./options-boolean-or-value";
import optionsCommon from "./options-common";
import optionsConflicts from "./options-conflicts";
import optionsDefault from "./options-defaults";
import optionsImplies from "./options-implies";
import optionsNegatable from "./options-negatable";
import optionsRequired from "./options-required";

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
