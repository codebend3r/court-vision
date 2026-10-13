import { NextResponse, type NextRequest } from "next/server";

import { isValidUsername, normalizeUsername } from "@/lib/auth/username";
import { isUsernameTaken } from "@/lib/auth/usernameTaken";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const raw = request.nextUrl.searchParams.get("u") ?? "";
  const username = normalizeUsername({ username: raw });

  if (!isValidUsername(username)) {
    return NextResponse.json({ available: false, valid: false });
  }

  const taken = await isUsernameTaken({ username });
  return NextResponse.json({ available: !taken, valid: true });
}
