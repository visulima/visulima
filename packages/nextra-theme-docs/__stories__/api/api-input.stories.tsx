import type { ComponentMeta, ComponentStory } from "@storybook/react";
import React, { useState } from "react";

import { ApiInput } from "../../Api/inputs/ApiInput";
import type { ApiInputValue } from "../../Api/types";

export default {
    component: ApiInput,
    title: "Api/ApiInput",
} as ComponentMeta<typeof ApiInput>;

const Template: ComponentStory<typeof ApiInput> = (arguments_) => {
    const [value, setValue] = useState<any>(arguments_.value);
    return (
        <div className="max-w-md">
            <ApiInput
                onChangeParam={(parentInputs: string[], parameterName: string, value: ApiInputValue) => {
                    setValue(value);
                }}
                // shows a garbage can when the delete function exists.
                onDeleteArrayItem={undefined}
                param={arguments_.param}
                // Storybook automatically adds a blank function if we don't do this, and our code
                value={value}
            />
        </div>
    );
};

export const TextInputWithPlaceholder = Template.bind({});
TextInputWithPlaceholder.args = {
    param: {
        name: "Text Input",
        placeholder: "Placeholder Value",
        type: "text",
    },
    value: "",
};

export const BooleanInput = Template.bind({});
BooleanInput.args = {
    param: {
        name: "Boolean Input",
        type: "boolean",
    },
    value: true,
};

export const EnumInput = Template.bind({});
EnumInput.args = {
    param: {
        enum: ["Enum Option 1", "Enum Option 2", "Enum Option 3"],
        name: "Enum Input",
        type: "enum",
    },
    value: "Enum Option 2",
};

export const ArrayInput = Template.bind({});
ArrayInput.args = {
    param: {
        name: "Array Input",
        type: "array",
    },
    value: [
        { param: { name: "This text should be hidden", type: "text" }, value: 1 },
        { param: { name: "This text should be hidden", type: "text" }, value: 2 },
    ],
};

export const ObjectInput = Template.bind({});
ObjectInput.args = {
    param: {
        name: "Object Input",
        properties: [{ name: "Example Property Name" }, { name: "camelCasePropertyName" }],
        required: true,
        type: "object",
    },
    value: {
        "Example Property Name": 123,
        camelCasePropertyName: "Example string value",
    },
};

export const FileInput = Template.bind({});
FileInput.args = {
    param: {
        name: "File Input",
        type: "file",
    },
    value: "",
};

export const ArrayOfObjectsInput = Template.bind({});
ArrayOfObjectsInput.args = {
    param: {
        name: "home_feed_contents",
        properties: [
            {
                name: "id",
                type: "string",
            },
            {
                name: "price",
                properties: [
                    {
                        name: "money",
                        properties: [
                            {
                                name: "currency_code",
                                type: "string",
                            },
                            {
                                name: "units",
                                type: "string",
                            },
                        ],

                        type: "object",
                    },
                    {
                        enum: ["PREFIX_UNSPECIFIED", "PREFIX_PER_UNIT", "PREFIX_PER_SESSION", "PREFIX_PER_PERSON", "PREFIX_FREE"],
                        name: "prefix",
                        placeholder: "PREFIX_UNSPECIFIED",
                        type: "string",
                    },
                ],
                type: "object",
            },
        ],
        required: true,
        type: "array",
    },
    value: [],
};
