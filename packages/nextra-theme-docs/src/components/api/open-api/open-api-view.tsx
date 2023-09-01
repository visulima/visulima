import type { FC } from "react";
import { useMemo, useState } from "react";
import type { Operation } from "oas";
import Oas from "oas";
import type { HttpMethods } from "oas/dist/rmoas.types";

import ApiPlayground from "./api-playground";
import Snippet from "./snippet";
import RequestHeader from "./request-header";
import type { ApiInputValue, ParameterGroup, Server } from "./types";
import { useConfig } from "../../../config";

const OpenApiView: FC<{
    method: HttpMethods;
    paramGroups: ParameterGroup[];
    path: string;
}> = ({ method, paramGroups, path, urls }) => {
    const { api } = useConfig();
    // eslint-disable-next-line new-cap
    const apiDefinition = new Oas.default(api.oas);
    const operation: Operation = apiDefinition.operation(path, method);
    console.log(operation, operation.schema.responses);
    const [parameterValues, setParameterValues] = useState<Record<string, Record<string, ApiInputValue>>>({});
    const [server, setServer] = useState<Server | undefined>(apiDefinition?.api?.servers?.[0]);

    const header = useMemo(
        () => <RequestHeader defaultValue={server} method={method} onValueChange={setServer} path={path} servers={apiDefinition?.servers} />,
        [method, path, urls, server],
    );

    return (
        <div className="mt-4 flex w-full flex-col xl:flex-row xl:gap-5">
            <div className="w-full xl:w-7/12">
                <ApiPlayground
                    header={header}
                    isSendingRequest={false}
                    method={method}
                    onChangeParamValues={setParameterValues}
                    onSendRequest={() => {}}
                    paramGroups={paramGroups}
                    paramValues={parameterValues}
                />
            </div>
            <div className="w-full xl:w-5/12">
                <Snippet apiDefinition={apiDefinition} operation={operation} parameterValues={parameterValues} path={path} server={server} />
            </div>
        </div>
    );
};

export default OpenApiView;
