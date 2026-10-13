import { redirect } from "next/navigation";

/** Public signup removed — access is password-only via /login. */
export default function SignupPage() {
  redirect("/login");
}
