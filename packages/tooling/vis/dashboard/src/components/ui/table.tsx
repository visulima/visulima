import * as React from "react";

import { cn } from "@/lib/utils";

const Table = ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="relative w-full overflow-auto">
        <table className={cn("w-full caption-bottom border-collapse text-sm", className)} {...props} />
    </div>
);

const TableHeader = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className={cn("[&_tr]:border-b-0", className)} {...props} />
);

const TableBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <tbody className={className} {...props} />
);

const TableFooter = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <tfoot className={cn("border-t border-border2", className)} {...props} />
);

const TableRow = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr
        className={cn(
            "transition-colors hover:bg-row-hover data-[state=selected]:bg-row-hover [&>td]:border-b [&>td]:border-border",
            className,
        )}
        {...props}
    />
);

const TableHead = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th
        className={cn(
            "nd-mono h-10 bg-bg px-4 text-left align-middle text-[11px] uppercase tracking-[0.11em] text-faint border-b border-border2",
            className,
        )}
        {...props}
    />
);

const TableCell = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className={cn("px-4 py-3 align-middle text-fg", className)} {...props} />
);

const TableCaption = ({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) => (
    <caption className={cn("mt-4 text-sm text-muted", className)} {...props} />
);

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
