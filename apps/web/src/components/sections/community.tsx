import Section from "@/components/sections/section";
import SectionTitle from "@/components/sections/section-title";

const Community = () => (
    <div>
        <Section>
            <SectionTitle
                classes={{
                    root: "col-span-4",
                }}
                description="Connect, learn, and grow with fellow designers and developers. We’re here to help you succeed."
                mode="dark"
                position="center"
                title="Join the community"
            />

            {/* TODO: Replace placeholders with real community content */}
            <div className="h-56" aria-label="Community content placeholder">
                test
            </div>
            <div className="h-56" aria-label="Social feed placeholder">
                Find us on the feed
            </div>
            <div className="h-56" aria-label="Community join placeholder">
                Join our community
            </div>
            <div className="h-56" aria-label="Social feed placeholder">
                Find us on the feed
            </div>
        </Section>
    </div>
);

export default Community;
