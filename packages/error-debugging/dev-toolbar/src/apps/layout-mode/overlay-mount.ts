/* eslint-disable jsdoc/check-tag-names -- jsxImportSource is a TS pragma, not a JSDoc tag */

/** @jsxImportSource preact */
import type { ComponentChild } from "preact";
import { render } from "preact";

import { sharedToolbarStylesheet } from "../../toolbar/stylesheet";
import { ensureLayoutModeStyleTag, getLayoutModeKeyframesSheet } from "./styles";

const HOST_ID = "__vdt-layout-mode-host";

interface OverlayMount {
    container: HTMLDivElement;
    host: HTMLElement;
    shadow: ShadowRoot;
}

let mount: OverlayMount | undefined;

const createMount = (): OverlayMount => {
    const host = document.createElement("dev-toolbar-layout-mode");

    host.id = HOST_ID;
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.pointerEvents = "none";
    host.style.zIndex = "99995";
    host.dataset.feedbackToolbar = "";

    const shadow = host.attachShadow({ mode: "open" });
    const sheets: CSSStyleSheet[] = [];

    if (sharedToolbarStylesheet) {
        sheets.push(sharedToolbarStylesheet);
    }

    const keyframes = getLayoutModeKeyframesSheet();

    if (keyframes) {
        sheets.push(keyframes);
    }

    if (sheets.length > 0) {
        shadow.adoptedStyleSheets = sheets;
    } else {
        ensureLayoutModeStyleTag();
    }

    const container = document.createElement("div");

    container.style.pointerEvents = "auto";
    shadow.append(container);
    document.body.append(host);

    return { container, host, shadow };
};

export const mountLayoutModeOverlay = (children: ComponentChild): void => {
    if (typeof document === "undefined") {
        return;
    }

    if (!mount) {
        mount = createMount();
    }

    render(children, mount.container);
};

export const unmountLayoutModeOverlay = (): void => {
    if (!mount) {
        return;
    }

    render(null, mount.container);
    mount.host.remove();
    mount = undefined;
};

export const isLayoutModeOverlayMounted = (): boolean => mount !== undefined;
