import { useState } from "react";
import ApiPlayground from "./api-playground";
import Snippet from "./snippet";
import RequestPathHeader from "./request-path-header";
import type { ApiInputValue } from "./types";

const OpenApiView = ({ method, paramGroups }) => {
    const [parameterValues, setParameterValues] = useState<Record<string, Record<string, ApiInputValue>>>({});

    return (
        <div className="flex flex-col xl:flex-row xl:gap-5">
            <div className="w-full xl:basis-7/12">
                <ApiPlayground
                    header={
                        <RequestPathHeader
                            onBaseUrlChange={(baseUrl) => {
                                console.log(baseUrl);
                            }}
                            baseUrls={["Base URL 1", "Base URL 2"]}
                            method={method}
                            path="/api/example/path"
                        />
                    }
                    paramGroups={paramGroups}
                    isSendingRequest={false}
                    method={method}
                    onChangeParamValues={setParameterValues}
                    onSendRequest={() => {}}
                    paramValues={parameterValues}
                />
            </div>
            <div className="mt-4 grow">
                <Snippet />
            </div>
        </div>
    );
};

export default OpenApiView;
