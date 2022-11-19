import type { Heading } from "nextra";
import type { ReactElement, Ref } from "react";
import React from "react";

import { useActiveAnchor } from "../../contexts";
import Toc from "./toc";

export type TOCProps = {
    headings: Heading[];
    wrapperRef: Ref<HTMLDivElement>
};

const TocPageContent = ({ headings, wrapperRef }: TOCProps): ReactElement => {
    const activeAnchor = useActiveAnchor();

    return (
        <div ref={wrapperRef} className="pt-8 text-sm [hyphens:auto]">
            <Toc headings={headings} activeAnchor={activeAnchor} isPage />
        </div>
    );
};

export default TocPageContent;
