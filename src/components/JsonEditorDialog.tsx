import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Alert, AlertDescription } from "./ui/alert";
import { AlertCircle, Save, X } from "lucide-react";
import AceEditor from "react-ace";

// Import ace editor modes and themes
import "ace-builds/src-noconflict/mode-json";
import "ace-builds/src-noconflict/theme-monokai";
import "ace-builds/src-noconflict/ext-language_tools";

interface JsonEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  endpoint: string;
  onSaved?: () => void;
}

export function JsonEditorDialog({
  open,
  onOpenChange,
  title,
  description,
  endpoint,
  onSaved,
}: JsonEditorDialogProps) {
  const [jsonContent, setJsonContent] = useState("");
  const [originalContent, setOriginalContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load JSON content when dialog opens
  useEffect(() => {
    if (open) {
      loadJsonContent();
    }
  }, [open, endpoint]);

  const loadJsonContent = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        const formatted = JSON.stringify(data, null, 2);
        setJsonContent(formatted);
        setOriginalContent(formatted);
      } else {
        setError("Failed to load JSON content");
      }
    } catch (err) {
      setError("Error loading JSON content");
      console.error("Error loading JSON:", err);
    } finally {
      setLoading(false);
    }
  };

  const validateJson = (content: string): boolean => {
    try {
      JSON.parse(content);
      setValidationError(null);
      return true;
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Invalid JSON");
      return false;
    }
  };

  const handleContentChange = (value: string) => {
    setJsonContent(value);
    validateJson(value);
  };

  const handleSave = async () => {
    if (!validateJson(jsonContent)) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const parsedContent = JSON.parse(jsonContent);
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(parsedContent),
      });

      if (response.ok) {
        setOriginalContent(jsonContent);
        onSaved?.();
        onOpenChange(false);
      } else {
        const errorData = (await response.json()) as { error?: string };
        setError(errorData.error || "Failed to save JSON content");
      }
    } catch (err) {
      setError("Error saving JSON content");
      console.error("Error saving JSON:", err);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setJsonContent(originalContent);
    setValidationError(null);
    setError(null);
    onOpenChange(false);
  };

  const hasChanges = jsonContent !== originalContent;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl w-[90vw] h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {validationError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                JSON Validation Error: {validationError}
              </AlertDescription>
            </Alert>
          )}

          <div className="flex-1 min-h-0">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-muted-foreground">
                  Loading JSON content...
                </div>
              </div>
            ) : (
              <div className="h-full border rounded-md overflow-hidden">
                <AceEditor
                  mode="json"
                  theme="monokai"
                  value={jsonContent}
                  onChange={handleContentChange}
                  name="json-editor"
                  editorProps={{ $blockScrolling: true }}
                  width="100%"
                  height="100%"
                  fontSize={14}
                  showPrintMargin={false}
                  showGutter={true}
                  highlightActiveLine={true}
                  setOptions={{
                    enableBasicAutocompletion: true,
                    enableLiveAutocompletion: true,
                    enableSnippets: false,
                    showLineNumbers: true,
                    tabSize: 2,
                    useWorker: false,
                  }}
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <div>
              {hasChanges && (
                <span className="text-orange-600 dark:text-orange-400">
                  • Unsaved changes
                </span>
              )}
            </div>
            <div>
              Lines: {jsonContent.split("\n").length} | Characters:{" "}
              {jsonContent.length}
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={handleCancel}>
            <X className="h-4 w-4 mr-2" />
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving || !!validationError || !hasChanges}
          >
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
