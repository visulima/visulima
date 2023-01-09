import { FC } from "react";

import Code from "./code";
import Pre from "./pre";
import { Tab, Tabs } from "./tabs";

const Installation: FC<{ packageName: string; commands: string[]; title?: string }> = ({
    packageName,
    commands = ["npm i", "pnpm add", "yarn add"],
    title = "Installation",
}) => (
    <>
        <h2>{title}</h2>
        <Tabs items={commands}>
            {commands.map((command) => (
                <Tab>
                    <div data-rehype-pretty-code-fragment="">
                        <Pre data-language="bash" data-theme="default">
                            <Code data-language="bash" data-theme="default">
                                {command} {packageName}
                            </Code>
                        </Pre>
                    </div>
                </Tab>
            ))}
        </Tabs>
    </>
);

export default Installation;
