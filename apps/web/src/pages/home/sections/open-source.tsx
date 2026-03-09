import { Star } from "lucide-react";

import Section from "@/components/sections/section";
import SectionTitle from "@/components/sections/section-title";
import HighlightLink from "@/components/ui/highlight-link";

const OpenSource = () => (
    <Section classes={{ childrenWrapper: "items-end", root: "pb-[240px]" }}>
        <div className="col-span-2">
            <SectionTitle
                description={
                    <span className="flex flex-col gap-5">
                        <span>
                            At Visulima, we believe every line of code tells a story. By combining elegant syntax with intuitive design, we empower developers
                            to create with confidence and joy.
                        </span>
                        <span>Our philosophy is simple: great tools lead to great creations, and development should always inspire — not frustrate.</span>
                    </span>
                }
                prefix="Open Source"
                title="Proudly OpenSource."
            />
        </div>
        <div className="hidden lg:col-span-1 lg:block" />
        <div className="col-span-1">
            <HighlightLink icon={<Star />} target="_blank" to="https://github.com/visulima">
                Star us on GitHub
            </HighlightLink>
        </div>
    </Section>
);

export default OpenSource;
