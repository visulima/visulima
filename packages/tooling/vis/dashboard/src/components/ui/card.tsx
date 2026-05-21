import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Panel container with a bordered, flex-column layout for grouped content.
 * @param props Standard div attributes.
 * @param props.className Extra utility classes merged onto the card root.
 * @returns A div element with the card chrome applied.
 */
const Card = ({ className, ...props }: React.ComponentProps<"div">) => (
    <div className={cn("flex flex-col gap-4 border border-border bg-panel py-5", className)} data-slot="card" {...props} />
);

/**
 * Header row inside a Card; stacks title and description with consistent padding.
 * @param props Standard div attributes.
 * @param props.className Extra utility classes merged onto the header root.
 * @returns A div element styled as the card header.
 */
const CardHeader = ({ className, ...props }: React.ComponentProps<"div">) => (
    <div className={cn("flex flex-col gap-1 px-6", className)} data-slot="card-header" {...props} />
);

/**
 * Card title styled with the design system's label treatment.
 * @param props Standard div attributes.
 * @param props.className Extra utility classes merged onto the title root.
 * @returns A div element rendering the card's title.
 */
const CardTitle = ({ className, ...props }: React.ComponentProps<"div">) => <div className={cn("nd-label", className)} data-slot="card-title" {...props} />;

/**
 * Muted subtitle paired with a CardTitle inside a CardHeader.
 * @param props Standard div attributes.
 * @param props.className Extra utility classes merged onto the description root.
 * @returns A div element rendering the card's description.
 */
const CardDescription = ({ className, ...props }: React.ComponentProps<"div">) => (
    <div className={cn("text-sm text-muted", className)} data-slot="card-description" {...props} />
);

/**
 * Body region of a Card; applies horizontal padding matching the header/footer.
 * @param props Standard div attributes.
 * @param props.className Extra utility classes merged onto the content root.
 * @returns A div element rendering the card's content area.
 */
const CardContent = ({ className, ...props }: React.ComponentProps<"div">) => <div className={cn("px-6", className)} data-slot="card-content" {...props} />;

/**
 * Footer row inside a Card; aligns items inline at the bottom of the panel.
 * @param props Standard div attributes.
 * @param props.className Extra utility classes merged onto the footer root.
 * @returns A div element rendering the card's footer.
 */
const CardFooter = ({ className, ...props }: React.ComponentProps<"div">) => (
    <div className={cn("flex items-center px-6 pt-2", className)} data-slot="card-footer" {...props} />
);

export { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle };
