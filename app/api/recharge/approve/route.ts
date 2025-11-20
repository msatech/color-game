import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { id } = await req.json();
  const rechargeId = Number(id);

  if (!rechargeId) {
    return NextResponse.json(
      { error: "Recharge id required" },
      { status: 400 }
    );
  }

  const recharge = await prisma.recharge.update({
    where: { id: rechargeId },
    data: { status: "APPROVED" },
  });

  await prisma.user.update({
    where: { id: recharge.userId },
    data: {
      balance: { increment: recharge.amount },
    },
  });

  return NextResponse.json({ success: true, recharge });
}
