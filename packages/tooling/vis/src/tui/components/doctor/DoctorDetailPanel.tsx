import type { ScrollViewRef } from "@visulima/tui";
import { Box, ScrollView, Text } from "@visulima/tui";
import React from "react";

import { scoreColor } from "../../../security/socket-security";
import type { DoctorFinding } from "./findings";
import { SECTION_LABELS } from "./findings";

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

const UPDATE_TYPE_COLORS: Record<string, string> = {
    major: "red",
    minor: "yellow",
    patch: "green",
};

interface FieldRowProps {
    children: React.ReactNode;
    label: string;
    width?: number;
}

const FieldRow = ({ children, label, width = 14 }: FieldRowProps): React.JSX.Element => (
    <Box>
        <Box width={width}>
            <Text dimColor>{label}:</Text>
        </Box>
        {typeof children === "string" ? <Text>{children}</Text> : children}
    </Box>
);

const SectionTitle = ({ children }: { children: React.ReactNode }): React.JSX.Element => (
    <Box marginTop={1}>
        <Text bold color="white">
            {children}
        </Text>
    </Box>
);

interface OutdatedDetailProps {
    finding: Extract<DoctorFinding, { kind: "outdated" }>;
}

const OutdatedDetail = ({ finding }: OutdatedDetailProps): React.JSX.Element => {
    const { entry } = finding;
    const typeColor = UPDATE_TYPE_COLORS[entry.updateType] ?? "white";

    return (
        <Box flexDirection="column">
            <FieldRow label="Current">{entry.currentRange}</FieldRow>
            <FieldRow label="Target">
                <Text>{entry.newRange}</Text>
                <Text bold color={typeColor}>
                    {" ("}
                    {entry.updateType})
                </Text>
            </FieldRow>
            <FieldRow label="Catalog">{entry.catalogName}</FieldRow>
            {entry.acceptedRisk ? (
                <FieldRow label="Risk ack">
                    <Text dimColor>{entry.acceptedRisk.reason ?? "(no reason recorded)"}</Text>
                </FieldRow>
            ) : null}
            <SectionTitle>Action</SectionTitle>
            <Text dimColor>
                Run{" "}
                <Text bold color="white">
                    vis update
                </Text>{" "}
                to apply this change.
            </Text>
        </Box>
    );
};

interface DuplicateDetailProps {
    finding: Extract<DoctorFinding, { kind: "duplicate" }>;
}

const DuplicateDetail = ({ finding }: DuplicateDetailProps): React.JSX.Element => (
    <Box flexDirection="column">
        <FieldRow label="Versions">
            <Text>{String(finding.pkg.versions.length)}</Text>
        </FieldRow>
        <SectionTitle>Installed versions</SectionTitle>
        {finding.pkg.versions.map((v) => (
            <Text key={v}>
                {"  · "}
                {v}
            </Text>
        ))}
        <SectionTitle>Action</SectionTitle>
        <Text dimColor>
            Run{" "}
            <Text bold color="white">
                vis dedupe
            </Text>{" "}
            to consolidate to a single resolution.
        </Text>
    </Box>
);

interface VulnerabilityDetailProps {
    finding: Extract<DoctorFinding, { kind: "vulnerability" }>;
}

