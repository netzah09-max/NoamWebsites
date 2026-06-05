import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({ meta: [{ title: "Admin sign in — NoamWebsites" }] }),
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin" });
    });
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fn = mode === "signin"
      ? supabase.auth.signInWithPassword({ email, password })
      : supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/admin` } });
    const { error } = await fn;
    setLoading(false);
    if (error) return setError(error.message);
    navigate({ to: "/admin" });
  };

  return (
    <div className="min-h-screen grid place-items-center bg-background text-foreground px-6">
      <form onSubmit={submit} className="w-full max-w-sm p-7 rounded-2xl border border-border bg-card space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Admin access</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to view requests.</p>
        </div>
        <label className="block">
          <span className="block text-sm font-medium mb-2">Email</span>
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary" />
        </label>
        <label className="block">
          <span className="block text-sm font-medium mb-2">Password</span>
          <input required type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm focus:outline-none focus:border-primary" />
        </label>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full shadow-[var(--shadow-neon)]">
          {loading ? "..." : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
        <button type="button" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="text-xs text-muted-foreground hover:text-foreground w-full text-center">
          {mode === "signin" ? "Need an account? Sign up" : "Have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}