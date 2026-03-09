import Section from "@/components/sections/section";
import SectionTitle from "@/components/sections/section-title";

const Community = () => (
    <div className="">
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

            <div className="h-56">test</div>
            <div className="h-56">Find us on the feed</div>
            <div className="h-56">Join our community</div>
            <div className="h-56">Find us on the feed</div>
        </Section>
    </div>
);

export default Community;
