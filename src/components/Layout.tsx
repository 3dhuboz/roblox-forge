import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Gamepad2, Rocket, Settings, Hammer, BarChart3 } from "lucide-react";

const navItems = [
  { path: "/", icon: Gamepad2, label: "Templates", shortcut: "Ctrl+1" },
  { path: "/build", icon: Hammer, label: "Build", shortcut: "Ctrl+2" },
  { path: "/publish", icon: Rocket, label: "Publish", shortcut: "Ctrl+3" },
  { path: "/dashboard", icon: BarChart3, label: "Dashboard", shortcut: "Ctrl+4" },
  { path: "/settings", icon: Settings, label: "Settings", shortcut: "Ctrl+5" },
];

function NavTooltip({ label, shortcut, visible }: { label: string; shortcut: string; visible: boolean }) {
  if (!visible) return null;
  return (
    <div className="absolute left-14 top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 shadow-xl">
      <p className="text-xs font-medium text-white">{label}</p>
      <p className="text-[10px] text-gray-400">{shortcut}</p>
    </div>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

  return (
    <div className="flex h-full min-h-0 bg-gray-950 text-white">
      {/* Sidebar */}
      <aside className="flex w-16 flex-col items-center border-r border-gray-800 bg-gray-900 py-4">
        <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white text-sm">
          RF
        </div>
        <nav className="flex flex-1 flex-col gap-2">
          {navItems.map(({ path, icon: Icon, label, shortcut }) => {
            const isActive =
              location.pathname === path ||
              (path !== "/" && location.pathname.startsWith(path));
            return (
              <div
                key={path}
                className="relative"
                onMouseEnter={() => setHoveredPath(path)}
                onMouseLeave={() => setHoveredPath(null)}
              >
                <Link
                  to={path}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                    isActive
                      ? "bg-indigo-600 text-white"
                      : "text-gray-400 hover:bg-gray-800 hover:text-white"
                  }`}
                >
                  <Icon size={20} />
                </Link>
                <NavTooltip
                  label={label}
                  shortcut={shortcut}
                  visible={hoveredPath === path}
                />
              </div>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
