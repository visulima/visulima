import { clsx } from "clsx";
// eslint-disable-next-line no-restricted-imports
import set from "lodash.set";
import type { FC, ReactNode } from "react";
import { useState } from "react";

import { getMethodBgColor, getMethodBgHoverColor, getMethodBorderColor, getMethodTextColor } from "../../../utils/api-playground-colors";
import ApiInput from "./inputs/api-input";
import type { ApiInputValue, ParameterGroup, RequestMethods } from "./types";
import Button from "../../button";

const ApiPlayground: FC<{
    /** Header to show above parameter inputs. */
    header?: ReactNode;

    /** Whether you are currently sending a request.
     *  The Send Request button is disabled and the response is hidden while this is true. */
    isSendingRequest: boolean;

    /** Request method. */
    method: RequestMethods;

    /** Callback when the user changes a parameter's value. */
    onChangeParamValues: (parameterValues: Record<string, Record<string, ApiInputValue>>) => void;

    /** Callback when the user clicks the Send Request button. */
    onSendRequest: () => void;

    /** Array of param groups to show as tabs for input. */
    paramGroups: ParameterGroup[];

    /** Values to show in the ApiInputs. Key is the param group name. */
    paramValues: Record<string, Record<string, ApiInputValue>>;

    /** Response to show underneath the playground.
     *  This component does not automatically syntax highlight code. */
    response?: ReactNode;
}> = ({ header = undefined, isSendingRequest, method, onChangeParamValues, onSendRequest, paramGroups, paramValues, response = undefined }) => {
    const [currentActiveParameterGroup, setCurrentActiveParameterGroup] = useState<ParameterGroup | undefined>(paramGroups[0]);

    const setParameterInObject = (parameterGroupName: string, parentInputs: string[], parameterName: string, value: ApiInputValue) => {
        const newParameterGroup = {
            // eslint-disable-next-line security/detect-object-injection
            ...paramValues[parameterGroupName],
            // eslint-disable-next-line security/detect-object-injection
            ...set(paramValues[parameterGroupName] ?? {}, [...parentInputs, parameterName], value),
        };
        onChangeParamValues({ ...paramValues, [parameterGroupName]: newParameterGroup });
    };

    return (
        <div className="mt-4 truncate rounded-md border border-slate-200 bg-slate-50 dark:border-slate-600 dark:bg-gray-800/40">
            <div className="px-3.5 pb-4 pt-3.5">
                {header}
                <div className="text-sm">
                    <div className="block">
                        <div className="border-b border-slate-200 dark:border-slate-600">
                            <nav aria-label="Tabs" className="-mb-px flex space-x-4">
                                {paramGroups.map((parameterGroup: ParameterGroup) => (
                                    <button
                                        className={clsx(
                                            currentActiveParameterGroup?.name === parameterGroup.name
                                                ? `${getMethodTextColor(method)} ${getMethodBorderColor(method)}`
                                                : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200",
                                            "whitespace-nowrap border-b-2 py-2 text-[0.84rem] font-medium",
                                        )}
                                        key={parameterGroup.name}
                                        onClick={() => setCurrentActiveParameterGroup(parameterGroup)}
                                        type="button"
                                    >
                                        {parameterGroup.name}
                                    </button>
                                ))}
                            </nav>
                        </div>
                    </div>
                    <div className="mt-4 space-y-2">
                        {currentActiveParameterGroup?.params.map((parameter, index) => (
                            <ApiInput
                                /* eslint-disable-next-line @arthurgeron/react-usememo/require-usememo */
                                onChangeParam={(parentInputs: string[], parameterName: string, parameterValue: ApiInputValue) =>
                                    setParameterInObject(currentActiveParameterGroup.name, parentInputs, parameterName, parameterValue)
                                }
                                /* eslint-disable-next-line react/no-array-index-key */
                                key={`${parameter.name}${index}`}
                                param={parameter}
                                value={paramValues[currentActiveParameterGroup.name]?.[parameter.name] ?? ""}
                            />
                        ))}
                    </div>
                    <Button
                        className={clsx(
                            "flex items-center space-x-2 rounded px-3 py-1.5 font-medium text-white",
                            getMethodBgColor(method),
                            getMethodBgHoverColor(method),
                            currentActiveParameterGroup && "mt-4",
                        )}
                        disabled={isSendingRequest}
                        onClick={onSendRequest}
                    >
                        <svg className="h-3 fill-white" viewBox="0 0 384 512" xmlns="http://www.w3.org/2000/svg">
                            <path d="M361 215C375.3 223.8 384 239.3 384 256C384 272.7 375.3 288.2 361 296.1L73.03 472.1C58.21 482 39.66 482.4 24.52 473.9C9.377 465.4 0 449.4 0 432V80C0 62.64 9.377 46.63 24.52 38.13C39.66 29.64 58.21 29.99 73.03 39.04L361 215z" />
                        </svg>
                        <div>{isSendingRequest ? "Sending..." : "Send Request"}</div>
                    </Button>
                </div>
            </div>
            {isSendingRequest ? null : response}
        </div>
    );
};

export default ApiPlayground;
