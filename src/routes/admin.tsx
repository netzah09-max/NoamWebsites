import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Phone, User, Trash2, LogOut, Inbox } from "lucide-react";

const ADMIN_EMAIL = "netzah09@gmail.com";

type Request = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  need: string;
  plan: string | null;
  description: string;
  created_at: string;
};

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Requests — NoamWebsites Admin" }, { name: "robots", content: "noindex" }] }),
});

function AdminPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "unauth" | "forbidden" | "ready">("loading");
  const [email, setEmail] = useState<string | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (!session) { setStatus("unauth"); return; }
      setEmail(session.user.email ?? null);
      if (session.user.email !== ADMIN_EMAIL) { setStatus("forbidden"); return; }
      setStatus("ready");
      void load();
    });
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      if (!s) { setStatus("unauth"); return; }
      setEmail(s.user.email ?? null);
      if (s.user.email !== ADMIN_EMAIL) { setStatus("forbidden"); return; }
      setStatus("ready");
      void load();
    });
    return () => subscription.unsubscribe();
  }, []);

  const load = async () => {
    const { data, error } = await supabase.from("requests").select("*").order("created_at", { ascending: false });
    if (error) { setErr(error.message); return; }
    setRequests((data ?? []) as Request[]);
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this request?")) return;
    const { error } = await supabase.from("requests").delete().eq("id", id);
    if (error) return alert(error.message);
    setRequests((r) => r.filter((x) => x.id !== id));
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (status === "loading") {
    return <div className="min-h-screen grid place-items-center bg-background text-muted-foreground">Loading...</div>;
  }

  if (status === "unauth") {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground px-6">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Sign in required</h1>
          <p className="text-muted-foreground text-sm">Only the admin can view this page.</p>
          <Button asChild className="shadow-[var(--shadow-neon)]"><Link to="/auth">Go to sign in</Link></Button>
        </div>
      </div>
    );
  }

  if (status === "forbidden") {
    return (
      <div className="min-h-screen grid place-items-center bg-background text-foreground px-6">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-2xl font-bold">Access denied</h1>
          <p className="text-muted-foreground text-sm">
            You are signed in as <span className="text-foreground">{email}</span>, but this page is only for the site owner.
          </p>
          <Button variant="outline" onClick={signOut}><LogOut className="w-4 h-4 mr-2" /> Sign out</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="font-bold">NoamWebsites <span className="text-muted-foreground font-normal text-sm">/ Admin</span></Link>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground hidden sm:inline">{email}</span>
            <Button size="sm" variant="outline" onClick={signOut}><LogOut className="w-4 h-4 mr-1.5" /> Sign out</Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Requests</h1>
            <p className="text-sm text-muted-foreground mt-1">{requests.length} total</p>
          </div>
          <Button variant="outline" size="sm" onClick={load}>Refresh</Button>
        </div>

        {err && <p className="text-sm text-destructive mb-4">{err}</p>}

        {requests.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-border rounded-2xl">
            <Inbox className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No requests yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map((r) => (
              <article key={r.id} className="p-6 rounded-2xl border border-border bg-card">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="font-semibold text-lg flex items-center gap-2"><User className="w-4 h-4 text-primary" />{r.full_name}</h2>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
                      <a href={`tel:${r.phone}`} className="inline-flex items-center gap-1.5 hover:text-primary">
                        <Phone className="w-3.5 h-3.5" />{r.phone}
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs px-2.5 py-1 rounded-full border border-primary/40 text-primary bg-primary/10">{r.need}</span>
                    {r.plan && (
                      <span className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground bg-card">{r.plan}</span>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => remove(r.id)} className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <p className="mt-4 text-sm whitespace-pre-wrap text-foreground/90">{r.description}</p>
                <p className="mt-4 text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}