const VulnerabilityDetail = ({ finding }: VulnerabilityDetailProps): React.JSX.Element => {
    const vulns = finding.entry.vulnerabilities ?? [];

    return (
        <Box flexDirection="column">
            <FieldRow label="Package">{finding.packageName}</FieldRow>
            <FieldRow label="Current">{finding.entry.currentRange}</FieldRow>
            <FieldRow label="Advisories">{String(vulns.length)}</FieldRow>
            {finding.entry.acceptedRisk ? (
                <FieldRow label="Risk ack">
                    <Text dimColor>{finding.entry.acceptedRisk.reason ?? "(no reason recorded)"}</Text>
                </FieldRow>
            ) : null}
            {vulns.map((v) => {
                const sevColor = SEVERITY_COLORS[v.severity] ?? "gray";

                return (
                    <Box flexDirection="column" key={v.id} marginTop={1}>
                        <Box>
                            <Text bold color={sevColor}>
                                {v.severity}
                            </Text>
                            <Text> </Text>
                            <Text>{v.id}</Text>
                            {typeof v.cvssScore === "number" ? (
                                <Text dimColor>
                                    {" · CVSS "}
                                    {v.cvssScore.toFixed(1)}
                                </Text>
                            ) : null}
                        </Box>
                        <Text wrap="wrap">{v.summary}</Text>
                        {v.fixedVersions.length > 0 ? (
                            <Text dimColor>
                                {"Fixed in: "}
                                {v.fixedVersions.join(", ")}
                            </Text>
                        ) : null}
                        {v.aliases && v.aliases.length > 0 ? (
                            <Text dimColor>
                                {"Aliases: "}
                                {v.aliases.join(", ")}
                            </Text>
                        ) : null}
                    </Box>
                );
            })}
        </Box>
    );
};

interface SocketDetailProps {
    finding: Extract<DoctorFinding, { kind: "socket" }>;
}

const SocketDetail = ({ finding }: SocketDetailProps): React.JSX.Element => {
    const report = finding.entry.socketReport;

    if (!report) {
        return <Text dimColor>No Socket report attached.</Text>;
    }

    const overall = Math.round(report.score.overall * 100);
    const overallColor = scoreColor(report.score.overall);

    return (
        <Box flexDirection="column">
            <FieldRow label="Package">{finding.packageName}</FieldRow>
            <FieldRow label="Overall">
                <Text color={overallColor}>{String(overall)}%</Text>
            </FieldRow>
            <FieldRow label="Alerts">{String(report.alerts.length)}</FieldRow>
            {finding.entry.acceptedRisk ? (
                <FieldRow label="Risk ack">
                    <Text dimColor>{finding.entry.acceptedRisk.reason ?? "(no reason recorded)"}</Text>
                </FieldRow>
            ) : null}
            <SectionTitle>Score breakdown</SectionTitle>
            {Object.entries(report.score).map(([key, value]) => {
                if (key === "overall") {
                    return null;
                }

                const numericValue = typeof value === "number" ? value : 0;
                const pct = Math.round(numericValue * 100);
                const color = scoreColor(numericValue);

                return (
                    <Box key={key}>
                        <Box width={14}>
                            <Text dimColor>{key}:</Text>
                        </Box>
                        <Text color={color}>{String(pct)}%</Text>
                    </Box>
                );
            })}
            <SectionTitle>Alerts</SectionTitle>
            {report.alerts.map((alert, index) => {
                const sevColor = SOCKET_SEVERITY_COLORS[alert.severity] ?? "gray";

                return (
                    <Box flexDirection="column" key={`${alert.type}-${String(index)}`} marginBottom={1}>
                        <Box>
                            <Text bold color={sevColor}>
                                {alert.severity}
                            </Text>
                            <Text> </Text>
                            <Text>{alert.type}</Text>
                        </Box>
                        {alert.props ? (
                            <Text dimColor wrap="wrap">
                                {JSON.stringify(alert.props)}
                            </Text>
                        ) : null}
                    </Box>
                );
            })}
        </Box>
    );
};

interface OptimizationDetailProps {
    finding: Extract<DoctorFinding, { kind: "optimization" }>;
}

