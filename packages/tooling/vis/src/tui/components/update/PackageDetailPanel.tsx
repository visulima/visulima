import type { ScrollViewRef } from "@visulima/tui";
import { Box, ScrollView, Text } from "@visulima/tui";

import type { AiRecommendation } from "../../../ai-analysis";
import type { OutdatedEntry } from "../../../catalog";

// ── Helpers ─────────────────────────────────────────────────────────────

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

// ── Component ───────────────────────────────────────────────────────────

interface PackageDetailPanelProps {
    changelogUrl?: string;
    entry: OutdatedEntry | null;
    focused: boolean;
    recommendation?: AiRecommendation;
    scrollRef?: React.RefObject<ScrollViewRef>;
}

const PackageDetailPanel = ({ changelogUrl, entry, focused, recommendation, scrollRef }: PackageDetailPanelProps): React.JSX.Element => {
    const borderColor = focused ? "white" : "gray";

    if (!entry) {
        return (
            <Box borderColor="gray" borderStyle="single" flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
                <Text dimColor>No package selected</Text>
            </Box>
        );
    }

    const typeColor = UPDATE_TYPE_COLORS[entry.updateType] ?? "white";
    const hasVulnerabilities = entry.vulnerabilities && entry.vulnerabilities.length > 0;

    return (
        <Box borderColor={borderColor} borderStyle="single" flexDirection="column" flexGrow={1}>
            {/* Package name title — fixed */}
            <Box flexShrink={0} paddingX={2} paddingTop={1}>
                <Text bold color="white">{entry.packageName}</Text>
            </Box>

            <ScrollView ref={scrollRef} flexGrow={1} flexShrink={1} paddingX={2} scrollbar scrollbarColor="gray">
            {/* Version info */}
            <Text>{""}</Text>

            {/* Version info */}
            <Box>
                <Box width={12}><Text dimColor>Current:</Text></Box>
                <Text>{entry.currentRange}</Text>
            </Box>
            <Box>
                <Box width={12}><Text dimColor>Target:</Text></Box>
                <Text>{entry.newRange}</Text>
                <Text color={typeColor} bold>  ({entry.updateType})</Text>
            </Box>
            <Box>
                <Box width={12}><Text dimColor>Version:</Text></Box>
                <Text>{entry.targetVersion}</Text>
            </Box>
            <Box>
                <Box width={12}><Text dimColor>Catalog:</Text></Box>
                <Text>{entry.catalogName}</Text>
            </Box>

            {/* Security section */}
            {hasVulnerabilities && (
                <Box flexDirection="column" marginTop={1}>
                    <Text dimColor>{"\u2500\u2500 "}</Text><Text bold color="red">SECURITY</Text>
                    <Text>{""}</Text>
                    {entry.vulnerabilities!.map((vuln) => (
                        <Box key={vuln.id} flexDirection="column" marginBottom={1}>
                            <Box gap={1}>
                                <Text color={SEVERITY_COLORS[vuln.severity] ?? "gray"} bold>
                                    {"\u26A0"} {vuln.severity}
                                </Text>
                                <Text bold>{vuln.id}</Text>
                            </Box>
                            <Box paddingLeft={2}>
                                <Text>{vuln.summary}</Text>
                            </Box>
                            <Box paddingLeft={2} gap={2}>
                                {vuln.cvssScore !== undefined && (
                                    <Text dimColor>CVSS: {String(vuln.cvssScore)}</Text>
                                )}
                                {vuln.fixedVersions.length > 0 && (
                                    <Text dimColor>Fixed in: {vuln.fixedVersions.join(", ")}</Text>
                                )}
                            </Box>
                        </Box>
                    ))}
                </Box>
            )}

            {/* AI Analysis section */}
            {recommendation && (
                <Box flexDirection="column" marginTop={1}>
                    <Text dimColor>{"\u2500\u2500 "}</Text><Text bold color="white">AI ANALYSIS</Text>
                    <Text>{""}</Text>
                    <Box gap={2}>
                        <Box>
                            <Text dimColor>Action: </Text>
                            <Text color={ACTION_COLORS[recommendation.action] ?? "white"} bold>
                                {recommendation.action}
                            </Text>
                        </Box>
                        <Box>
                            <Text dimColor>Risk: </Text>
                            <Text color={RISK_COLORS[recommendation.riskLevel] ?? "white"} bold>
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
                            <Text color="yellow" bold>Breaking changes:</Text>
                            {recommendation.breakingChanges.map((change, i) => (
                                <Text key={String(i)}>  {"\u2022"} {change}</Text>
                            ))}
                        </Box>
                    )}
                </Box>
            )}

            {/* Changelog section */}
            {changelogUrl && (
                <Box flexDirection="column" marginTop={1}>
                    <Text dimColor>{"\u2500\u2500 "}</Text><Text bold color="white">CHANGELOG</Text>
                    <Box marginTop={1} paddingLeft={2}>
                        <Text color="cyan" underline>{changelogUrl}</Text>
                    </Box>
                </Box>
            )}

            {/* Empty state for no extra info */}
            {!hasVulnerabilities && !recommendation && !changelogUrl && (
                <Box marginTop={1}>
                    <Text dimColor>No additional details available.</Text>
                </Box>
            )}
            </ScrollView>
        </Box>
    );
};

export default PackageDetailPanel;
