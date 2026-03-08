import { Clock } from "lucide-react";

interface LogEntry {
  id: string;
  admin_name: string;
  action: string;
  details: string;
  created_at: string;
}

interface ActivityLogProps {
  logs: LogEntry[];
}

const ActivityLog = ({ logs }: ActivityLogProps) => {
  return (
    <div className="liquid-glass p-6 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold text-foreground">Activity Log</h2>
      </div>

      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">No activity yet.</p>
      ) : (
        <div className="max-h-[300px] overflow-y-auto space-y-2">
          {logs.map(log => (
            <div key={log.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-secondary/30 transition-colors">
              <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-foreground">{log.details}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {new Date(log.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ActivityLog;
