import { NextResponse } from "next/server";
import { deleteHostSession } from "@/lib/auth/session";

export async function POST() {
  await deleteHostSession();
  return NextResponse.json({ success: true, message: "Logged out successfully." });
}

