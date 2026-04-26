import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { updateSetting } from "@/lib/settings";

export async function POST(request: Request) {
  const expected = process.env.AUCTION_ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json(
      { error: "AUCTION_ADMIN_PASSWORD is not configured on the server" },
      { status: 500 }
    );
  }

  let body: { password?: string; bid?: string | number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.password !== expected) {
    return NextResponse.json({ error: "Nesprávne heslo" }, { status: 401 });
  }

  const bidNum =
    typeof body.bid === "number" ? body.bid : parseFloat(String(body.bid ?? ""));
  if (isNaN(bidNum) || bidNum < 0 || bidNum > 1_000_000) {
    return NextResponse.json(
      { error: "Neplatná suma ponuky" },
      { status: 400 }
    );
  }

  await updateSetting("auction_current_bid", bidNum.toFixed(2));
  revalidatePath("/auction");

  return NextResponse.json({ ok: true, bid: bidNum });
}
