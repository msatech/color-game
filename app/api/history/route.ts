import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Helper: convert BigInt in any object recursively
function toSafeJSON(obj: any): any {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === "bigint") return Number(obj);

  if (obj instanceof Date) return obj.toISOString();

  if (Array.isArray(obj)) return obj.map(toSafeJSON);

  if (typeof obj === "object") {
    const cleaned: any = {};
    for (const key of Object.keys(obj)) {
      cleaned[key] = toSafeJSON(obj[key]);
    }
    return cleaned;
  }

  return obj;
}


export async function POST(req: Request) {
  try {
    const { username } = await req.json();

    if (!username) {
      return NextResponse.json({ error: "Username required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { username },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ALL user bets
    const userBetsRaw = await prisma.bet.findMany({
      where: { userId: user.id },
      orderBy: { roundId: "desc" },
    });

    const userBets = toSafeJSON(userBetsRaw);

    // DISTINCT rounds
    const roundsRaw = await prisma.bet.groupBy({
      by: ["roundId"],
      _max: { createdAt: true },
      orderBy: [{ roundId: "desc" }],
    });

    const roundsDetailed = [];

    for (const r of roundsRaw) {
      const betsRaw = await prisma.bet.findMany({
        where: { roundId: r.roundId },
        orderBy: [{ id: "asc" }],
      });

      const bets = toSafeJSON(betsRaw);

      const winning = bets.find((b:any) => b.isWinner === true);

      roundsDetailed.push({
        roundId: Number(r.roundId),
        winningColor: winning?.color ?? null,
        winningNumber: winning?.number ?? null,
        bets,
      });
    }

    return NextResponse.json({
      userBets,
      rounds: roundsDetailed,
    });
  } catch (err) {
    console.error("HISTORY API ERROR:", err);
    return NextResponse.json(
      { error: "Server error loading history" },
      { status: 500 }
    );
  }
}
