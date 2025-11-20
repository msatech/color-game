import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const { username, password } = await req.json();

  if (!username || !password) {
    return NextResponse.json(
      { error: "Username and password required" },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    return NextResponse.json(
      { error: "Username already exists" },
      { status: 400 }
    );
  }

  // demo: plain password, do NOT do this in production
  const user = await prisma.user.create({
    data: {
      username,
      password,
      balance: 0,
    },
  });

  return NextResponse.json({
    success: true,
    user: { id: user.id, username: user.username },
  });
}
