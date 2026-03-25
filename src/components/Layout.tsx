import { Link, useLocation } from "react-router-dom";
import { Gamepad2, Rocket, Settings, Hammer, BarChart3 } from "lucide-react";

const navItems = [
  { path: "/", icon: Gamepad2, label: "Create" },
  { path: "/build", icon: Hammer, label: "Build" },
  { path: "/publish", icon: Rocket, label: "Share" },
  { path: "/dashboard", icon: BarChart3, label: "Stats" },
  { path: "/settings", icon: Settings, label: "Settings" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex h-full min-h-0 bg-gray-950 text-white">
      {/* Sidebar */}
      <aside className="flex w-[72px] flex-col items-center border-r border-gray-800/60 bg-gray-900/80 py-3">
        <div className="mb-6 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-xs font-black text-white shadow-lg shadow-indigo-500/20">
          RF
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {navItems.map(({ path, icon: Icon, label }) => {
            const isActive =
              location.pathname === path ||
              (path !== "/" && location.pathname.startsWith(path));
            return (
              <Link
                key={path}
                to={path}
                className={`group flex w-14 flex-col items-center gap-0.5 rounded-xl px-1 py-2 transition-all ${
                  isActive
                    ? "bg-indigo-600/20 text-indigo-300"
                    : "text-gray-500 hover:bg-gray-800/60 hover:text-gray-300"
                }`}
              >
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                <span className={`text-[9px] font-medium leading-none ${isActive ? "text-indigo-300" : "text-gray-500 group-hover:text-gray-400"}`}>
                  {label}
                </span>
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
