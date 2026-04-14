import type { ExtensionCatalogEntry } from "./extensions";
import { EXTENSION_CATALOG } from "./extensions";
import type { FeatureCatalogEntry } from "./features";
import { FEATURE_CATALOG } from "./features";

export const filterFeatures = (searchText: string): FeatureCatalogEntry[] => {
    if (!searchText) {
        return FEATURE_CATALOG;
    }

    const lower = searchText.toLowerCase();

    return FEATURE_CATALOG.filter(
        (f) => f.name.toLowerCase().includes(lower) || f.id.toLowerCase().includes(lower) || f.description.toLowerCase().includes(lower),
    );
};

export const filterExtensions = (searchText: string): ExtensionCatalogEntry[] => {
    if (!searchText) {
        return EXTENSION_CATALOG;
    }

    const lower = searchText.toLowerCase();

    return EXTENSION_CATALOG.filter(
        (e) => e.name.toLowerCase().includes(lower) || e.id.toLowerCase().includes(lower) || e.description.toLowerCase().includes(lower),
    );
};