const OptimizationDetail = ({ finding }: OptimizationDetailProps): React.JSX.Element => {
    const { entry } = finding;

    return (
        <Box flexDirection="column">
            <FieldRow label="Package">{entry.packageName}</FieldRow>
            <FieldRow label="Category">{entry.category}</FieldRow>
            <FieldRow label="Replacement">{entry.replacement}</FieldRow>
            {entry.overrideSpec ? <FieldRow label="Override">{entry.overrideSpec}</FieldRow> : null}
            <FieldRow label="Codemod">
                <Text color={entry.hasCodemod ? "green" : "gray"}>{entry.hasCodemod ? "available" : "not available"}</Text>
            </FieldRow>
            {entry.docUrl ? (
                <FieldRow label="Guide">
                    <Text color="cyan" underline>
                        {entry.docUrl}
                    </Text>
                </FieldRow>
            ) : null}
            <SectionTitle>Action</SectionTitle>
            {entry.hasCodemod ? (
                <Text dimColor>
                    Run{" "}
                    <Text bold color="white">
                        vis optimize
                    </Text>{" "}
                    to apply the codemod interactively.
                </Text>
            ) : entry.overrideSpec ? (
                <Text dimColor>
                    Run{" "}
                    <Text bold color="white">
                        vis optimize
                    </Text>{" "}
                    to install the package override.
                </Text>
            ) : entry.docUrl ? (
                <Text dimColor>No automated codemod. Open the migration guide above for the recommended alternative and steps.</Text>
            ) : (
                <Text dimColor>No automated codemod. Consult the package&apos;s docs or the e18e module-replacements guide for an alternative.</Text>
            )}
        </Box>
    );
};

interface RuntimeDetailProps {
    finding: Extract<DoctorFinding, { kind: "runtime" }>;
}

const RuntimeDetail = ({ finding }: RuntimeDetailProps): React.JSX.Element => {
    const { diagnostic } = finding;
    const statusColor = diagnostic.status === "warn" ? "yellow" : diagnostic.status === "ok" ? "green" : "gray";

    return (
        <Box flexDirection="column">
            <FieldRow label="Check">{diagnostic.id}</FieldRow>
            <FieldRow label="Status">
                <Text color={statusColor}>{diagnostic.status}</Text>
            </FieldRow>
            <SectionTitle>Message</SectionTitle>
            <Text wrap="wrap">{diagnostic.message}</Text>
            {diagnostic.detail && Object.keys(diagnostic.detail).length > 0 ? (
                <>
                    <SectionTitle>Details</SectionTitle>
                    {Object.entries(diagnostic.detail).map(([key, value]) => (
                        <Box key={key}>
                            <Box width={20}>
                                <Text dimColor>{key}:</Text>
                            </Box>
                            <Text>{String(value)}</Text>
                        </Box>
                    ))}
                </>
            ) : null}
        </Box>
    );
};

interface DoctorDetailPanelProps {
    finding: DoctorFinding | null;
    focused: boolean;
    scrollRef?: React.RefObject<ScrollViewRef | null>;
}

const DoctorDetailPanel = ({ finding, focused, scrollRef }: DoctorDetailPanelProps): React.JSX.Element => {
    const borderColor = focused ? "white" : "gray";

    if (!finding) {
        return (
            <Box alignItems="center" borderColor="gray" borderStyle="single" flexDirection="column" flexGrow={1} justifyContent="center">
                <Text dimColor>No finding selected</Text>
            </Box>
        );
    }

    let body: React.JSX.Element;

    switch (finding.kind) {
        case "duplicate": {
            body = <DuplicateDetail finding={finding} />;
            break;
        }
        case "optimization": {
            body = <OptimizationDetail finding={finding} />;
            break;
        }
        case "outdated": {
            body = <OutdatedDetail finding={finding} />;
            break;
        }
        case "runtime": {
            body = <RuntimeDetail finding={finding} />;
            break;
        }
        case "socket": {
            body = <SocketDetail finding={finding} />;
            break;
        }
        case "vulnerability": {
            body = <VulnerabilityDetail finding={finding} />;
            break;
        }
        default: {
            body = <Text dimColor>Unknown finding kind.</Text>;
            break;
        }
    }

    return (
        <Box borderColor={borderColor} borderStyle="single" flexDirection="column" flexGrow={1}>
            <Box flexShrink={0} paddingTop={1} paddingX={2}>
                <Text bold color="white">
                    {finding.title}
                </Text>
                <Text dimColor>
                    {"  "}
                    {SECTION_LABELS[finding.section]}
                </Text>
            </Box>

            <ScrollView flexGrow={1} flexShrink={1} paddingX={2} ref={scrollRef} scrollbar scrollbarColor="gray" scrollbarStyle="block">
                <Text />
                {body}
            </ScrollView>
        </Box>
    );
};

export default DoctorDetailPanel;
