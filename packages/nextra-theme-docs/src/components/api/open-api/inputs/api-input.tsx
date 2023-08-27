import cn from "clsx";
import type { FC } from "react";
import { useState } from "react";

import { useRouter } from "next/router";
import type { ApiInputValue, Parameter } from "../types";
import AddArrayItemButton from "./add-array-item-button";
import InputDropdown from "./input-dropdown";
import TrashIcon from "../../../../icons/trash";
import DocumentArrowUpIcon from "../../../../icons/document-arrow-up";
import { useConfig } from "../../../../config";
import { renderString } from "../../../../utils/render";
import { DEFAULT_LOCALE } from "../../../../constants/base";
import ArrowsPointingOutIcon from "../../../../icons/arrows-pointing-out";
import ArrowsPointingInIcon from "../../../../icons/arrows-pointing-in";

const getArrayType = (type: string | undefined) => {
    if (!type || type === "array") {
        return "";
    }
    return type.replaceAll("[]", "");
};

const b64 = async (file: File): Promise<ArrayBuffer | string | null> =>
    // eslint-disable-next-line compat/compat
    await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.addEventListener("load", () => {
            resolve(reader.result);
        });
        // eslint-disable-next-line unicorn/prefer-add-event-listener
        reader.onerror = (error) => {
            reject(error);
        };
    });

