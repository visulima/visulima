import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
    status: "HIT" | "MISS" | "REMOTE_HIT" | "SKIPPED" | string;
}

export const StatusBadge = ({ status }: StatusBadgeProps) => {
    switch (status) {
        case "HIT": {
            return <Badge variant="success">HIT</Badge>;
        }

        case "REMOTE_HIT": {
            return <Badge variant="info">REMOTE</Badge>;
        }

        case "MISS": {
            return <Badge variant="warning">MISS</Badge>;
        }

        case "SKIPPED": {
            return <Badge variant="secondary">SKIP</Badge>;
        }

        default: {
            return <Badge variant="outline">{status.toUpperCase()}</Badge>;
        }
    }
};
