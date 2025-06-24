import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";

type Theme = "light" | "dark" | "system";

export function Settings() {
  const { theme, setTheme } = useTheme();

  const themeOptions = [
    {
      value: "light" as Theme,
      label: "Light",
      icon: Sun,
      description: "Light mode",
    },
    {
      value: "dark" as Theme,
      label: "Dark",
      icon: Moon,
      description: "Dark mode",
    },
    {
      value: "system" as Theme,
      label: "System",
      icon: Monitor,
      description: "Use system preference",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>
              Customize how the application looks and feels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <Label className="text-sm font-medium">Theme</Label>
              <div className="grid grid-cols-3 gap-3">
                {themeOptions.map((option) => {
                  const Icon = option.icon;
                  const isSelected = theme === option.value;

                  return (
                    <Button
                      key={option.value}
                      variant={isSelected ? "default" : "outline"}
                      className={`h-auto p-4 flex flex-col items-center gap-2 ${
                        isSelected ? "ring-2 ring-primary ring-offset-2" : ""
                      }`}
                      onClick={() => setTheme(option.value)}
                    >
                      <Icon className="h-5 w-5" />
                      <div className="text-center">
                        <div className="font-medium">{option.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {option.description}
                        </div>
                      </div>
                    </Button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>About</CardTitle>
            <CardDescription>Information about YAMCP Dashboard</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Version</span>
                <span className="text-sm text-muted-foreground">1.0.0</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Build</span>
                <span className="text-sm text-muted-foreground">
                  {new Date().toLocaleDateString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">Framework</span>
                <span className="text-sm text-muted-foreground">
                  React + Vite
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
