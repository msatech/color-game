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
    <div className="min-h-screen bg-muted py-4">
      <div className="max-w-md mx-auto px-3 space-y-4">
        <Card className="p-4">
          <h1 className="text-lg font-semibold mb-2">Admin - Recharges</h1>
          {recharges.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No pending recharges.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              {recharges.map((r) => (
                <div
                  key={r.id}
                  className="flex justify-between items-center border-b pb-1"
                >
                  <div>
                    <p className="font-semibold">
                      {r.user.username} – ₹{r.amount}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      TRN: {r.trn}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(r.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => approve(r.id)}
                    disabled={loading}
                  >
                    Approve
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => router.push("/")}
        >
          Back to Game
        </Button>
      </div>
    </div>
  );
}
