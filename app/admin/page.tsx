"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface Recharge {
  id: number;
  amount: number;
  trn: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  createdAt: string;
  user: {
    id: number;
    username: string;
  };
}

export default function AdminRechargesPage() {
  const router = useRouter();
  const [recharges, setRecharges] = useState<Recharge[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchPending = async () => {
    const res = await fetch("/api/recharge?status=PENDING");
    const data = await res.json();
    setRecharges(data.recharges || []);
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const approve = async (id: number) => {
    setLoading(true);
    try {
      const res = await fetch("/api/recharge/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to approve");
        return;
      }
      alert("Recharge approved & balance updated.");
      fetchPending();
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
            Admin – Pending Recharges
          </h1>
          <Button
            variant="outline"
            className="border-slate-600 bg-black/40 text-xs text-slate-200 hover:bg-slate-800"
            onClick={() => router.push("/")}
          >
            Back to Game
          </Button>
        </div>

        {/* Pending List */}
        <Card className="p-5 border border-slate-700/60 bg-slate-900/80 shadow-lg">
          {recharges.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">
              No pending recharge requests.
            </p>
          ) : (
            <div className="space-y-4 max-h-[450px] overflow-auto">
              {recharges.map((r) => (
                <div
                  key={r.id}
                  className="p-3 rounded-lg bg-black/30 border border-slate-700 hover:border-slate-500 transition"
                >
                  <div className="flex justify-between items-start">
                    {/* User & Recharge Info */}
                    <div>
                      <p className="text-sm font-semibold text-slate-100">
                        {r.user.username}
                      </p>
                      <p className="text-slate-300 text-xs mt-1">
                        Amount:{" "}
                        <span className="font-bold text-emerald-400">
                          ₹{r.amount}
                        </span>
                      </p>
                      <p className="text-xs text-slate-400">
                        TRN: {r.trn}
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">
                        {new Date(r.createdAt).toLocaleString()}
                      </p>
                    </div>

                    {/* Approve button */}
                    <Button
                      size="sm"
                      className="bg-emerald-500 text-black hover:bg-emerald-400 px-3 py-1 text-xs shadow-md"
                      onClick={() => approve(r.id)}
                      disabled={loading}
                    >
                      {loading ? "..." : "Approve"}
                    </Button>
                  </div>

                  {/* Status */}
                  <div className="mt-2 text-right">
                    <span className="text-xs font-semibold text-yellow-400">
                      • Pending Approval
                    </span>
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
