import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check, ArrowRight, Home } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/thanks")({
  component: ThanksPage,
});

type Lang = "en" | "he" | "ar" | "ru";

function ThanksPage() {
  const { lang = "en" } = Route.useSearch() as { lang?: Lang };
  const t = TRANSLATIONS[lang] ?? TRANSLATIONS.en;
  const isRtl = lang === "he" || lang === "ar";

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [lang, isRtl]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <span className="w-8 h-8 rounded-md bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-neon)]">
              <Home className="w-4 h-4 text-primary-foreground" />
            </span>
            <span className="font-bold tracking-tight">NoamWebsites</span>
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 grid place-items-center mx-auto mb-8">
            <Check className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{t.title}</h1>
          <p className="mt-4 text-muted-foreground text-lg">{t.subtitle}</p>
          <div className="mt-10">
            <Link to="/">
              <Button size="lg" className="shadow-[var(--shadow-neon)] h-12 px-7 text-base">
                {t.back} <ArrowRight className={`ml-2 w-4 h-4 ${isRtl ? "rtl:rotate-180" : ""}`} />
              </Button>
            </Link>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border py-8">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-muted-foreground">
          NoamWebsites Web Services
        </div>
      </footer>
    </div>
  );
}

const TRANSLATIONS: Record<Lang, { title: string; subtitle: string; back: string }> = {
  en: {
    title: "Thank you for requesting!",
    subtitle: "Someone will contact you soon.",
    back: "Back to Home",
  },
  he: {
    title: "תודה על הבקשה!",
    subtitle: "מישהו יצור איתך קשר בקרוב.",
    back: "חזרה לדף הבית",
  },
  ar: {
    title: "شكراً على طلبك!",
    subtitle: "سيتواصل معك أحد قريباً.",
    back: "العودة إلى الرئيسية",
  },
  ru: {
    title: "Спасибо за заявку!",
    subtitle: "С вами скоро свяжутся.",
    back: "На главную",
  },
};
