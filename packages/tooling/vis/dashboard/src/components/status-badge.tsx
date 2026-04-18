import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
    status: "HIT" | "MISS" | "REMOTE_HIT" | "SKIPPED" | string;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
    switch (status) {
        case "HIT": {
            return <Badge variant="success">cache hit</Badge>;
        }

        case "REMOTE_HIT": {
            return <Badge variant="remote">remote hit</Badge>;
        }

        case "MISS": {
            return <Badge variant="warning">miss</Badge>;
        }

        case "SKIPPED": {
            return <Badge variant="secondary">skipped</Badge>;
        }

        default: {
            return <Badge variant="outline">{status}</Badge>;
        }
    }
};
