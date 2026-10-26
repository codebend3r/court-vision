import { NextResponse, type NextRequest } from "next/server";

import { isValidUsername, normalizeUsername } from "@/lib/auth/username";
import { isUsernameTaken } from "@/lib/auth/usernameTaken";
import {
  allowUsernameAttempt,
  USERNAME_RETRY_SECONDS,
  USERNAME_RATE_LIMIT_MESSAGE,
} from "@/lib/auth/usernameRateLimit";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const raw = request.nextUrl.searchParams.get("u") ?? "";
  const username = normalizeUsername({ username: raw });

  if (!isValidUsername(username)) {
    return NextResponse.json({ available: false, valid: false });
  }

  if (!(await allowUsernameAttempt())) {
    return NextResponse.json(
      { error: USERNAME_RATE_LIMIT_MESSAGE },
      {
        status: 429,
        headers: { "Retry-After": String(USERNAME_RETRY_SECONDS), "Cache-Control": "no-store" },
      },
    );
  }
  const taken = await isUsernameTaken({ username });
  return NextResponse.json(
    { available: !taken, valid: true },
    { headers: { "Cache-Control": "no-store" } },
  );
}
