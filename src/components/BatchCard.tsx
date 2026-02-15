import { motion } from "framer-motion";
import { Trash2, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Assignment {
  id: string;
  roll_number: string;
  hall_number: string;
}

interface BatchCardProps {
  batchId: string;
  name: string;
  scheduledAt: string | null;
  assignments: Assignment[];
  onDeleteBatch: (batchId: string) => void;
  deleting: boolean;
}

const BatchCard = ({ batchId, name, scheduledAt, assignments, onDeleteBatch, deleting }: BatchCardProps) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="border border-border rounded-xl overflow-hidden flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-secondary/30 border-b border-border/50">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{name}</h3>
          {scheduledAt && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <CalendarClock className="w-3 h-3" />
              Scheduled: {new Date(scheduledAt).toLocaleString()}
            </p>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{assignments.length} entries</span>
      </div>

      {/* Table */}
      <div className="max-h-[300px] overflow-y-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">#</TableHead>
              <TableHead>Roll Number</TableHead>
              <TableHead>Hall</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {assignments.map((a, i) => (
              <TableRow key={a.id}>
                <TableCell className="text-muted-foreground text-xs">{i + 1}</TableCell>
                <TableCell className="font-medium">{a.roll_number}</TableCell>
                <TableCell>{a.hall_number}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete batch */}
      <div className="px-4 py-3 border-t border-border/50 bg-secondary/10">
        <Button
          variant="destructive"
          size="sm"
          className="w-full"
          onClick={() => onDeleteBatch(batchId)}
          disabled={deleting}
        >
          <Trash2 className="w-4 h-4 mr-1.5" />
          {deleting ? "Deleting…" : "Delete Entire Batch"}
        </Button>
      </div>
    </motion.div>
  );
};

export default BatchCard;
