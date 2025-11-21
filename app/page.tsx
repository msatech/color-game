"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export type Color = "GREEN" | "RED" | "VIOLET";

const PRESET_AMOUNTS = [10, 100, 500, 1000];

interface Bet {
  id: number;
  roundId: number;
  // playerName is not guaranteed from backend, so optional
  playerName?: string;
  color: Color;
  number: number | null;
  amount: number;
  isWinner?: boolean | null;
  multiplier?: number | null;
}

interface RoundData {
  id: number;
  remainingSeconds: number;
  duration: number;
  bets: Bet[];
}

interface LastRoundData {
  id: number;
  winningColor: Color | null;
  winningNumber: number | null;
  bets: Bet[];
}

interface ApiGameResponse {
  round: RoundData;
  lastRound: LastRoundData | null;
}

interface HistoryResponse {
  userBets?: Bet[];
  rounds?: {
    roundId: number;
    winningColor: Color | null;
    winningNumber: number | null;
    bets: Bet[];
  }[];
  error?: string;
}

type BetStatus = "AWAITING" | "WIN" | "LOSE";

interface PlacedBetState {
  roundId: number;
  playerName: string;
  color: Color;
  number: number | null;
  amount: number;
  status: BetStatus;
  multiplier?: number | null;
}

function colorDot(color: Color | null | undefined) {
  if (!color) return "•";
  return color === "GREEN" ? "🟢" : color === "RED" ? "🔴" : "🟣";
}

