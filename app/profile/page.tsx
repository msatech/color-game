"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Recharge {
  id: number;
  trn: string;
  amount: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const [username, setUsername] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [trn, setTrn] = useState("");
  const [recharges, setRecharges] = useState<Recharge[]>([]);
  const [loading, setLoading] = useState(false);

  // QR modal visibility
  const [showQR, setShowQR] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("username");
    if (!stored) {
      router.push("/login");
    } else {
      setUsername(stored);
      fetchRecharges(stored);
    }
  }, [router]);

  const fetchRecharges = async (user: string) => {
    try {
      const res = await fetch(
        `/api/recharge?username=${encodeURIComponent(user)}`
      );
      const data = await res.json();
      setRecharges(Array.isArray(data.recharges) ? data.recharges : []);
    } catch (err) {
      console.error(err);
    }
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username) return;

    if (!amount || !trn) {
      toast.error("Enter amount & TRN");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/recharge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, amount, trn }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Recharge failed");
        return;
      }

      toast.success("Recharge submitted. Waiting for admin approval.");
      setAmount("");
      setTrn("");
      fetchRecharges(username);
    } catch (err) {
      console.error(err);
      toast.error("Recharge error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050816] text-slate-100 py-6">
      <div className="max-w-md mx-auto px-4 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold tracking-wide text-slate-100">
            Profile
          </h1>
          <Button
            variant="outline"
            className="border-slate-600 bg-black/40 text-xs text-slate-200 hover:bg-slate-800"
            onClick={() => router.push("/")}
          >
            Back to Game
          </Button>
        </div>

        {/* User Info */}
        <Card className="p-4 border border-purple-500/40 bg-gradient-to-br from-purple-900/40 to-slate-900 shadow-md">
          <p className="text-sm text-slate-300">
            Logged in as:{" "}
            <span className="font-semibold text-white">{username}</span>
          </p>
        </Card>

        {/* QR + Form */}
        <Card className="p-5 border border-slate-700/50 bg-slate-900/80 shadow-xl">
          <h2 className="text-lg font-semibold mb-3 text-slate-100">
            Add Money / Recharge
          </h2>

          <div className="flex gap-4 items-center">
            <button
              className="p-2 rounded-xl border border-slate-600 bg-black/30 hover:scale-105 transition"
              onClick={() => setShowQR(true)}
            >
              <Image
                src="/paymentqr.png"
                alt="Payment QR"
                width={150}
                height={150}
                className="rounded-md"
              />
            </button>

            <p className="text-xs text-slate-300 leading-relaxed">
              Scan the QR to make payment, then enter{" "}
              <span className="text-slate-200 font-semibold">TRN number</span> &
              <span className="text-slate-200 font-semibold"> Amount</span>.
              <br />
              Recharge stays{" "}
              <span className="text-amber-400 font-semibold">Pending</span>{" "}
              until approved.
            </p>
          </div>

          {/* Recharge Modal (Full Screen QR) */}
          {showQR && (
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[999]"
              onClick={() => setShowQR(false)}
            >
              <div
                className="relative p-4"
                onClick={(e) => e.stopPropagation()}
              >
                <Image
                  src="/paymentqr.png"
                  alt="QR Fullscreen"
                  width={380}
                  height={380}
                  className="rounded-xl shadow-[0_0_40px_rgba(255,255,255,0.25)]"
                />
                <button
                  className="absolute top-2 right-2 bg-white/20 text-white px-3 py-1 text-xs rounded hover:bg-white/30"
                  onClick={() => setShowQR(false)}
                >
                  Close ✕
                </button>
              </div>
            </div>
          )}

          {/* Form */}
          <form className="mt-5 space-y-3" onSubmit={onSubmit}>
            <div>
              <label className="text-sm font-medium text-slate-300">
                Amount
              </label>
              <Input
                type="number"
                className="bg-slate-800 border-slate-600 text-white"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-slate-300">
                TRN Number
              </label>
              <Input
                className="bg-slate-800 border-slate-600 text-white"
                value={trn}
                onChange={(e) => setTrn(e.target.value)}
              />
            </div>

            <Button
              className="w-full bg-emerald-500 text-black hover:bg-emerald-400 shadow-lg"
              type="submit"
              disabled={loading}
            >
              {loading ? "Submitting..." : "Submit Recharge"}
            </Button>
          </form>
        </Card>

        {/* Recharge History */}
        <Card className="p-4 border border-slate-700 bg-slate-900/80 max-h-72 overflow-auto shadow-lg">
          <h2 className="text-sm font-semibold text-slate-200 mb-3">
            Recharge History
          </h2>

          {recharges.length === 0 ? (
            <p className="text-xs text-slate-500">No recharge requests yet.</p>
          ) : (
            <div className="space-y-3">
              {recharges.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between border-b border-slate-800 pb-2"
                >
                  <div>
                    <p className="font-semibold text-slate-100">
                      ₹{r.amount}
                    </p>
                    <p className="text-[11px] text-slate-400">TRN: {r.trn}</p>
                  </div>

                  <div className="text-right">
                    <p
                      className={`font-semibold text-xs ${
                        r.status === "PENDING"
                          ? "text-amber-400"
                          : r.status === "APPROVED"
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {r.status}
                    </p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(r.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
