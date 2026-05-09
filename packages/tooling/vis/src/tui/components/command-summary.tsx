import type { Task } from "@visulima/task-runner";
import { Box } from "@visulima/tui/components/box";
import { StaticRender } from "@visulima/tui/components/static-render";
import { Text } from "@visulima/tui/components/text";

import { formatTargetsAndProjects } from "../formatting-utils";
import { CROSS, TICK } from "../symbols";
import Header from "./header";

interface CommandSummaryProps {
    cached: number;
    failed: number;
    failedIds: string[];
    projectNames: string[];
    skippedIds?: string[];
    succeeded: number;
    targets: string[];
    tasks: Task[];
    took: string;
}

/**
 * Final summary block rendered after all tasks complete.
 */
const CommandSummary = ({ cached, failed, failedIds, projectNames, skippedIds, succeeded, targets, tasks, took }: CommandSummaryProps): React.JSX.Element => {
    const description = formatTargetsAndProjects(projectNames, targets, tasks);

    if (failed === 0 && (!skippedIds || skippedIds.length === 0)) {
        const cacheNote = cached > 0 ? ` (${cached} read from cache)` : "";

        return (
            <StaticRender>
                {() => (
                    <Header title={`Successfully ran ${description}`} variant="success">
                        <Box marginTop={1} paddingLeft={3}>
                            <Text>
                                <Text color="green">{TICK}</Text>
                                {"  "}
                                {succeeded + cached}
                                {" tasks completed"}
                                {cacheNote ? <Text dimColor>{cacheNote}</Text> : null}
                                <Text dimColor>{`  ·  Took ${took}`}</Text>
                            </Text>
                        </Box>
                    </Header>
                )}
            </StaticRender>
        );
    }

    return (
        <StaticRender>
            {() => (
                <Header title={`Ran ${description}`} variant="error">
                    <Box flexDirection="column" marginTop={1} paddingLeft={3}>
                        {skippedIds && skippedIds.length > 0 && (
                            <Box flexDirection="column">
                                <Text dimColor>
                                    {skippedIds.length}
{" "}
task
{skippedIds.length === 1 ? "" : "s"}
{" "}
skipped (dependency failed or --bail)
                                </Text>
                                {skippedIds.map((id) => (
                                    <Text dimColor key={id}>
                                        {"   -  "}
                                        {id}
                                    </Text>
                                ))}
                                <Text />
                            </Box>
                        )}
                        {failed > 0 && (
                            <Box flexDirection="column">
                                <Text>
                                    <Text color="red">{String(failed)}</Text>
{" "}
task
{failed === 1 ? "" : "s"}
{" "}
failed:
                                </Text>
                                {failedIds.map((id) => (
                                    <Text key={id}>
                                        {"   "}
                                        <Text color="red">{CROSS}</Text>
                                        {"  "}
                                        {id}
                                    </Text>
                                ))}
                                <Text />
                            </Box>
                        )}
                        <Text dimColor>
                            {`    Took ${took}`}
                        </Text>
                    </Box>
                </Header>
            )}
        </StaticRender>
    );
};

export default CommandSummary;
