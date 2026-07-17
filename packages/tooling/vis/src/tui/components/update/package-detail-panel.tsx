import { Box } from "@visulima/tui/components/box";
import { Text } from "@visulima/tui/components/text";
import type { ScrollViewRef } from "@visulima/tui-components/scroll-view";
import { ScrollView } from "@visulima/tui-components/scroll-view";

import type { AiRecommendation } from "../../../ai/ai-analysis";
import { scoreColor } from "../../../security/socket-security";
import type { OutdatedEntry } from "../../../util/catalog";

const UPDATE_TYPE_COLORS: Record<string, string> = {
    major: "red",
    minor: "yellow",
    patch: "green",
};

const SEVERITY_COLORS: Record<string, string> = {
    CRITICAL: "red",
    HIGH: "red",
    LOW: "gray",
    MODERATE: "yellow",
    UNKNOWN: "gray",
};

const SOCKET_SEVERITY_COLORS: Record<string, string> = {
    critical: "red",
    high: "red",
    low: "gray",
    medium: "yellow",
};

const RISK_COLORS: Record<string, string> = {
    critical: "red",
    high: "red",
    low: "green",
    medium: "yellow",
};

const ACTION_COLORS: Record<string, string> = {
    defer: "gray",
    review: "yellow",
    skip: "red",
    update: "green",
};

interface PackageDetailPanelProps {
    changelogUrl?: string;
    entry: OutdatedEntry | null;
    focused: boolean;
    recommendation?: AiRecommendation;
    scrollRef?: React.RefObject<ScrollViewRef | null>;
}

