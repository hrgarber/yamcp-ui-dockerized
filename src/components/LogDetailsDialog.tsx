import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";
import { Eye, Copy, Check } from "lucide-react";

interface LogEntry {
  id: string;
  timestamp: string;
  level: string;
  server: string;
  message: string;
}

interface LogDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  log: LogEntry | null;
}

export function LogDetailsDialog({
  open,
  onOpenChange,
  log,
}: LogDetailsDialogProps) {
  const [copied, setCopied] = useState(false);
  const [formattedData, setFormattedData] = useState<string>("");

  useEffect(() => {
    if (log) {
      try {
        // Try to parse the message as JSON first
        let parsedMessage;
        try {
          parsedMessage = JSON.parse(log.message);
        } catch (e) {
          // Not JSON, use the raw message
          parsedMessage = log.message;
        }

        // Create the full display data object
        const displayData = {
          id: log.id,
          timestamp: log.timestamp,
          level: log.level,
          server: log.server,
          formattedTimestamp: new Date(log.timestamp).toLocaleString(),
          message: parsedMessage,
        };

        // Format the JSON with indentation
        setFormattedData(JSON.stringify(displayData, null, 2));
      } catch (err) {
        console.error("Error formatting log data:", err);
        setFormattedData(
          JSON.stringify(
            {
              error: "Could not format log data",
              rawData: log,
            },
            null,
            2
          )
        );
      }
    }
  }, [log]);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  if (!log) return null;

  const getLevelBadge = (level: string) => {
    switch (level) {
      case "error":
        return <Badge variant="destructive">Error</Badge>;
      case "warn":
      case "warning":
        return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case "info":
        return <Badge className="bg-blue-100 text-blue-800">Info</Badge>;
      case "debug":
        return <Badge variant="outline">Debug</Badge>;
      default:
        return <Badge variant="outline">{level}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedData);
      setCopied(true);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Log Details
          </DialogTitle>
          <DialogDescription>
            Detailed view of log entry from {log.server}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-4 py-2 border-b">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Level:</span>
            {getLevelBadge(log.level)}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Server:</span>
            <span className="text-sm">{log.server}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Time:</span>
            <span className="text-sm">{formatDate(log.timestamp)}</span>
          </div>
          <div className="ml-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="gap-2"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy JSON
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="flex-1 min-h-[300px] overflow-auto">
          <AceEditor
            mode="json"
            theme="monokai"
            value={formattedData}
            readOnly={true}
            width="100%"
            height="300px"
            fontSize={14}
            showPrintMargin={false}
            showGutter={true}
            highlightActiveLine={false}
            setOptions={{
              enableBasicAutocompletion: false,
              enableLiveAutocompletion: false,
              enableSnippets: false,
              showLineNumbers: true,
              tabSize: 2,
              useWorker: false,
            }}
            style={{
              borderRadius: "6px",
              border: "1px solid hsl(var(--border))",
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
