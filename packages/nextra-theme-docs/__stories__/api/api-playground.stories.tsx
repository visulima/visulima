import type { ComponentMeta, ComponentStory } from "@storybook/react";
import React, { useState } from "react";

import { ApiPlayground, RequestPathHeader } from "../../Api";

export default {
    component: ApiPlayground,
    title: "Api/ApiPlayground",
} as ComponentMeta<typeof ApiPlayground>;

const Template: ComponentStory<typeof ApiPlayground> = (arguments_) => {
    const [parameterValues, setParameterValues] = useState<Record<string, Record<string, unknown>>>(arguments_.paramValues);

    arguments_.paramValues = parameterValues;
    arguments_.onChangeParamValues = setParameterValues;
    return <ApiPlayground {...arguments_} />;
};

const testParameterGroups = [
    {
        name: "Body",
        params: [
            {
                name: "Text Input",
                placeholder: "Placeholder Value",
                type: "text",
            },
            {
                name: "File Input",
                type: "file",
            },
            {
                name: "Array Input",
                type: "array",
            },
            {
                name: "Object Input",
                properties: [
                    { name: "Example Property Name", type: "number" },
                    { name: "camelCasePropertyName", type: "string" },
                ],
                type: "object",
            },
        ],
    },
    {
        name: "Path",
        params: [
            {
                name: "Text Input Second Page",
                required: true,
                type: "text",
            },
        ],
    },
];

const testParameterValues = {
    Body: {
        "Array Input": [
            { param: { name: "This text should be hidden", type: "text" }, value: 1 },
            { param: { name: "This text should be hidden", type: "text" }, value: 2 },
        ],
        "Object Input": {
            "Example Property Name": 123,
            camelCasePropertyName: "Example string value",
        },
        "Text Input": "",
    },
    Path: {
        "Text Input Second Page": "",
    },
};

export const HeaderButNoResponse = Template.bind({});
HeaderButNoResponse.args = {
    header: (
        <RequestPathHeader
            onBaseUrlChange={(baseUrl) => {
                console.log(baseUrl);
            }}
            baseUrls={["Base URL 1", "Base URL 2"]}
            method="GET"
            path="/api/example/path"
        />
    ),
    isSendingRequest: false,
    method: "GET",
    paramGroups: testParameterGroups,
    paramValues: testParameterValues,
};

export const NoHeader = Template.bind({});
NoHeader.args = {
    isSendingRequest: false,
    method: "PATCH",
    paramGroups: testParameterGroups,
    paramValues: testParameterValues,
};
