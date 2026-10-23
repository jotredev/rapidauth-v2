import { redirectToFirstRunIfNoAdmin } from "@/lib/first-run-admin";
import { LandingContent } from "@/components/landing-content";
import { getSession } from "@/lib/auth";

export default async function Home() {
  await redirectToFirstRunIfNoAdmin();
  const session = await getSession();

  const user = session ? {
    name: session.user.name,
    email: session.user.email,
    image: session.user.image ?? undefined,
  } : null;

  return <LandingContent user={user} />;
}
