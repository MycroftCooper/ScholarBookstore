import { AuthForm } from "@/components/forms/AuthForm";
import { SiteHeader } from "@/components/layout/SiteHeader";

export default function RegisterPage() {
  return (
    <main className="min-h-screen bg-paper">
      <SiteHeader />
      <section className="mx-auto flex max-w-6xl justify-center px-4 py-10 md:py-16">
        <AuthForm mode="register" />
      </section>
    </main>
  );
}
