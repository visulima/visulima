import { FC } from "react";

import Code from "./code";
import Pre from "./pre";
import { Tab, Tabs } from "./tabs";

const Installation: FC<{ packageName: string; tabs: string[], title?: string }> = ({ packageName, tabs = ["npm", "pnpm", "yarn"], title = "Installation" }) => (
    <>
        <h2>{title}</h2>
        <Tabs items={tabs}>
            <Tab>
                <Pre>
                    <Code data-language="bash">npm i {packageName}</Code>
                </Pre>
            </Tab>
            <Tab>
                <Pre>
                    <Code data-language="bash">pnpm add {packageName}</Code>
                </Pre>
            </Tab>
            <Tab>
                <Pre>
                    <Code data-language="bash">yarn add {packageName}</Code>
                </Pre>
            </Tab>
        </Tabs>
    </>
);

export default Installation;
