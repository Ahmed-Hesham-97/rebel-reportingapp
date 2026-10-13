import { NextResponse } from "next/server";

/** Public email signup is disabled. Use `npm run create-user` to set the access password. */
export async function POST() {
  return NextResponse.json({ error: "Signup is disabled. Use the access password to sign in." }, { status: 403 });
}
