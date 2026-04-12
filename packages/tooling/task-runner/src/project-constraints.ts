import type { ConstraintsConfig, ConstraintViolation, ProjectConfiguration, ProjectGraph } from "./types";

/**
 * Layer hierarchy from lowest to highest. A project at a given layer
 * may only depend on projects at the same index or lower.
 */
const LAYER_ORDER: NonNullable<ProjectConfiguration["layer"]>[] = [
    "configuration",
    "library",
    "scaffolding",
    "tool",
    "automation",
    "application",
];

const layerIndex = (layer: ProjectConfiguration["layer"]): number | undefined => {
    if (!layer) {
        return undefined;
    }

    const idx = LAYER_ORDER.indexOf(layer);

    return idx === -1 ? undefined : idx;
};

/**
 * Enforces project dependency constraints on a project graph.
 * Returns an array of violations found. Does not throw — the caller
 * decides how to handle violations (fatal error, warning, etc.).
 *
 * Four constraint mechanisms:
 * 1. **Tag relationships**: If a project has a tag listed in `tagRelationships`,
 *    its dependencies must have at least one of the required tags.
 * 2. **Type boundaries**: Controls which project types can depend on which.
 *    By default, no project may depend on an "application" type project.
 * 3. **Dependency kind rules**: Controls rules based on whether the dependency
 *    is a production dependency, devDependency, or peerDependency.
 * 4. **Layer relationships**: Projects can only depend on projects at the
 *    same or lower layer (configuration < library < ... < application).
 */
const enforceProjectConstraints = (projectGraph: ProjectGraph, constraints: ConstraintsConfig): ConstraintViolation[] => {
    const violations: ConstraintViolation[] = [];

    const { dependencyKindRules, enforceLayerRelationships, tagRelationships, typeBoundaries } = constraints;
    const hasTagRules = tagRelationships && Object.keys(tagRelationships).length > 0;
    const hasTypeBoundaries = typeBoundaries !== undefined;
    const hasKindRules = dependencyKindRules !== undefined;
    const hasLayerRules = enforceLayerRelationships === true;

    if (!hasTagRules && !hasTypeBoundaries && !hasKindRules && !hasLayerRules) {
        return violations;
    }

    const enforceAppBoundary = typeBoundaries?.enforceApplicationBoundary !== false;
    const allowedDepTypes = typeBoundaries?.allowedDependencyTypes;

    for (const [projectName, dependencies] of Object.entries(projectGraph.dependencies)) {
        const sourceNode = projectGraph.nodes[projectName];

        if (!sourceNode) {
            continue;
        }

        const sourceTags = sourceNode.data.tags ?? [];
        const sourceType = sourceNode.type;

        for (const dep of dependencies) {
            const depNode = projectGraph.nodes[dep.target];

            if (!depNode) {
                continue;
            }

            const depTags = depNode.data.tags ?? [];
            const depType = depNode.type;

            // Type boundary: application projects should not be depended upon
            let appBoundaryViolated = false;

            if (hasTypeBoundaries && enforceAppBoundary && depType === "application") {
                appBoundaryViolated = true;
                violations.push({
                    dependencyProject: dep.target,
                    message: `Project "${projectName}" depends on "${dep.target}", which is an application. Applications should not be depended upon by other projects.`,
                    rule: "type-boundary",
                    sourceProject: projectName,
                });
            }

            // Type boundary: custom allowed dependency types
            // Skip if already flagged by application boundary to avoid duplicates
            if (allowedDepTypes && !appBoundaryViolated) {
                const allowed = allowedDepTypes[sourceType];

                if (allowed && !allowed.includes(depType)) {
                    violations.push({
                        dependencyProject: dep.target,
                        message: `Project "${projectName}" (type: ${sourceType}) depends on "${dep.target}" (type: ${depType}). Allowed dependency types for "${sourceType}" are: ${allowed.join(", ")}.`,
                        rule: "type-boundary",
                        sourceProject: projectName,
                    });
                }
            }

            // Tag relationships: source tag requires dependency to have specific tags
            if (hasTagRules && tagRelationships) {
                for (const sourceTag of sourceTags) {
                    const requiredTags = tagRelationships[sourceTag];

                    if (!requiredTags || requiredTags.length === 0) {
                        continue;
                    }

                    // Dependency must have at least one of the required tags
                    const hasRequiredTag = depTags.some((tag) => requiredTags.includes(tag));

                    if (!hasRequiredTag) {
                        violations.push({
                            dependencyProject: dep.target,
                            message: `Project "${projectName}" (tag: ${sourceTag}) depends on "${dep.target}", which doesn't have any of the required tags: ${requiredTags.join(", ")}. ${depTags.length > 0 ? `"${dep.target}" has tags: ${depTags.join(", ")}.` : `"${dep.target}" has no tags.`}`,
                            rule: "tag-relationship",
                            sourceProject: projectName,
                        });
                    }
                }
            }

            // Dependency kind rules
            if (hasKindRules && dependencyKindRules) {
                // Production dependencies must not point to application projects
                if (dependencyKindRules.noProductionDependencyOnApplication && dep.type === "static" && depType === "application") {
                    violations.push({
                        dependencyProject: dep.target,
                        message: `Project "${projectName}" has a production dependency on "${dep.target}", which is an application. Production dependencies on applications are not allowed. Use devDependencies instead if needed for testing.`,
                        rule: "dependency-kind",
                        sourceProject: projectName,
                    });
                }

                // Libraries must not have a devDependency on a package that is also a production dep
                if (dependencyKindRules.noDevDependencyOnProductionDep && dep.type === "devDependency" && sourceType === "library") {
                    const hasProductionDep = dependencies.some((other) => other.target === dep.target && other.type === "static");

                    if (hasProductionDep) {
                        violations.push({
                            dependencyProject: dep.target,
                            message: `Project "${projectName}" has "${dep.target}" in both dependencies and devDependencies. This is redundant — remove it from devDependencies.`,
                            rule: "dependency-kind",
                            sourceProject: projectName,
                        });
                    }
                }
            }

            // Layer hierarchy: a project may only depend on the same or lower layer
            if (hasLayerRules) {
                const sourceLayer = layerIndex(sourceNode.data.layer);
                const depLayer = layerIndex(depNode.data.layer);

                if (sourceLayer !== undefined && depLayer !== undefined && depLayer > sourceLayer) {
                    violations.push({
                        dependencyProject: dep.target,
                        message: `Project "${projectName}" (layer: ${sourceNode.data.layer!}) depends on "${dep.target}" (layer: ${depNode.data.layer!}). A "${sourceNode.data.layer!}" project may only depend on projects at the same or lower layer. Hierarchy: ${LAYER_ORDER.join(" < ")}.`,
                        rule: "layer-relationship",
                        sourceProject: projectName,
                    });
                }
            }
        }
    }

    return violations;
};

export { enforceProjectConstraints };
