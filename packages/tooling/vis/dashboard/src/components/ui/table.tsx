import * as React from "react";

import { cn } from "@/lib/utils";

const Table = ({ className, ...props }: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="relative w-full overflow-auto">
        <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
);

const TableHeader = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <thead className={cn("[&_tr]:border-b", className)} {...props} />
);

const TableBody = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <tbody className={cn("[&_tr:last-child]:border-0", className)} {...props} />
);

const TableFooter = ({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) => (
    <tfoot className={cn("border-t bg-muted/50 font-medium [&>tr]:last:border-b-0", className)} {...props} />
);

const TableRow = ({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) => (
    <tr
        className={cn(
            "border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted",
            className,
        )}
        {...props}
    />
);

const TableHead = ({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) => (
    <th
        className={cn(
            "h-9 px-3 text-left align-middle text-xs font-medium uppercase tracking-wider text-muted-foreground",
            className,
        )}
        {...props}
    />
);

const TableCell = ({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) => (
    <td className={cn("px-3 py-2 align-middle", className)} {...props} />
);

const TableCaption = ({ className, ...props }: React.HTMLAttributes<HTMLTableCaptionElement>) => (
    <caption className={cn("mt-4 text-sm text-muted-foreground", className)} {...props} />
);

export { Table, TableBody, TableCaption, TableCell, TableFooter, TableHead, TableHeader, TableRow };
