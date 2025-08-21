import type { ContentPage, DisplayerOptions, RequestContext } from "../../types";
import requestPanel from "../components/request-panel";

export default async function buildContextContent(request: RequestContext | undefined, options: DisplayerOptions): Promise<ContentPage | undefined> {
    const { html, script } = await requestPanel(request, options);

    if (!html) {
        return undefined;
    }

    return {
        id: "context",
        name: "Context",
        code: { html, script },
    };
}
