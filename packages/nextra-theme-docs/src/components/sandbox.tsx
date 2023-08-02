import type { FC } from "react";
import { useTheme } from "next-themes";
import { useConfig } from "../contexts";
import { Tab, Tabs } from "./tabs";

const defaultProviders: Record<string, string> = {
    CodeSandbox: `https://codesandbox.io/embed/github/{repo}/tree/{branch}/{dir}?hidenavigation=1&theme={colorMode}`,
    StackBlitz: `https://stackblitz.com/github/{repo}/tree/{branch}/{dir}?embed=1&file={file}&theme={colorMode}`,
};
const Sandbox: FC<{
    branch?: string;
    dir?: string;
    file: string;
    minHeight?: string;
    repo?: string;
    src?: string;
    // eslint-disable-next-line unicorn/prevent-abbreviations
}> = ({ branch = "main", dir = "", file, minHeight = "700px", repo: repository = "", src: source = undefined }) => {
    const { sandbox } = useConfig();
    const { resolvedTheme } = useTheme();

    const providers: Record<string, string> = { ...defaultProviders, ...sandbox?.providers };

    Object.keys(providers).forEach((key: string) => {
        if (source) {
            // eslint-disable-next-line security/detect-object-injection
            providers[key] = source;
        }

        // eslint-disable-next-line security/detect-object-injection
        providers[key] = (providers[key] as string)
            .replace("{repo}", repository)
            .replace("{branch}", branch)
            .replace("{dir}", dir)
            .replace("{file}", file)
            .replace("{colorMode}", resolvedTheme ?? "light");
    });

    return (
        <Tabs
            /* eslint-disable-next-line @arthurgeron/react-usememo/require-usememo */
            classes={{
                tabs: "relative text-white bg-gray-200 rounded-t-lg dark:bg-gray-700",
            }}
            disableScrollBar
            prefix="sandbox"
            storageKey="sandbox"
        >
            {Object.keys(providers).map((key: string) => (
                <Tab className="not-prose relative" key={key} style={{ minHeight }} title={key}>
                    <span className="absolute inset-x-0 top-20 m-auto block w-40 text-center">Loading Sandbox...</span>
                    <iframe
                        className="not-prose absolute left-0 top-0 z-10 h-full w-full overflow-hidden"
                        sandbox="allow-modals allow-forms allow-popups allow-scripts allow-same-origin"
                        /* eslint-disable-next-line security/detect-object-injection */
                        src={providers[key]}
                        style={{ minHeight, width: "100%" }}
                        title="Sandbox editor"
                    />
                </Tab>
            ))}
        </Tabs>
    );
};

export default Sandbox;
