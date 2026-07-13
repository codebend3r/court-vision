import { NextResponse, type NextRequest } from "next/server";

import { isUsernameTaken } from "@/lib/auth/signup";
import { isValidUsername, normalizeUsername } from "@/lib/auth/username";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const raw = request.nextUrl.searchParams.get("u") ?? "";
  const username = normalizeUsername(raw);

  if (!isValidUsername(username)) {
    return NextResponse.json({ available: false, valid: false });
  }

  const taken = await isUsernameTaken(username);
  return NextResponse.json({ available: !taken, valid: true });
}
