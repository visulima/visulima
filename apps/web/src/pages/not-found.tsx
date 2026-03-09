import type { NotFoundRouteProps } from "@tanstack/react-router";
import { Link } from "@tanstack/react-router";
import type { FC, PropsWithChildren } from "react";

import Section from "@/components/sections/section";
import SectionSeparator from "@/components/sections/section-separator";
import SectionTitle from "@/components/sections/section-title";
import { Button } from "@/components/ui/button";

import SupportSection from "./home/sections/support";

// eslint-disable-next-line import/prefer-default-export
export const NotFound: FC<PropsWithChildren<NotFoundRouteProps>> = ({ children }) => (
    <>
        <div className="bg-coal relative border-b p-0 font-sans">
            <Section
                classes={{
                    pattern: "inset-y-10",
                    root: "py-20 lg:py-32",
                }}
                gridLength={0}
                mode="dark"
                patternColor="crimson-energy"
                patternPosition="bottom"
            >
                <SectionTitle
                    classes={{
                        root: "text-center col-span-2 lg:col-span-4",
                    }}
                    description={children || "Oops! The page you are looking for does not exist or has been moved."}
                    mode="dark"
                    position="center"
                    title="Page Not Found"
                />

                <div className="col-span-2 lg:col-span-4 flex flex-wrap items-center justify-center gap-4 mt-24">
                    <Button
                        className="cursor-pointer"
                        onClick={() => {
                            globalThis.history.back();
                        }}
                    >
                        Go back
                    </Button>
                    <Link className="rounded bg-sky-sapphire px-4 py-2 text-base text-white hover:bg-sky-sapphire/50 transition-colors" to="/">
                        Start Over
                    </Link>
                </div>
            </Section>
            <SectionSeparator bgColor="bg-coal" fillColor="fill-coal" position="bottom" />
        </div>
        <SupportSection />
    </>
);
