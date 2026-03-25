import { Link, useLocation } from "react-router-dom";
import { Gamepad2, Rocket, Settings, Hammer, BarChart3 } from "lucide-react";

const navItems = [
  { path: "/", icon: Gamepad2, label: "Templates" },
  { path: "/build", icon: Hammer, label: "Build" },
  { path: "/publish", icon: Rocket, label: "Publish" },
  { path: "/dashboard", icon: BarChart3, label: "Dashboard" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex h-full min-h-0 bg-gray-950 text-white">
      {/* Sidebar */}
      <aside className="flex w-16 flex-col items-center border-r border-gray-800 bg-gray-900 py-4">
        <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-600 font-bold text-white">
          RF
        </div>
        <nav className="flex flex-1 flex-col gap-2">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive =
              location.pathname === path ||
              (path !== "/" && location.pathname.startsWith(path));
            return (
              <Link
                key={path}
                to={path}
                className={`flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                  isActive
                    ? "bg-indigo-600 text-white"
                    : "text-gray-400 hover:bg-gray-800 hover:text-white"
                }`}
                title={label}
              >
                <Icon size={20} />
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
