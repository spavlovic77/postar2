import { Badge } from "@/components/ui/badge";
import type { IonApStatus } from "@/lib/types";

const STATUS_STYLES = {
  pending: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  error: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const STATUS_LABELS = {
  pending: "Not registered",
  active: "Active",
  error: "Error",
};

export function PeppolStatusBadge({ status }: { status: IonApStatus }) {
  return (
    <Badge className={STATUS_STYLES[status]}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}
