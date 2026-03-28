import { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  Users,
  Eye,
  Heart,
  ArrowUpRight,
  Gamepad2,
  RefreshCw,
  Sparkles,
  Clock,
  AlertCircle,
} from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { dashboardCommands, type GameStats } from "../../services/tauriCommands";

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-800/60 bg-gray-900/70 p-5">
      <div className="flex items-center gap-2.5">
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${color} shadow-sm`}
        >
          <Icon size={18} className="text-white" />
        </div>
        <span className="text-[13px] font-medium text-gray-400">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function formatTimeAgo(isoString: string): string {
  if (!isoString) return "";
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function DashboardPage() {
  const { auth } = useAuthStore();
  const [games, setGames] = useState<GameStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchStats = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const stats = await dashboardCommands.fetchGameStats();
      setGames(stats);
      setLastRefreshed(new Date());
    } catch (e) {
      setError(String(e));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (auth) {
      fetchStats();
    }
  }, [auth, fetchStats]);

  const totalVisits = games.reduce((sum, g) => sum + g.visits, 0);
  const totalPlayers = games.reduce((sum, g) => sum + g.playing, 0);
  const totalFavorites = games.reduce((sum, g) => sum + g.favorites, 0);

  return (
    <div className="flex h-full flex-col bg-gray-950">
      <div className="flex items-center justify-between border-b border-gray-800/40 px-8 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-600/20">
            <BarChart3 size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">My Stats</h1>
            <p className="text-sm text-gray-400">
              {lastRefreshed
                ? `Updated ${formatTimeAgo(lastRefreshed.toISOString())}`
                : "See how your games are doing!"}
            </p>
          </div>
        </div>
        {auth && (
          <button
            onClick={fetchStats}
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl border border-gray-700/50 bg-gray-800/60 px-4 py-2 text-sm text-gray-300 hover:border-gray-600 disabled:opacity-50"
          >
            <RefreshCw
              size={14}
              className={isLoading ? "animate-spin" : ""}
            />
            {isLoading ? "Updating..." : "Refresh"}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {!auth ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-800/60">
              <BarChart3 size={28} className="text-gray-600" />
            </div>
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-300">
                See How Your Games Are Doing
              </h3>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                Log in to Roblox to see how many people are playing your games,
                favorites, visits, and more!
              </p>
              <p className="mt-3 rounded-lg bg-gray-800/40 px-4 py-2 text-xs text-gray-500">
                Go to the Share tab and log in first
              </p>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <AlertCircle size={32} className="text-red-400" />
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-300">
                Couldn't Load Stats
              </h3>
              <p className="mt-1 max-w-md text-sm text-gray-500">{error}</p>
              <button
                onClick={fetchStats}
                className="mt-4 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : games.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20">
            <Gamepad2 size={32} className="text-gray-600" />
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-300">
                No Games Yet
              </h3>
              <p className="mt-1 max-w-md text-sm text-gray-500">
                Build and publish your first game to see stats here!
              </p>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl space-y-6">
            {/* Summary stats */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard
                icon={Eye}
                label="Total Visits"
                value={totalVisits.toLocaleString()}
                color="bg-gradient-to-br from-blue-500 to-blue-600"
              />
              <StatCard
                icon={Users}
                label="Playing Now"
                value={totalPlayers.toString()}
                color="bg-gradient-to-br from-green-500 to-green-600"
              />
              <StatCard
                icon={Gamepad2}
                label="Games"
                value={games.length.toString()}
                color="bg-gradient-to-br from-purple-500 to-purple-600"
              />
              <StatCard
                icon={Heart}
                label="Favorites"
                value={totalFavorites.toLocaleString()}
                color="bg-gradient-to-br from-pink-500 to-pink-600"
              />
            </div>

            {/* Per-game breakdown */}
            <div>
              <h3 className="mb-3 text-[13px] font-bold text-gray-300">
                Your Games
              </h3>
              <div className="space-y-3">
                {games.map((game) => (
                  <div
                    key={game.universe_id}
                    className="rounded-2xl border border-gray-800/60 bg-gray-900/70 p-5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-sm">
                          <Gamepad2 size={20} className="text-white" />
                        </div>
                        <div>
                          <h4 className="font-bold text-white">{game.name}</h4>
                          {game.updated && (
                            <div className="flex items-center gap-1.5 text-xs text-gray-500">
                              <Clock size={11} />
                              Updated {formatTimeAgo(game.updated)}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 rounded-lg bg-green-600/20 px-2.5 py-1 text-xs font-semibold text-green-300">
                        <Users size={12} />
                        {game.playing} playing
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-gray-800/50 px-3 py-2.5">
                        <p className="text-[11px] text-gray-500">Visits</p>
                        <p className="text-sm font-bold text-white">
                          {game.visits.toLocaleString()}
                        </p>
                      </div>
                      <div className="rounded-xl bg-gray-800/50 px-3 py-2.5">
                        <p className="text-[11px] text-gray-500">Playing</p>
                        <p className="text-sm font-bold text-white">
                          {game.playing}
                        </p>
                      </div>
                      <div className="rounded-xl bg-gray-800/50 px-3 py-2.5">
                        <p className="text-[11px] text-gray-500">Favorites</p>
                        <p className="text-sm font-bold text-white">
                          {game.favorites.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Insights */}
            {games.length > 0 && (
              <div className="rounded-2xl border border-indigo-900/40 bg-indigo-950/20 p-5">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-indigo-400" />
                  <h3 className="text-[13px] font-bold text-indigo-300">
                    Quick Insights
                  </h3>
                </div>
                <div className="mt-3 space-y-2.5 text-[13px] text-gray-300">
                  {games
                    .sort((a, b) => b.playing - a.playing)
                    .slice(0, 1)
                    .map((g) => (
                      <p key={g.universe_id}>
                        <ArrowUpRight size={14} className="inline text-green-400 mr-1" />
                        "{g.name}" has the most active players right now ({g.playing}).
                        Keep updating it to maintain momentum!
                      </p>
                    ))}
                  {games.some((g) => g.playing === 0) && (
                    <p>
                      Some of your games have 0 active players. Try sharing them
                      on social media or adding new content to bring players back!
                    </p>
                  )}
                </div>
              </div>
            )}

            <p className="text-center text-xs text-gray-600">
              Stats come from the Roblox API. Robux earnings require the Creator Dashboard.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
