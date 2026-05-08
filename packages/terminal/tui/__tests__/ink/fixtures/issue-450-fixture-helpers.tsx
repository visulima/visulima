import process from "node:process";

import React, { useEffect, useState } from "react";

import { Box, Static, Text } from "../../../src/components/index";
import { useApp } from "../../../src/ink/hooks/use-app";
import { render } from "../../../src/ink/index";

type RerenderFixtureOptions = {
    readonly completionMarker?: string;
    readonly frameLimit?: number;
    readonly heightForFrame: (rows: number, frameCount: number) => number;
    readonly includeStaticLine?: boolean;
    readonly incrementalRendering?: boolean;
    readonly rowsFallback?: number;
};

const Issue450RerenderFixtureComponent = ({
    completionMarker,
    frameLimit,
    heightForFrame,
    includeStaticLine,
    rows,
}: {
    readonly completionMarker?: string;
    readonly frameLimit: number;
    readonly heightForFrame: (rows: number, frameCount: number) => number;
    readonly includeStaticLine: boolean;
    readonly rows: number;
}) => {
    const { exit } = useApp();
    const [frameCount, setFrameCount] = useState(0);
    const targetHeight = heightForFrame(rows, frameCount);

    useEffect(() => {
        if (frameCount >= frameLimit) {
            const timer = setTimeout(() => {
                if (completionMarker) {
                    process.stdout.write(completionMarker);
                }

                exit();
            }, 0);

            return () => {
                clearTimeout(timer);
            };
        }

        const timer = setTimeout(() => {
            setFrameCount((previousFrameCount) => previousFrameCount + 1);
        }, 100);

        return () => {
            clearTimeout(timer);
        };
    }, [completionMarker, exit, frameCount, frameLimit]);

    return (
        <>
            {includeStaticLine ? <Static items={["#450 static line"]}>{(item) => <Text key={item}>{item}</Text>}</Static> : null}
            <Box flexDirection="column" height={targetHeight}>
                <Text>#450 top</Text>
                <Box flexGrow={1}>
                    <Text>{`frame ${frameCount}`}</Text>
                </Box>
                <Text>#450 bottom</Text>
            </Box>
        </>
    );
};

export const runIssue450RerenderFixture = ({
    completionMarker,
    frameLimit = 8,
    heightForFrame,
    includeStaticLine = false,
    incrementalRendering = false,
    rowsFallback = 6,
}: RerenderFixtureOptions): void => {
    const rows = Number(process.argv[2]) || rowsFallback;

    process.stdout.rows = rows;

    render(
        <Issue450RerenderFixtureComponent
            completionMarker={completionMarker}
            frameLimit={frameLimit}
            heightForFrame={heightForFrame}
            includeStaticLine={includeStaticLine}
            rows={rows}
        />,
        { incrementalRendering },
    );
};

type InitialFixtureOptions = {
    readonly lineCount: number;
    readonly linePrefix: string;
    readonly renderedMarker: string;
    readonly rowsFallback?: number;
};

const Issue450InitialFixtureComponent = ({
    lineCount,
    linePrefix,
    renderedMarker,
}: {
    readonly lineCount: number;
    readonly linePrefix: string;
    readonly renderedMarker: string;
}) => {
    const { exit } = useApp();

    useEffect(() => {
        const timer = setTimeout(() => {
            process.stdout.write(renderedMarker);
            exit();
        }, 0);

        return () => {
            clearTimeout(timer);
        };
    }, [exit, renderedMarker]);

    const lines = [];

    for (let lineNumber = 1; lineNumber <= lineCount; lineNumber++) {
        lines.push(<Text key={lineNumber}>{`${linePrefix} line ${lineNumber}`}</Text>);
    }

    return <Box flexDirection="column">{lines}</Box>;
};

export const runIssue450InitialFixture = ({ lineCount, linePrefix, renderedMarker, rowsFallback = 3 }: InitialFixtureOptions): void => {
    const rows = Number(process.argv[2]) || rowsFallback;

    process.stdout.rows = rows;

    render(<Issue450InitialFixtureComponent lineCount={lineCount} linePrefix={linePrefix} renderedMarker={renderedMarker} />);
};
