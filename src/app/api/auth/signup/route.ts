import { NextResponse } from "next/server";
import { z } from "zod";
import { createCompanyUser } from "@/lib/auth/users";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
});

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid email and a password of at least 12 characters." }, { status: 400 });
  }

  const result = await createCompanyUser(parsed.data.email, parsed.data.password, "admin");
  if (!result.ok) {
    const status = result.code === "email_taken" ? 409 : result.code === "server_error" ? 500 : 400;
    return NextResponse.json({ error: result.message }, { status });
  }

  return NextResponse.json({ ok: true, email: result.user.email }, { status: 201 });
}
