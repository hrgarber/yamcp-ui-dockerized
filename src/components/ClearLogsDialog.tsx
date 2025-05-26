import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Trash2, AlertTriangle, Info } from "lucide-react";

interface ClearLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  logCount: number;
}

export function ClearLogsDialog({
  open,
  onOpenChange,
  onConfirm,
  logCount,
}: ClearLogsDialogProps) {
  const [isClearing, setIsClearing] = useState(false);

  const handleConfirm = async () => {
    setIsClearing(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } finally {
      setIsClearing(false);
    }
  };

  const handleCancel = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Clear Logs
          </DialogTitle>
          <DialogDescription>
            This action will clear all displayed log entries from the current
            view.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              You are about to clear <strong>{logCount}</strong> log{" "}
              {logCount === 1 ? "entry" : "entries"} from the display.
            </AlertDescription>
          </Alert>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> This will only clear the current view.
              The actual log files on disk will remain unchanged and can still
              be downloaded.
            </AlertDescription>
          </Alert>

          <div className="bg-muted p-3 rounded-md">
            <h4 className="text-sm font-medium mb-2">
              What happens when you clear logs:
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Current log display will be emptied</li>
              <li>• Log files on disk remain untouched</li>
              <li>• You can refresh to reload logs from files</li>
              <li>• Downloaded log files are not affected</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleCancel}
            disabled={isClearing}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={isClearing || logCount === 0}
          >
            {isClearing ? (
              <>
                <Trash2 className="mr-2 h-4 w-4 animate-pulse" />
                Clearing...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Clear {logCount} {logCount === 1 ? "Entry" : "Entries"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
