import { redirect } from "next/navigation";

export default function EmailVerifiedPage() {
  redirect("/auth/verify-email");
}
