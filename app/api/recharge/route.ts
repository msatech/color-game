import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const username = searchParams.get("username");
  const status = searchParams.get("status");

  if (username) {
    const user = await prisma.user.findUnique({
      where: { username },
      include: { recharges: { orderBy: { createdAt: "desc" } } },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    return NextResponse.json({ recharges: user.recharges });
  }

  if (status) {
    const recharges = await prisma.recharge.findMany({
      where: { status: status as any },
      orderBy: { createdAt: "desc" },
      include: { user: true },
    });
    return NextResponse.json({ recharges });
  }

  const recharges = await prisma.recharge.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: true },
  });

  return NextResponse.json({ recharges });
}

export async function POST(req: Request) {
  const { username, amount, trn } = await req.json();

  if (!username || !amount || !trn) {
    return NextResponse.json(
      { error: "username, amount, and trn required" },
      { status: 400 }
    );
  }

  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const amt = Number(amount);
  if (!amt || amt <= 0) {
    return NextResponse.json(
      { error: "Amount must be positive number" },
      { status: 400 }
    );
  }

  const recharge = await prisma.recharge.create({
    data: {
      userId: user.id,
      amount: amt,
      trn,
      status: "PENDING",
    },
  });

  return NextResponse.json({ success: true, recharge });
}
