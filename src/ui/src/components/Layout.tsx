import React from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Server,
  FolderOpen,
  FileText,
  Settings,
  Menu,
} from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Servers", href: "/servers", icon: Server },
  { name: "Workspaces", href: "/workspaces", icon: FolderOpen },
  { name: "Logs", href: "/logs", icon: FileText },
];

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          sidebarOpen ? "block" : "hidden"
        )}
      >
        <div
          className="fixed inset-0 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
        <div className="fixed left-0 top-0 h-full w-64 bg-card border-r">
          <SidebarContent location={location} />
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-card border-r">
          <SidebarContent location={location} />
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between p-4 border-b bg-card">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>
          <h1 className="text-xl font-semibold">YAMCP Dashboard</h1>
          <div className="w-10" /> {/* Spacer */}
        </div>

        {/* Page content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}

function SidebarContent({ location }: { location: any }) {
  return (
    <div className="flex flex-col h-full">
      {/* Logo/Header */}
      <div className="flex items-center px-6 py-4 border-b">
        <h1 className="text-xl font-bold text-primary">YAMCP</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <Link
              key={item.name}
              to={item.href}
              className={cn(
                "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="mr-3 h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-4 py-4 border-t">
        <Button variant="ghost" size="sm" className="w-full justify-start">
          <Settings className="mr-3 h-4 w-4" />
          Settings
        </Button>
      </div>
    </div>
  );
}