export default function HomePage() {
  const router = useRouter();

  const [user, setUser] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);

  const [round, setRound] = useState<RoundData | null>(null);
  const [lastRound, setLastRound] = useState<LastRoundData | null>(null);
  const [remaining, setRemaining] = useState<number>(0);

  const [allUserBets, setAllUserBets] = useState<Bet[]>([]);
  const [allRounds, setAllRounds] = useState<
    { roundId: number; winningColor: Color | null; winningNumber: number | null }[]
  >([]);

  const [selectedColor, setSelectedColor] = useState<Color | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [baseAmount, setBaseAmount] = useState<number>(10);
  const [multi, setMulti] = useState<number>(1);

  const [loadingBet, setLoadingBet] = useState(false);
  const [placedBet, setPlacedBet] = useState<PlacedBetState | null>(null);

  const [winCredited, setWinCredited] = useState(false);
  const [showWinAnimation, setShowWinAnimation] = useState(false);

  const amount = baseAmount * multi;

  // Load username once
  useEffect(() => {
    const stored =
      typeof window !== "undefined"
        ? window.localStorage.getItem("username")
        : null;

    if (!stored) {
      router.push("/login");
    } else {
      setUser(stored);
    }
  }, [router]);

  // Refresh balance from backend
  const refreshBalance = useCallback(async (username: string) => {
    try {
      const res = await fetch("/api/user/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (res.ok && typeof data.balance === "number") {
        setBalance(data.balance);
      }
    } catch (err) {
      console.error("Failed to load balance", err);
    }
  }, []);

  // Load balance when user changes
  useEffect(() => {
    if (!user) return;
    refreshBalance(user);
  }, [user, refreshBalance]);

  // Load history
  const loadHistory = useCallback(async (username: string) => {
    if (!username) return;
    try {
      const res = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data: HistoryResponse = await res.json();

      if (!res.ok || data.error) {
        console.error("History error:", data);
        setAllUserBets([]);
        setAllRounds([]);
        return;
      }

      const safeUserBets = Array.isArray(data.userBets) ? data.userBets : [];
      const safeRounds = Array.isArray(data.rounds) ? data.rounds : [];

      setAllUserBets(safeUserBets);
      setAllRounds(
        safeRounds.map((r) => ({
          roundId: r.roundId,
          winningColor: r.winningColor,
          winningNumber: r.winningNumber,
        }))
      );
    } catch (err) {
      console.error("Failed to load history", err);
      setAllUserBets([]);
      setAllRounds([]);
    }
  }, []);

  // Game state sync + timer + periodic balance refresh
  useEffect(() => {
    if (!user) return;

    let syncId: NodeJS.Timeout | null = null;
    let tickId: NodeJS.Timeout | null = null;

    const sync = async () => {
      try {
        const res = await fetch("/api/game");
        const data: ApiGameResponse = await res.json();

        if (!res.ok || !data?.round) {
          console.error("Game API error:", data);
          return;
        }

        setRound(data.round);
        setLastRound(data.lastRound);
        setRemaining(data.round.remainingSeconds);

        loadHistory(user);

        // If round changed, allow new bet & reset win flag
        if (placedBet && placedBet.roundId !== data.round.id) {
          setPlacedBet(null);
          setWinCredited(false);
        }

        // If we have a result for our bet in last round
        if (placedBet && data.lastRound && data.lastRound.id === placedBet.roundId) {
          const match = data.lastRound.bets.find((b) => {
            // backend bets may not have playerName; match by color/amount/number
            return (
              b.color === placedBet.color &&
              b.amount === placedBet.amount &&
              (placedBet.number === null || b.number === placedBet.number)
            );
          });

          if (match && match.isWinner !== undefined && match.isWinner !== null) {
            setPlacedBet({
              ...placedBet,
              status: match.isWinner ? "WIN" : "LOSE",
              multiplier: match.multiplier,
            });
          }
        }
      } catch (err) {
        console.error("Game sync error:", err);
      }
    };

    const syncAll = async () => {
      await sync();
      // keep balance fresh too
      await refreshBalance(user);
    };

    syncAll();

    syncId = setInterval(syncAll, 3000);
    tickId = setInterval(() => {
      setRemaining((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      if (syncId) clearInterval(syncId);
      if (tickId) clearInterval(tickId);
    };
  }, [user, placedBet, loadHistory, refreshBalance]);

  // Win animation + one-time credit awareness
  useEffect(() => {
    if (!placedBet || placedBet.status !== "WIN" || winCredited || !user) return;

    const winAmount = placedBet.amount * (placedBet.multiplier ?? 2);

    setWinCredited(true);
    setShowWinAnimation(true);

    toast.success(`You win ₹${winAmount}!`);

    refreshBalance(user);

    const timeoutId = setTimeout(() => setShowWinAnimation(false), 3500);
    return () => clearTimeout(timeoutId);
  }, [placedBet, winCredited, user, refreshBalance]);

  const placeBet = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (!round) return;
    if (!selectedColor) {
      toast.warning("Select a color first");
      return;
    }
    if (placedBet && placedBet.roundId === round.id) {
      toast.error("You already placed a bet this round");
      return;
    }
    if (remaining <= 0) {
      toast.error("Betting closed for this round");
      return;
    }

    setLoadingBet(true);
    try {
      const res = await fetch("/api/game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerName: user,
          color: selectedColor,
          amount,
          number: selectedNumber,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Bet failed");
        return;
      }

      // Optimistic local balance decrement
      setBalance((prev) => prev - amount);

      setPlacedBet({
        roundId: data.roundId ?? round.id,
        playerName: user,
        color: selectedColor,
        number: selectedNumber,
        amount,
        status: "AWAITING",
      });

      toast.success("Bet placed!");
    } catch (err) {
      console.error("Place bet error:", err);
      toast.error("Failed to place bet");
    } finally {
      setLoadingBet(false);
    }
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, "0");
    const sec = (s % 60).toString().padStart(2, "0");
    return `${m}:${sec}`;
  };

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("username");
    }
    setUser(null);
    router.push("/login");
  };

  if (!round) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050816] text-muted-foreground">
        Loading game…
      </div>
    );
  }

  const betDisabled =
    loadingBet ||
    remaining <= 0 ||
    (placedBet && placedBet.roundId === round.id);

  return (
    <div className="min-h-screen bg-[#050816] text-slate-100 pb-6 relative">
      {/* Win Overlay */}
      {showWinAnimation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="rounded-3xl border border-yellow-300/40 bg-gradient-to-b from-yellow-400/30 to-transparent px-10 py-8 shadow-[0_0_60px_rgba(250,204,21,0.7)]">
            <p className="text-4xl md:text-5xl font-extrabold text-yellow-300 animate-pulse text-center">
              🎉 JACKPOT! 🎉
            </p>
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto px-3 pt-3 space-y-4">
        {/* Top Nav */}
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
              Color Game
            </span>
            <h1 className="text-lg font-semibold text-slate-50">
              3-Minute Color Game
            </h1>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-8 px-3 border-slate-600 bg-black/40 text-xs"
              onClick={() => router.push("/profile")}
            >
              Profile
            </Button>
            <Button
              variant="outline"
              className="h-8 px-3 border-red-500/60 text-xs text-red-300 hover:bg-red-500/10"
              onClick={handleLogout}
            >
              Logout
            </Button>
          </div>
        </div>

        {/* Balance Card */}
        <Card className="relative overflow-hidden border border-purple-500/40 bg-gradient-to-br from-purple-900/70 via-slate-900 to-slate-950 shadow-[0_0_40px_rgba(139,92,246,0.35)]">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-purple-500/20 blur-3xl" />
          <div className="p-4 flex items-center justify-between relative z-10">
            <div>
              <p className="text-[11px] uppercase tracking-[0.25em] text-slate-300/80">
                Wallet Balance
              </p>
              <p className="mt-1 text-3xl font-bold text-emerald-300 drop-shadow-sm">
                ₹{balance.toLocaleString("en-IN")}
              </p>
              {user && (
                <p className="mt-1 text-[11px] text-slate-300/80">
                  Player: <span className="font-semibold">{user}</span>
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <Button
                size="sm"
                className="bg-emerald-500/90 hover:bg-emerald-400 text-black text-xs shadow-[0_0_20px_rgba(16,185,129,0.7)]"
                onClick={() => toast.info("Withdraw logic not wired yet")}
              >
                Withdraw
              </Button>
              <Button
                size="sm"
                className="bg-pink-500/90 hover:bg-pink-400 text-black text-xs shadow-[0_0_20px_rgba(236,72,153,0.7)]"
                onClick={() => router.push("/profile")}
              >
                Recharge
              </Button>
            </div>
          </div>
        </Card>

        {/* Round & Timer */}
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="border border-slate-700/70 bg-slate-900/80">
            <div className="p-4">
              <p className="text-xs text-slate-400 uppercase tracking-[0.2em]">
                Period
              </p>
              <p className="mt-1 text-2xl font-semibold text-gray-100">{round.id}</p>
              <p className="mt-1 text-[11px] text-slate-300">
                Place your bets before the timer hits zero.
              </p>
            </div>
          </Card>

          <Card className="border border-emerald-500/40 bg-gradient-to-br from-emerald-900/70 via-slate-900 to-slate-950">
            <div className="p-4 flex items-center justify-between">
              <div>
                <p className="text-xs text-emerald-200 uppercase tracking-[0.2em]">
                  Countdown
                </p>
                <p className="mt-1 text-2xl font-bold text-emerald-300">
                  {formatTime(remaining)}
                </p>
              </div>
              <div className="text-right text-[11px] text-emerald-100/80">
                <p>
                  Bets close when timer reaches{" "}
                  <span className="font-semibold">00:00</span>.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Betting Panel */}
        <Card className="border border-slate-700/80 bg-slate-900/90 backdrop-blur-sm">
          <div className="p-4 space-y-4">
            {/* Colors */}
            <div className="flex gap-2">
              {(["GREEN", "VIOLET", "RED"] as Color[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedColor(c)}
                  className={`flex-1 py-3 rounded-2xl text-white font-semibold text-sm shadow-md transition-transform ${
                    c === "GREEN"
                      ? "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-[0_0_25px_rgba(16,185,129,0.7)]"
                      : c === "RED"
                      ? "bg-gradient-to-br from-rose-500 to-red-600 shadow-[0_0_25px_rgba(248,113,113,0.7)]"
                      : "bg-gradient-to-br from-violet-500 to-fuchsia-600 shadow-[0_0_25px_rgba(168,85,247,0.7)]"
                  } ${
                    selectedColor === c
                      ? "ring-2 ring-yellow-300 scale-[1.03]"
                      : "opacity-90 hover:scale-[1.02]"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl">{colorDot(c)}</span>
                    <span className="uppercase tracking-wide text-xs">
                      {c}
                    </span>
                  </div>
                </button>
              ))}
            </div>

            {/* Amount presets */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-slate-300">Bet amount</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {PRESET_AMOUNTS.map((v) => (
                  <button
                    key={v}
                    onClick={() => setBaseAmount(v)}
                    className={`px-3 py-1 rounded-full border text-xs uppercase tracking-wide ${
                      baseAmount === v
                        ? "bg-emerald-500 text-black border-emerald-400 shadow-[0_0_18px_rgba(16,185,129,0.8)]"
                        : "bg-slate-900 text-slate-100 border-slate-600 hover:bg-slate-800"
                    }`}
                  >
                    ₹{v}
                  </button>
                ))}
              </div>
            </div>

            {/* Multiplier & Total */}
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-slate-600 bg-slate-900/80"
                  onClick={() => setMulti((m) => Math.max(1, m - 1))}
                >
                  -
                </Button>
                <div className="text-sm">
                  <p className="text-[11px] text-slate-400">Multiplier</p>
                  <p className="font-semibold text-slate-100">x {multi}</p>
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 border-slate-600 bg-slate-900/80"
                  onClick={() => setMulti((m) => m + 1)}
                >
                  +
                </Button>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-slate-400">Total Stake</p>
                <p className="text-lg font-semibold text-emerald-300">
                  ₹{amount}
                </p>
              </div>
            </div>

            {/* Number Picker */}
            <div>
              <p className="text-[11px] text-slate-400 mb-1">
                Optional Number (0–4 gives 4× if correct)
              </p>
              <div className="grid grid-cols-5 gap-2">
                {Array.from({ length: 10 }, (_, i) => i).map((n) => {
                  const disabled = n > 10;
                  const active = selectedNumber === n;
                  const bg =
                    n % 3 === 0
                      ? "from-rose-500 to-red-600"
                      : n % 2 === 0
                      ? "from-emerald-500 to-emerald-600"
                      : "from-violet-500 to-fuchsia-600";

                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={disabled}
                      className={`rounded-2xl py-3 text-center text-white font-bold text-sm bg-gradient-to-br ${bg} ${
                        disabled
                          ? "opacity-30 cursor-not-allowed"
                          : "shadow-md hover:scale-[1.02]"
                      } ${
                        active ? "ring-2 ring-yellow-300 scale-[1.03]" : ""
                      }`}
                      onClick={() => {
                        if (disabled) return;
                        setSelectedNumber(active ? null : n);
                      }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>

            <Button
              className="w-full mt-2 bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.7)]"
              onClick={placeBet}
            >
              {loadingBet
                ? "Placing..."
                : remaining <= 0
                ? "Betting Closed"
                : placedBet && placedBet.roundId === round.id
                ? "Bet already placed"
                : "Place Bet"}
            </Button>
          </div>
        </Card>

        {/* Current Bet */}
        {placedBet && (
          <Card className="border border-slate-700 bg-slate-900/90">
            <div className="p-4">
              <p className="font-semibold mb-2 text-sm text-slate-100">
                Current Bet
              </p>
              <div className="flex justify-between text-xs md:text-sm">
                <div>
                  <p className="text-[11px] text-slate-400">Amount</p>
                  <p className="font-semibold">₹{placedBet.amount}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Color</p>
                  <p className="text-lg">{colorDot(placedBet.color)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400">Number</p>
                  <p className="font-semibold">
                    {placedBet.number !== null ? placedBet.number : "-"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] text-slate-400">Status</p>
                  {placedBet.status === "AWAITING" && (
                    <p className="text-amber-400 text-xs font-semibold">
                      Awaiting result
                    </p>
                  )}
                  {placedBet.status === "WIN" && (
                    <p className="text-emerald-400 text-xs font-semibold">
                      WIN {placedBet.multiplier ? `x${placedBet.multiplier}` : ""}
                    </p>
                  )}
                  {placedBet.status === "LOSE" && (
                    <p className="text-red-400 text-xs font-semibold">LOSE</p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Last Round Snapshot */}
        <Card className="border border-slate-700 bg-slate-900/90">
          <div className="p-4 flex justify-between items-center text-gray-100">
            <div>
              <p className="text-xs text-slate-100 uppercase tracking-[0.2em]">
                Last Result
              </p>
              {lastRound ? (
                <>
                  <p className="mt-1 text-sm font-semibold">
                    Round {lastRound.id}
                  </p>
                  <p className="text-[11px] text-slate-100">
                    Number: {lastRound.winningNumber ?? "-"}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-slate-400">
                  No completed rounds yet.
                </p>
              )}
            </div>
            <div className="text-3xl">
              {lastRound ? colorDot(lastRound.winningColor) : "•"}
            </div>
          </div>
        </Card>

        {/* User Bet History */}
        <Card className="border border-slate-700 bg-slate-900/90 max-h-64 overflow-auto text-gray-100">
          <div className="p-4">
            <p className="font-semibold mb-2 text-sm text-slate-100">
              Your Bet History
            </p>
            {allUserBets.length === 0 ? (
              <p className="text-sm text-slate-500">No bets yet.</p>
            ) : (
              allUserBets.map((b) => (
                <div
                  key={b.id}
                  className="border-b border-slate-800 py-1.5 flex justify-between text-xs md:text-sm"
                >
                  <div className="pr-2">
                    <p>
                      Round <b>{b.roundId}</b> — ₹{b.amount} on{" "}
                      {colorDot(b.color)}
                      {b.number !== null ? ` & ${b.number}` : ""}
                    </p>
                    {b.multiplier ? (
                      <p className="text-[10px] text-slate-400">
                        Multiplier: x{b.multiplier}
                      </p>
                    ) : null}
                  </div>
                  <span
                    className={`font-bold ${
                      b.isWinner
                        ? "text-emerald-400"
                        : b.isWinner === false
                        ? "text-red-400"
                        : "text-amber-400"
                    }`}
                  >
                    {b.isWinner
                      ? "WIN"
                      : b.isWinner === false
                      ? "LOSE"
                      : "PENDING"}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* All Round Results */}
        <Card className="border border-slate-700 bg-slate-900/90 max-h-64 overflow-auto">
          <div className="p-4">
            <p className="font-semibold mb-2 text-sm text-slate-100">
              All Round Results
            </p>
            {allRounds.length === 0 ? (
              <p className="text-sm text-slate-500">No results yet.</p>
            ) : (
              allRounds.map((r) => (
                <div
                  key={r.roundId}
                  className="border-b border-slate-800 py-1.5 flex justify-between text-xs md:text-sm text-gray-200"
                >
                  <div>
                    <p className="font-semibold">Round {r.roundId}</p>
                    <p className="text-[11px] text-slate-400">
                      Number: {r.winningNumber ?? "-"}
                    </p>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="text-2xl">
                      {r.winningColor ? colorDot(r.winningColor) : "•"}
                    </span>
                    {!r.winningColor && (
                      <span className="text-[10px] text-amber-400">
                        Pending
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
