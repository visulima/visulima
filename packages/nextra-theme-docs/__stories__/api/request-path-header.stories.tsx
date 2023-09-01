import type { ComponentMeta, ComponentStory } from "@storybook/react";
import * as React from "react";

import { RequestPathHeader } from "../../Api";

export default {
    component: RequestPathHeader,
    title: "Api/RequestHeader",
} as ComponentMeta<typeof RequestPathHeader>;

const Template: ComponentStory<typeof RequestPathHeader> = (arguments_) => (
    <RequestPathHeader
        baseUrls={arguments_.baseUrls}
        defaultBaseUrl={arguments_.baseUrls[0]}
        method={arguments_.method}
        onBaseUrlChange={(baseUrl) => console.log(baseUrl)}
        path={arguments_.path}
    />
);

export const MultipleBaseUrls = Template.bind({});
MultipleBaseUrls.args = {
    baseUrls: ["Base URL 1", "Base URL 2"],
    method: "GET",
    path: "/api/example/path",
};
