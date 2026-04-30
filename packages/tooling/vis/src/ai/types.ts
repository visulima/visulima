export type AnalysisType = "compatibility" | "impact" | "recommend" | "security";

export interface AiRecommendation {
    action: "defer" | "review" | "skip" | "update";
    breakingChanges: string[];
    effort: "high" | "low" | "medium";
    package: string;
    reason: string;
    riskLevel: "critical" | "high" | "low" | "medium";
}

export interface AiAnalysisResult {
    analysisType: AnalysisType;
    provider: string;
    recommendations: AiRecommendation[];
    summary: string;
    warnings: string[];
}
