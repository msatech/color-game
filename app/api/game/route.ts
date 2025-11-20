// app/api/game/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export type Color = "GREEN" | "RED" | "VIOLET";

const ROUND_DURATION_SECONDS = 180; // 3 minutes

interface RoundState {
  id: bigint;        // BigInt storage
  startTime: number; // JS timestamp
  processed: boolean;
}

// In-memory active round
let currentRound: RoundState | null = null;

// Last round summary cached for frontend
let lastRoundSummary:
  | {
      id: number;
      winningColor: Color | null;
      winningNumber: number | null;
      bets: any[];
    }
  | null = null;

/* --------------------------------------------------------
   RANDOM PICKERS
-------------------------------------------------------- */
function pickColor(): Color {
  const r = Math.random() * 100;
  if (r < 49) return "GREEN";
  if (r < 98) return "RED";
  return "VIOLET"; // 2% chance
}

function pickNumber(): number {
  return Math.floor(Math.random() * 10);
}

/* --------------------------------------------------------
   ENSURE ROUND EXISTS
-------------------------------------------------------- */
function ensureRound(): RoundState {
  if (!currentRound) {
    currentRound = {
      id: BigInt(Date.now()), // use BIGINT
      startTime: Date.now(),
      processed: false,
    };
  }
  return currentRound;
}

/* --------------------------------------------------------
   FINALIZE ROUND
-------------------------------------------------------- */
async function finalizeRound(oldRound: RoundState) {
  const winningColor = pickColor();
  const winningNumber = pickNumber();

  const bets = await prisma.bet.findMany({
    where: { roundId: oldRound.id },
  });

  // Compute winners
  const updates: {
    id: number;
    isWinner: boolean;
    multiplier: number;
  }[] = [];

  for (const b of bets) {
    let isWinner = false;
    let multiplier = 0;

    if (b.number !== null && b.number === winningNumber) {
      isWinner = true;
      multiplier = 4;
    } else if (b.color === winningColor) {
      isWinner = true;
      multiplier = winningColor === "VIOLET" ? 7 : 2;
    }

    updates.push({ id: b.id, isWinner, multiplier });
  }

  // Save results + update balances
  for (const u of updates) {
    const bet = await prisma.bet.update({
      where: { id: u.id },
      data: {
        isWinner: u.isWinner,
        multiplier: u.multiplier,
      },
      include: { user: true },
    });

    if (u.isWinner && bet.userId && bet.user) {
      const winAmount = bet.amount * u.multiplier;
      await prisma.user.update({
        where: { id: bet.userId },
        data: { balance: { increment: winAmount } },
      });
    }
  }

  // Cache last round summary
  const updatedBets = await prisma.bet.findMany({
    where: { roundId: oldRound.id },
  });

  lastRoundSummary = {
    id: Number(oldRound.id),
    winningColor,
    winningNumber,
    bets: updatedBets.map((b) => ({
      ...b,
      roundId: Number(b.roundId),
    })),
  };
}

/* --------------------------------------------------------
   GET — GAME STATE
-------------------------------------------------------- */
export async function GET() {
  try {
    const round = ensureRound();
    const now = Date.now();

    let elapsed = Math.floor((now - round.startTime) / 1000);
    let remaining = ROUND_DURATION_SECONDS - elapsed;

    // Finalize the round if needed
    if (remaining <= 0 && !round.processed) {
      round.processed = true;
      await finalizeRound(round);

      // Start a new round
      currentRound = {
        id: BigInt(Date.now()),
        startTime: Date.now(),
        processed: false,
      };

      elapsed = 0;
      remaining = ROUND_DURATION_SECONDS;
    }

    const activeBets = await prisma.bet.findMany({
      where: { roundId: currentRound!.id },
    });

    return NextResponse.json({
      round: {
        id: Number(currentRound!.id), // BigInt → Number
        remainingSeconds: remaining,
        duration: ROUND_DURATION_SECONDS,
        bets: activeBets.map((b) => ({
          ...b,
          roundId: Number(b.roundId),
        })),
      },
      lastRound: lastRoundSummary,
    });
  } catch (err) {
    console.error("GAME GET ERROR:", err);
    return NextResponse.json(
      { error: "Server error loading game state" },
      { status: 500 }
    );
  }
}

/* --------------------------------------------------------
   POST — PLACE BET
-------------------------------------------------------- */
export async function POST(req: Request) {
  try {
    const { playerName, color, amount, number } = await req.json();

    if (!playerName || !color || !amount) {
      return NextResponse.json({ error: "Invalid bet" }, { status: 400 });
    }

    const round = ensureRound();

    const now = Date.now();
    const elapsed = Math.floor((now - round.startTime) / 1000);

    if (elapsed >= ROUND_DURATION_SECONDS) {
      return NextResponse.json(
        { error: "Betting closed for this round" },
        { status: 403 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { username: playerName },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (user.balance < amount) {
      return NextResponse.json(
        { error: "Insufficient balance" },
        { status: 403 }
      );
    }

    // Prevent double-betting
    const existing = await prisma.bet.findFirst({
      where: {
        roundId: round.id,
        userId: user.id,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You already placed a bet this round" },
        { status: 400 }
      );
    }

    // Deduct amount
    await prisma.user.update({
      where: { id: user.id },
      data: { balance: { decrement: amount } },
    });

    // Create bet
    await prisma.bet.create({
      data: {
        userId: user.id,
        roundId: round.id, // BIGINT stored
        color,
        number,
        amount,
      },
    });

    return NextResponse.json({
      ok: true,
      roundId: Number(round.id),
    });
  } catch (err) {
    console.error("GAME BET ERROR:", err);
    return NextResponse.json(
      { error: "Server error placing bet" },
      { status: 500 }
    );
  }
}