const ApiInput: FC<{
    onChangeParam: (parentInputs: string[], parameterName: string, value: ApiInputValue) => void;
    onDeleteArrayItem?: () => void;
    param: Parameter;
    parentInputs?: string[];
    value: ApiInputValue;
    // eslint-disable-next-line sonarjs/cognitive-complexity
}> = ({ onChangeParam, onDeleteArrayItem = undefined, param, parentInputs = [], value }) => {
    const config = useConfig();
    const { locale } = useRouter();
    const isObject = param.type === "object" && param.properties != null;
    const isArray = param.type === "array";

    const [isExpandedProperties, setIsExpandedProperties] = useState(
        (Boolean(param.required) && isObject) || (isArray && Array.isArray(value) && value.length > 0),
    );

    const [object, setObject] = useState<Record<string, unknown>>(isObject ? (value as unknown as Record<string, unknown>) : {});
    const [array, setArray] = useState<{ param: Parameter; value: unknown }[]>(
        isArray && Array.isArray(value) ? (value as unknown as { param: Parameter; value: unknown }[]) : [],
    );

    let InputField;

    // TO DO: Support multiple types
    let lowerCaseParameterType;
    if (typeof param.type === "string") {
        lowerCaseParameterType = param.type.toLowerCase();
    }

    const onInputChange = (apiValue: ApiInputValue) => {
        onChangeParam(parentInputs, param.name, apiValue);
    };

    const onObjectParentChange = (property: string, oValue: unknown) => {
        const newObject = { ...object, [property]: oValue };

        setObject(newObject);
        onInputChange(newObject);
    };

    const onArrayParentChange = (arrayIndex: number, aValue: unknown) => {
        const newArray = array.map((item, index) => {
            if (arrayIndex === index) {
                return { ...item, aValue };
            }

            return item;
        });

        setArray(newArray);
        onInputChange(newArray.map((item) => item.value));
    };

    // eslint-disable-next-line @arthurgeron/react-usememo/require-usememo
    const onAddArrayItem = () => {
        const newArray = [
            ...array,
            {
                param: {
                    ...param,
                    type: param.properties ? "object" : getArrayType(param.type),
                },
                value: param.properties ? {} : null,
            },
        ];

        setArray(newArray);
        onInputChange(newArray.map((item) => item.value));
    };

    const onUpdateArray = (newArray: { param: Parameter; value: unknown }[]) => {
        setArray(newArray);

        const inputValue = newArray.length > 0 ? newArray : undefined;

        onInputChange(inputValue?.map((item: unknown) => item.value));
    };

    switch (lowerCaseParameterType) {
        case "boolean": {
            InputField = (
                <InputDropdown
                    config={config}
                    locale={locale ?? DEFAULT_LOCALE}
                    /* eslint-disable-next-line @arthurgeron/react-usememo/require-usememo */
                    onInputChange={(newValue: string) => onInputChange(newValue === "true")}
                    /* eslint-disable-next-line @arthurgeron/react-usememo/require-usememo */
                    options={["true", "false"]}
                    value={value == null ? "" : (value as boolean).toString()}
                />
            );

            break;
        }
        case "integer":
        case "number": {
            InputField = (
                <input
                    className="w-full rounded border border-slate-200 bg-white px-2 py-0.5 text-slate-700 dark:border-slate-700 dark:bg-white/5 dark:text-slate-200"
                    onChange={(event) => onInputChange(Number.parseFloat(event.target.value))}
                    placeholder={param.placeholder}
                    type="number"
                    value={value as never}
                />
            );

            break;
        }
        case "file":
        case "files": {
            InputField = (
                <button
                    className="relative flex h-7 w-full items-center rounded border border-dashed border-slate-200 bg-white px-2 text-slate-700 hover:border-slate-400 hover:bg-slate-50 dark:border-slate-600 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-slate-800"
                    type="button"
                >
                    <input
                        onChange={async (event) => {
                            if (event.target.files == null) {
                                return;
                            }

                            onInputChange(await b64(event.target.files[0] as File));
                        }}
                        className="absolute inset-0 z-10 cursor-pointer opacity-0"
                        type="file"
                    />
                    <span className="pointer-events-none inline-block w-full truncate text-left">
                        {value != null && typeof value === "string" && value.length > 0
                            ? (value as string)
                            : // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
                              (value as { name: string }).name ?? renderString(config.api.file.content, { locale: locale ?? DEFAULT_LOCALE })}
                    </span>
                    <DocumentArrowUpIcon className="h-4 w-4 text-slate-700 dark:text-slate-200" />
                </button>
            );

            break;
        }
        default: {
            if (isObject && !isArray) {
                InputField = (
                    <button
                        className="relative flex h-6 w-full items-center justify-end "
                        onClick={() => setIsExpandedProperties(!isExpandedProperties)}
                        type="button"
                    >
                        <span className="fill-slate-500 group-hover:fill-slate-700 dark:fill-slate-400 dark:group-hover:fill-slate-200">
                            {isExpandedProperties ? <ArrowsPointingInIcon className="h-5 w-5" /> : <ArrowsPointingOutIcon className="h-5 w-5" />}
                        </span>
                    </button>
                );
            } else if (isArray) {
                InputField = array.length === 0 && <AddArrayItemButton onClick={onAddArrayItem} />;
            } else if (param.enum) {
                InputField = (
                    <InputDropdown
                        config={config}
                        locale={locale ?? DEFAULT_LOCALE}
                        onInputChange={onInputChange}
                        options={param.enum}
                        value={value as string}
                    />
                );
            } else {
                InputField = (
                    <input
                        className="w-full rounded border border-slate-200 bg-white px-2 py-0.5 text-slate-700 dark:border-slate-600 dark:bg-white/5 dark:text-slate-200"
                        onChange={(event) => onInputChange(event.target.value)}
                        placeholder={param.placeholder}
                        type="text"
                        value={value as string}
                    />
                );
            }
        }
    }

    return (
        <div
            className={cn(
                "text-[0.84rem] transition-all reduce-motion:transition-none duration-300 ease-linear",
                ((isObject && isExpandedProperties) || array.length > 0) &&
                    "rounded-md border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-white/5",
            )}
        >
            <div className="group flex items-center space-x-2">
                {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
                <div
                    className={cn(
                        "flex flex-1 items-center text-slate-600 dark:text-slate-300 w-2/4",
                        isObject && "cursor-pointer",
                        onDeleteArrayItem && "invisible", // Array items don't have parameter names
                    )}
                    onClick={() => isObject && setIsExpandedProperties(!isExpandedProperties)}
                >
                    <span className="truncate font-semibold">{param.name}</span>
                    <span className="ml-1 hidden md:!block">{lowerCaseParameterType}</span>
                    {param.required && (
                        <span className="ml-1 lowercase text-red-600 dark:text-red-400">
                            {renderString(config.api.param.required.content, { locale: locale ?? DEFAULT_LOCALE })}
                        </span>
                    )}
                </div>
                <div className={cn("flex-initial", onDeleteArrayItem ? "w-[calc(40%-1.05rem)] sm:w-[calc(33%-1.05rem)]" : "w-2/5 sm:w-1/3")}>{InputField}</div>
                {onDeleteArrayItem && (
                    <button
                        className="fill-red-600 py-1 hover:fill-red-800 dark:fill-red-400 dark:hover:fill-red-200"
                        onClick={onDeleteArrayItem}
                        title={renderString(config.api.array.delete.content, { locale: locale ?? DEFAULT_LOCALE })}
                        type="button"
                    >
                        <TrashIcon className="block h-4 w-4 text-red-500" />
                    </button>
                )}
            </div>
            {/* Properties extension */}
            {isExpandedProperties && param.properties && (
                <div className="mt-1 space-y-2 border-t border-slate-100 pb-1 pt-2 dark:border-slate-700">
                    {param.properties.map((property) => (
                        <ApiInput
                            onChangeParam={(parentInputs: string[], parameterName: string, parameterValue: ApiInputValue) =>
                                onObjectParentChange(property.name, parameterValue)
                            }
                            key={property.name}
                            param={property}
                            parentInputs={[...parentInputs, param.name]}
                            value={((value as any) || {})[property.name]}
                        />
                    ))}
                </div>
            )}
            {/* Array extension */}
            {array.length > 0 && (
                <div className={cn("mt-1 space-y-2 pb-1 pt-2", !isObject && "border-t border-slate-100 dark:border-slate-700")}>
                    {array.map((item, index) => (
                        <ApiInput
                            onChangeParam={(_parentInputs: string[], _parameterName: string, parameterValue: ApiInputValue) =>
                                onArrayParentChange(index, parameterValue)
                            }
                            key={`${item.param.name}${index}`}
                            onDeleteArrayItem={() => onUpdateArray(array.filter((_, index_) => index !== index_))}
                            param={item.param}
                            value={item.value}
                        />
                    ))}
                    <div className="group flex items-center justify-end space-x-2">
                        <div className="w-2/5 flex-initial sm:w-1/3">
                            <AddArrayItemButton onClick={onAddArrayItem} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
export default ApiInput;