const PackageDetailPanel = ({ changelogUrl, entry, focused, recommendation, scrollRef }: PackageDetailPanelProps): React.JSX.Element => {
    const borderColor = focused ? "white" : "gray";

    if (!entry) {
        return (
            <Box alignItems="center" borderColor="gray" borderStyle="single" flexDirection="column" flexGrow={1} justifyContent="center">
                <Text dimColor>No package selected</Text>
            </Box>
        );
    }

    const typeColor = UPDATE_TYPE_COLORS[entry.updateType] ?? "white";
    const hasVulnerabilities = entry.vulnerabilities && entry.vulnerabilities.length > 0;
    const socketScore = entry.socketReport?.score.overall ?? 0;
    const socketScoreColor = entry.socketReport ? scoreColor(socketScore) : ("gray" as const);

    return (
        <Box borderColor={borderColor} borderStyle="single" flexDirection="column" flexGrow={1}>
            {/* Package name title — fixed */}
            <Box flexShrink={0} paddingTop={1} paddingX={2}>
                <Text bold color="white">
                    {entry.displayName ?? entry.packageName}
                </Text>
            </Box>

            <ScrollView flexGrow={1} flexShrink={1} paddingX={2} ref={scrollRef} scrollbar scrollbarColor="gray" scrollbarStyle="block">
                {/* Version info */}
                <Text />

                {/* Version info */}
                <Box>
                    <Box width={12}>
                        <Text dimColor>Current:</Text>
                    </Box>
                    <Text>{entry.currentRange}</Text>
                </Box>
                <Box>
                    <Box width={12}>
                        <Text dimColor>Target:</Text>
                    </Box>
                    <Text>{entry.newRange}</Text>
                    <Text bold color={typeColor}>
                        {" "}
                        (
{entry.updateType}
)
                    </Text>
                </Box>
                <Box>
                    <Box width={12}>
                        <Text dimColor>Version:</Text>
                    </Box>
                    <Text>{entry.targetVersion}</Text>
                </Box>
                <Box>
                    <Box width={12}>
                        <Text dimColor>{entry.kind === "ecosystem" ? "Source:" : "Catalog:"}</Text>
                    </Box>
                    <Text color={entry.kind === "ecosystem" ? "cyan" : undefined}>{entry.catalogName}</Text>
                </Box>

                {/* Accepted risk notice */}
                {entry.acceptedRisk && (
                    <Box flexDirection="column" marginTop={1}>
                        <Text color="gray">{"\u2500\u2500 "}</Text>
                        <Text bold color="gray">
                            ACKNOWLEDGED RISK
                        </Text>
                        <Box flexDirection="column" paddingLeft={2}>
                            <Box>
                                <Text dimColor>Reason: </Text>
                                <Text>{entry.acceptedRisk.reason}</Text>
                            </Box>
                            <Box>
                                <Text dimColor>Accepted: </Text>
                                <Text>{entry.acceptedRisk.acceptedAt.slice(0, 10)}</Text>
                            </Box>
                        </Box>
                    </Box>
                )}

                {/* Security section */}
                {hasVulnerabilities && (
                    <Box flexDirection="column" marginTop={1}>
                        <Text dimColor>{"\u2500\u2500 "}</Text>
                        <Text bold color="red">
                            SECURITY
                        </Text>
                        <Text />
                        {entry.vulnerabilities!.map((vuln) => (
                            <Box flexDirection="column" key={vuln.id} marginBottom={1}>
                                <Box gap={1}>
                                    <Text bold color={SEVERITY_COLORS[vuln.severity] ?? "gray"}>
                                        {"\u26A0"}
{" "}
{vuln.severity}
                                    </Text>
                                    <Text bold>{vuln.id}</Text>
                                </Box>
                                <Box paddingLeft={2}>
                                    <Text>{vuln.summary}</Text>
                                </Box>
                                <Box gap={2} paddingLeft={2}>
                                    {vuln.cvssScore !== undefined && (
                                        <Text dimColor>
                                            CVSS:
                                            {String(vuln.cvssScore)}
                                        </Text>
                                    )}
                                    {vuln.fixedVersions.length > 0 && (
                                        <Text dimColor>
                                            Fixed in:
                                            {vuln.fixedVersions.join(", ")}
                                        </Text>
                                    )}
                                </Box>
                            </Box>
                        ))}
                    </Box>
                )}

                {/* Socket.dev section */}
                {entry.socketReport && (
                    <Box flexDirection="column" marginTop={1}>
                        <Text dimColor>{"\u2500\u2500 "}</Text>
                        <Text bold color="cyan">
                            SOCKET.DEV
                        </Text>
                        <Text />
                        <Box gap={2}>
                            <Box>
                                <Text dimColor>Overall: </Text>
                                <Text bold color={socketScoreColor}>
                                    {String(Math.round(socketScore * 100))}
%
                                </Text>
                            </Box>
                            <Box>
                                <Text dimColor>Supply Chain: </Text>
                                <Text>
{String(Math.round(entry.socketReport.score.supplyChain * 100))}
%
                                </Text>
                            </Box>
                            <Box>
                                <Text dimColor>Quality: </Text>
                                <Text>
{String(Math.round(entry.socketReport.score.quality * 100))}
%
                                </Text>
                            </Box>
                        </Box>
                        <Box gap={2}>
                            <Box>
                                <Text dimColor>Maintenance: </Text>
                                <Text>
{String(Math.round(entry.socketReport.score.maintenance * 100))}
%
                                </Text>
                            </Box>
                            <Box>
                                <Text dimColor>Vulnerability: </Text>
                                <Text>
{String(Math.round(entry.socketReport.score.vulnerability * 100))}
%
                                </Text>
                            </Box>
                            <Box>
                                <Text dimColor>License: </Text>
                                <Text>
                                    {entry.socketReport.license || "unknown"}
{" "}
(
{String(Math.round(entry.socketReport.score.license * 100))}
                                    %)
                                </Text>
                            </Box>
                        </Box>
                        {entry.socketReport.alerts.length > 0 && (
                            <Box flexDirection="column" marginTop={1}>
                                <Text bold color="yellow">
                                    {"\u26A0"}
{" "}
{String(entry.socketReport.alerts.length)}
{" "}
alert
{entry.socketReport.alerts.length === 1 ? "" : "s"}
:
                                </Text>
                                {entry.socketReport.alerts.map((alert) => (
                                    <Box gap={1} key={alert.key} paddingLeft={2}>
                                        <Text bold color={SOCKET_SEVERITY_COLORS[alert.severity] ?? "gray"}>
                                            [
{alert.severity.toUpperCase()}
]
                                        </Text>
                                        <Text>{alert.type}</Text>
                                        <Text dimColor>
(
{alert.category}
)
                                        </Text>
                                    </Box>
                                ))}
                            </Box>
                        )}
                    </Box>
                )}

                {/* AI Analysis section */}
                {recommendation && (
                    <Box flexDirection="column" marginTop={1}>
                        <Text dimColor>{"\u2500\u2500 "}</Text>
                        <Text bold color="white">
                            AI ANALYSIS
                        </Text>
                        <Text />
                        <Box gap={2}>
                            <Box>
                                <Text dimColor>Action: </Text>
                                <Text bold color={ACTION_COLORS[recommendation.action] ?? "white"}>
                                    {recommendation.action}
                                </Text>
                            </Box>
                            <Box>
                                <Text dimColor>Risk: </Text>
                                <Text bold color={RISK_COLORS[recommendation.riskLevel] ?? "white"}>
                                    {recommendation.riskLevel}
                                </Text>
                            </Box>
                            <Box>
                                <Text dimColor>Effort: </Text>
                                <Text bold>{recommendation.effort}</Text>
                            </Box>
                        </Box>
                        {recommendation.reason && (
                            <Box marginTop={1} paddingLeft={2}>
                                <Text>{recommendation.reason}</Text>
                            </Box>
                        )}
                        {recommendation.breakingChanges.length > 0 && (
                            <Box flexDirection="column" marginTop={1} paddingLeft={2}>
                                <Text bold color="yellow">
                                    Breaking changes:
                                </Text>
                                {recommendation.breakingChanges.map((change, i) => (
                                    <Text key={String(i)}>
                                        {" "}
                                        {"\u2022"}
{" "}
{change}
                                    </Text>
                                ))}
                            </Box>
                        )}
                    </Box>
                )}

                {/* Changelog section */}
                {changelogUrl && (
                    <Box flexDirection="column" marginTop={1}>
                        <Text dimColor>{"\u2500\u2500 "}</Text>
                        <Text bold color="white">
                            CHANGELOG
                        </Text>
                        <Box marginTop={1} paddingLeft={2}>
                            <Text color="cyan" underline>
                                {changelogUrl}
                            </Text>
                        </Box>
                    </Box>
                )}

                {/* Links & guidance */}
                <Box flexDirection="column" marginTop={1}>
                    <Text dimColor>{"\u2500\u2500 "}</Text>
                    <Text bold color="white">
                        LINKS
                    </Text>
                    <Box flexDirection="column" marginTop={1} paddingLeft={2}>
                        {entry.kind === "ecosystem"
                            ? (
                            <Text color="cyan" underline>
                                {entry.detailUrl ?? entry.displayName ?? entry.packageName}
                            </Text>
                            )
                            : (
                            <Text color="cyan" underline>
                                https://npmx.dev/
                                {entry.packageName}
                            </Text>
                            )}
                    </Box>
                </Box>

                {/* Update guidance when no AI analysis (npm packages only) */}
                {!recommendation && entry.kind !== "ecosystem" && (
                    <Box flexDirection="column" marginTop={1}>
                        <Text dimColor>{"\u2500\u2500 "}</Text>
                        <Text bold color="white">
                            GUIDANCE
                        </Text>
                        <Box flexDirection="column" marginTop={1} paddingLeft={2}>
                            {entry.updateType === "major" && (
                                <>
                                    <Text color="red">
{"\u26A0"}
{" "}
Major update — likely contains breaking changes.
                                    </Text>
                                    <Text dimColor> Review the changelog before updating.</Text>
                                    <Text dimColor> Use --changelog to fetch release URLs.</Text>
                                </>
                            )}
                            {entry.updateType === "minor" && (
                                <>
                                    <Text color="yellow">
{"\u2139"}
{" "}
Minor update — new features, backward compatible.
                                    </Text>
                                    <Text dimColor> Generally safe to update.</Text>
                                </>
                            )}
                            {entry.updateType === "patch" && (
                                <>
                                    <Text color="green">
{"\u2713"}
{" "}
Patch update — bug fixes only.
                                    </Text>
                                    <Text dimColor> Safe to update.</Text>
                                </>
                            )}
                            {!recommendation && <Text dimColor> Use --ai to get AI-powered analysis.</Text>}
                        </Box>
                    </Box>
                )}
            </ScrollView>
        </Box>
    );
};

export default PackageDetailPanel;
