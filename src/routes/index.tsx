import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Globe, Instagram, Sparkles, Check, ArrowRight, Zap,
  MessageSquare, Send, Palette, Music2, Mail, Languages, X, Star, ImagePlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const REQUEST_BOT_API_URL = import.meta.env.VITE_REQUEST_BOT_API_URL?.replace(/\/$/, "");

async function notifyDiscord(data: {
  requestId: string;
  fullName: string;
  phone: string;
  need: string;
  plan: string;
  description: string;
}) {
  if (!REQUEST_BOT_API_URL) {
    throw new Error("The NoamWebsites bot API is not configured.");
  }

  const response = await fetch(`${REQUEST_BOT_API_URL}/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    const result = await response.json().catch(() => null);
    throw new Error(result?.error || "The NoamWebsites bot could not send the request.");
  }
}

export const Route = createFileRoute("/")({
  component: Index,
});

type Lang = "en" | "he" | "ar" | "ru";
const RTL: Lang[] = ["he", "ar"];
const OWNER_EMAIL = "netzah09@gmail.com";
const MAX_REVIEW_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_INLINE_REVIEW_IMAGE_BYTES = 450 * 1024;
const MIGRATION_TEST_REVIEW_ID = "b7baa533-f6bf-4b31-8430-43b57cba2c6c";

async function fileToDataUrl(file: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("Could not read image."));
      image.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function createInlineReviewImage(file: File): Promise<string> {
  const image = await loadImage(file);
  let maxDimension = 1280;
  let quality = 0.82;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not process image.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality),
    );
    if (blob && blob.size <= MAX_INLINE_REVIEW_IMAGE_BYTES) {
      return fileToDataUrl(blob);
    }

    quality = Math.max(0.45, quality - 0.08);
    if (attempt >= 3) maxDimension = Math.max(640, Math.round(maxDimension * 0.82));
  }

  throw new Error("Image could not be compressed enough.");
}

function Index() {
  const [lang, setLang] = useState<Lang>("he");
  const t = TRANSLATIONS[lang];
  const isRtl = RTL.includes(lang);
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
  }, [lang, isRtl]);

  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [form, setForm] = useState({
    fullName: "", phone: "", need: "website", plan: "starter", description: "",
  });
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const rl = REVIEW_LABELS[lang];
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [reviewForm, setReviewForm] = useState({ name: "", rating: 5, content: "" });
  const [reviewImage, setReviewImage] = useState<File | null>(null);
  const [reviewImagePreview, setReviewImagePreview] = useState<string | null>(null);
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewPosted, setReviewPosted] = useState(false);

  const loadReviews = async () => {
    const { data } = await supabase
      .from("reviews")
      .select("id, name, rating, content, image_url, created_at")
      .neq("id", MIGRATION_TEST_REVIEW_ID)
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setReviews(data as ReviewRow[]);
  };

  useEffect(() => { loadReviews(); }, []);

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewSubmitting(true);
    setReviewError(null);
    setReviewPosted(false);

    try {
      let image_url: string | null = null;
      if (reviewImage) {
        if (reviewImage.size > MAX_REVIEW_IMAGE_BYTES) {
          setReviewError(rl.imageTooLarge);
          return;
        }

        const inlineImage = await createInlineReviewImage(reviewImage);
        const ext = reviewImage.name.split(".").pop()?.toLowerCase() || "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from("review-images")
          .upload(path, reviewImage, { contentType: reviewImage.type, upsert: false });

        if (uploadError) {
          console.warn("Review image storage unavailable; using inline image.", uploadError);
          image_url = inlineImage;
        } else {
          const { data: publicImage } = supabase.storage.from("review-images").getPublicUrl(path);
          image_url = publicImage.publicUrl;
        }
      }

      const { error } = await supabase.from("reviews").insert({
        name: reviewForm.name.trim(),
        rating: reviewForm.rating,
        content: reviewForm.content.trim(),
        image_url,
      });
      if (error) throw error;

      setReviewForm({ name: "", rating: 5, content: "" });
      setReviewImage(null);
      if (reviewImagePreview) URL.revokeObjectURL(reviewImagePreview);
      setReviewImagePreview(null);
      setReviewPosted(true);
      await loadReviews();
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Could not post review.");
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setReviewImage(file);
    if (reviewImagePreview) URL.revokeObjectURL(reviewImagePreview);
    setReviewImagePreview(file ? URL.createObjectURL(file) : null);
  };

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  const NEED_KEYS = ["website", "instagram", "tiktok", "onlySocials", "websiteSocials"] as const;
  const PLAN_KEYS = ["starter", "pro", "full"] as const;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    try {
      const { error } = await supabase
        .from("requests")
        .upsert(
          {
            id: requestId,
            full_name: form.fullName,
            phone: form.phone,
            need: form.need,
            plan: form.plan,
            description: form.description,
          },
          { onConflict: "id", ignoreDuplicates: true },
        );
      if (error) throw error;

      await notifyDiscord({
        requestId,
        fullName: form.fullName,
        phone: form.phone,
        need: form.need,
        plan: form.plan,
        description: form.description,
      });

      setRequestId(crypto.randomUUID());
      setForm({ fullName: "", phone: "", need: "website", plan: "starter", description: "" });
      navigate({ to: "/thanks", search: { lang } });
    } catch (error) {
      console.error("Request submission failed:", error);
      setSubmitError(error instanceof Error ? error.message : "Could not send your request.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <button onClick={() => scrollTo("top")} className="flex items-center gap-2 group">
            <span className="w-8 h-8 rounded-md bg-[image:var(--gradient-primary)] grid place-items-center shadow-[var(--shadow-neon)]">
              <Zap className="w-4 h-4 text-primary-foreground" />
            </span>
            <span className="font-bold tracking-tight">NoamWebsites</span>
          </button>
          <nav className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <button onClick={() => scrollTo("services")} className="hover:text-foreground transition">{t.nav.services}</button>
            <button onClick={() => scrollTo("pricing")} className="hover:text-foreground transition">{t.nav.pricing}</button>
            <button onClick={() => scrollTo("how")} className="hover:text-foreground transition">{t.nav.how}</button>
            <button onClick={() => scrollTo("contact")} className="hover:text-foreground transition">{t.nav.contact}</button>
            <button onClick={() => scrollTo("reviews")} className="hover:text-foreground transition">{rl.nav}</button>
          </nav>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Languages className="w-4 h-4 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none rtl:right-2 rtl:left-auto" />
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as Lang)}
                aria-label="Language"
                className="appearance-none bg-card/60 border border-border rounded-md text-xs pl-7 pr-2 py-1.5 text-foreground focus:outline-none focus:border-primary rtl:pr-7 rtl:pl-2"
              >
                <option value="en">EN</option>
                <option value="he">עב</option>
                <option value="ar">ع</option>
                <option value="ru">RU</option>
              </select>
            </div>
            <Button size="sm" variant="outline" onClick={() => scrollTo("reviews")} className="hidden sm:inline-flex">
              <Star className="w-4 h-4 mr-1 rtl:ml-1 rtl:mr-0" />
              {rl.nav}
            </Button>
            <Button size="sm" onClick={() => scrollTo("pricing")} className="shadow-[var(--shadow-neon)]">
              {t.nav.cta}
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="relative overflow-hidden">
        <div className="absolute inset-0 bg-[image:var(--gradient-hero)] pointer-events-none" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-28 md:pt-32 md:pb-40 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-muted-foreground border border-border bg-card/40 backdrop-blur px-3 py-1.5 rounded-full mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
            {t.hero.badge}
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl mx-auto leading-[1.05]">
            {t.hero.title1}{" "}
            <span className="bg-clip-text text-transparent bg-[image:var(--gradient-primary)]">
              {t.hero.title2}
            </span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
            {t.hero.subtitle}
          </p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" onClick={() => scrollTo("pricing")} className="shadow-[var(--shadow-neon)] h-12 px-7 text-base">
              {t.hero.cta1} <ArrowRight className="ml-1 w-4 h-4 rtl:rotate-180" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => scrollTo("pricing")} className="h-12 px-7 text-base bg-card/40 backdrop-blur">
              {t.hero.cta2}
            </Button>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="py-24 border-t border-border">
        <div className="max-w-6xl mx-auto px-6">
          <SectionHeader eyebrow={t.services.eyebrow} title={t.services.title} subtitle={t.services.subtitle} />
          <div className="grid md:grid-cols-3 gap-5 mt-14">
            {SERVICES.map((s) => {
              const tr = t.services.items[s.key];
              return (
              <button
                key={s.key}
                onClick={() => setSelectedService(selectedService === s.key ? null : s.key)}
                className={`group text-left p-6 rounded-2xl border bg-card transition-all duration-300 ${
                  selectedService === s.key
                    ? "border-primary shadow-[var(--shadow-neon)] -translate-y-1"
                    : "border-border hover:border-primary/50 hover:-translate-y-1"
                }`}
              >
                <div className="w-11 h-11 rounded-xl bg-[image:var(--gradient-primary)] grid place-items-center mb-5 shadow-[var(--shadow-neon)]">
                  <s.icon className="w-5 h-5 text-primary-foreground" />
                </div>
                <h3 className="text-lg font-semibold">{tr.title}</h3>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {tr.items.map((i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span>{i}</span>
                    </li>
                  ))}
                </ul>
              </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 border-t border-border">
        <div className="max-w-6xl mx-auto px-6">
          <SectionHeader eyebrow={t.pricing.eyebrow} title={t.pricing.title} subtitle={t.pricing.subtitle} />

          <div className="grid md:grid-cols-3 gap-5 mt-14">
            {TIERS.map((tier) => {
              const tr = t.pricing.tiers[tier.key];
              return (
              <div
                key={tier.key}
                className={`relative p-7 rounded-2xl border bg-card transition-all duration-300 hover:-translate-y-1 ${
                  tier.featured ? "border-primary shadow-[var(--shadow-neon)]" : "border-border hover:border-primary/40"
                }`}
              >
                {tier.featured && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-semibold px-3 py-1 rounded-full bg-[image:var(--gradient-primary)] text-primary-foreground">
                    {t.pricing.popular}
                  </span>
                )}
                <h3 className="font-semibold text-lg">{tr.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-bold">₪{tier.price}</span>
                  <span className="text-muted-foreground">+</span>
                </div>
                <ul className="mt-6 space-y-3 text-sm">
                  {tr.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground">{f}</span>
                    </li>
                  ))}
                  {tr.excluded?.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <X className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                      <span className="text-muted-foreground line-through opacity-70">{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  onClick={() => scrollTo("contact")}
                  variant={tier.featured ? "default" : "outline"}
                  className={`mt-7 w-full ${tier.featured ? "shadow-[var(--shadow-neon)]" : ""}`}
                >
                  {t.pricing.choose}
                </Button>
              </div>
              );
            })}
          </div>

          {/* Social pricing */}
          <div className="mt-16">
            <h3 className="text-center text-sm uppercase tracking-widest text-muted-foreground mb-6">{t.pricing.socialTitle}</h3>
            <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
              {SOCIAL_TIERS.map((s) => (
                <div key={s.key} className="p-5 rounded-xl border border-border bg-card/60 backdrop-blur flex items-center justify-between hover:border-primary/50 transition">
                  <div className="flex items-center gap-3">
                    <s.icon className="w-5 h-5 text-primary" />
                    <span className="font-medium text-sm">{t.pricing.social[s.key]}</span>
                  </div>
                  <span className="font-semibold">₪{s.price}+</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="py-24 border-t border-border">
        <div className="max-w-6xl mx-auto px-6">
          <SectionHeader eyebrow={t.how.eyebrow} title={t.how.title} subtitle={t.how.subtitle} />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 mt-14">
            {STEPS.map((s, i) => {
              const tr = t.how.steps[i];
              return (
              <div key={s.key} className="p-6 rounded-2xl border border-border bg-card relative overflow-hidden group hover:border-primary/50 transition">
                <span className="absolute -right-2 -top-4 text-7xl font-bold text-primary/10 group-hover:text-primary/20 transition">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="relative">
                  <s.icon className="w-5 h-5 text-primary mb-4" />
                  <h3 className="font-semibold">{tr.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2">{tr.desc}</p>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact form */}
      <section id="contact" className="py-24 border-t border-border">
        <div className="max-w-3xl mx-auto px-6">
          <SectionHeader eyebrow={t.contact.eyebrow} title={t.contact.title} subtitle={t.contact.subtitle} />

          <form onSubmit={handleSubmit} className="mt-12 p-6 md:p-8 rounded-2xl border border-border bg-card space-y-5">
            <Field label={`${t.formName} *`}>
              <input required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={inputCls} placeholder={t.placeholders.name} />
            </Field>
            <Field label={`${t.formPhone} *`}>
              <input required type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className={inputCls} placeholder="+05" />
            </Field>
            <Field label={t.formNeed}>
              <div className="grid grid-cols-2 gap-2">
                {NEED_KEYS.map((opt) => (
                  <button
                    type="button"
                    key={opt}
                    onClick={() => setForm({ ...form, need: opt })}
                    className={`px-3 py-2.5 rounded-lg text-sm border transition ${
                      form.need === opt
                        ? "border-primary bg-primary/10 text-foreground shadow-[var(--shadow-neon)]"
                        : "border-border bg-background hover:border-primary/50"
                    }`}
                  >
                    {t.needs[opt]}
                  </button>
                ))}
              </div>
            </Field>
            {(form.need === "website" || form.need === "websiteSocials") && (
              <Field label={t.formPlan}>
                <div className="grid grid-cols-2 gap-2">
                  {PLAN_KEYS.map((opt) => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => setForm({ ...form, plan: opt })}
                      className={`px-3 py-2.5 rounded-lg text-sm border transition ${
                        form.plan === opt
                          ? "border-primary bg-primary/10 text-foreground shadow-[var(--shadow-neon)]"
                          : "border-border bg-background hover:border-primary/50"
                      }`}
                    >
                      {t.plans[opt]}
                    </button>
                  ))}
                </div>
              </Field>
            )}
            <Field label={t.formDesc}>
              <textarea required value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={5} className={inputCls + " resize-none"} placeholder={t.placeholders.desc} />
            </Field>
            <Button type="submit" size="lg" disabled={submitting} className="w-full shadow-[var(--shadow-neon)] h-12">
              <Send className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" /> {submitting ? "..." : t.formSubmit}
            </Button>
            {submitError && (
              <p className="text-center text-sm text-destructive">{submitError}</p>
            )}
          </form>
        </div>
      </section>

      {/* Reviews */}
      <section id="reviews" className="py-24 border-t border-border">
        <div className="max-w-4xl mx-auto px-6">
          <SectionHeader eyebrow={rl.eyebrow} title={rl.title} subtitle={rl.subtitle} />

          <form onSubmit={handleReviewSubmit} className="mt-12 p-6 md:p-8 rounded-2xl border border-border bg-card space-y-5">
            <Field label={`${rl.name} *`}>
              <input
                required
                maxLength={80}
                value={reviewForm.name}
                onChange={(e) => setReviewForm({ ...reviewForm, name: e.target.value })}
                className={inputCls}
                placeholder={rl.namePlaceholder}
              />
            </Field>
            <Field label={rl.rating}>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    type="button"
                    key={n}
                    onClick={() => setReviewForm({ ...reviewForm, rating: n })}
                    aria-label={`${n} stars`}
                    className="p-1 transition hover:scale-110"
                  >
                    <Star
                      className={`w-7 h-7 ${
                        n <= reviewForm.rating
                          ? "fill-yellow-400 text-yellow-400"
                          : "text-muted-foreground"
                      }`}
                    />
                  </button>
                ))}
              </div>
            </Field>
            <Field label={`${rl.content} *`}>
              <textarea
                required
                maxLength={1000}
                value={reviewForm.content}
                onChange={(e) => setReviewForm({ ...reviewForm, content: e.target.value })}
                rows={4}
                className={inputCls + " resize-none"}
                placeholder={rl.contentPlaceholder}
              />
            </Field>
            <Field label={rl.imageLabel}>
              <div className="flex items-center gap-3">
                <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border bg-background text-sm cursor-pointer hover:border-primary/50 transition">
                  <ImagePlus className="w-4 h-4 text-primary" />
                  <span>{reviewImage ? rl.imageChange : rl.imageAdd}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
                {reviewImagePreview && (
                  <div className="relative">
                    <img src={reviewImagePreview} alt="" className="w-16 h-16 rounded-lg object-cover border border-border" />
                    <button
                      type="button"
                      onClick={() => { setReviewImage(null); if (reviewImagePreview) URL.revokeObjectURL(reviewImagePreview); setReviewImagePreview(null); }}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-destructive text-destructive-foreground grid place-items-center"
                      aria-label="Remove image"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </Field>
            <Button type="submit" size="lg" disabled={reviewSubmitting} className="w-full shadow-[var(--shadow-neon)] h-12">
              <Send className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
              {reviewSubmitting ? "..." : rl.submit}
            </Button>
            {reviewError && <p className="text-center text-sm text-destructive">{reviewError}</p>}
            {reviewPosted && (
              <p className="text-center text-sm text-primary">
                {lang === "he"
                  ? "הביקורת שלך פורסמה."
                  : lang === "ar"
                    ? "تم نشر تقييمك."
                    : lang === "ru"
                      ? "Ваш отзыв опубликован."
                      : "Your review was posted."}
              </p>
            )}
          </form>

          <div className="mt-12 space-y-4">
            {reviews.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">{rl.empty}</p>
            ) : (
              reviews.map((r) => (
                <div key={r.id} className="p-5 rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-[image:var(--gradient-primary)] grid place-items-center text-primary-foreground text-sm font-semibold">
                        {r.name.trim().charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{r.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={`w-4 h-4 ${
                            n <= r.rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-foreground/90 whitespace-pre-wrap break-words">{r.content}</p>
                  {r.image_url && (
                    <a href={r.image_url} target="_blank" rel="noopener noreferrer" className="block mt-3">
                      <img
                        src={r.image_url}
                        alt=""
                        loading="lazy"
                        className="max-h-72 rounded-lg border border-border object-cover"
                      />
                    </a>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-12">
        <div className="max-w-6xl mx-auto px-6 space-y-6">
          <div className="flex flex-col md:flex-row gap-6 items-center justify-between">
            <p className="text-sm text-muted-foreground text-center md:text-start">
              <span className="font-semibold text-foreground">NoamWebsites Web Services</span> — {t.footer.tagline}
            </p>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={() => scrollTo("contact")}>{t.nav.contact}</Button>
              <Button variant="ghost" size="sm" onClick={() => scrollTo("pricing")}>{t.nav.pricing}</Button>
              <Button variant="ghost" size="sm" onClick={() => scrollTo("services")}>{t.nav.services}</Button>
            </div>
          </div>
          <div className="pt-6 border-t border-border flex flex-col sm:flex-row items-center justify-center gap-2 text-sm text-muted-foreground">
            <span>{t.footer.contactMe}</span>
            <a
              href={`mailto:${OWNER_EMAIL}`}
              className="inline-flex items-center gap-1.5 text-primary hover:underline font-medium"
            >
              <Mail className="w-4 h-4" />
              {OWNER_EMAIL}
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

const inputCls =
  "w-full px-4 py-2.5 rounded-lg bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:shadow-[var(--shadow-neon)] transition";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium mb-2">{label}</span>
      {children}
    </label>
  );
}

function SectionHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto">
      <span className="text-xs uppercase tracking-widest text-primary font-semibold">{eyebrow}</span>
      <h2 className="mt-3 text-3xl md:text-5xl font-bold tracking-tight">{title}</h2>
      <p className="mt-4 text-muted-foreground">{subtitle}</p>
    </div>
  );
}

const SERVICES = [
  { key: "website", icon: Globe },
  { key: "social", icon: Instagram },
  { key: "full", icon: Sparkles },
] as const;

const TIERS = [
  { key: "starter", price: 100, featured: false },
  { key: "pro", price: 200, featured: true },
  { key: "full", price: 400, featured: false },
] as const;

const SOCIAL_TIERS = [
  { key: "ig", price: 20, icon: Instagram },
  { key: "tt", price: 20, icon: Music2 },
  { key: "bundle", price: 30, icon: Sparkles },
] as const;

const STEPS = [
  { key: "choose", icon: Palette },
  { key: "send", icon: Send },
  { key: "chat", icon: MessageSquare },
  { key: "build", icon: Zap },
] as const;

type ReviewRow = {
  id: string;
  name: string;
  rating: number;
  content: string;
  image_url: string | null;
  created_at: string;
};

const REVIEW_LABELS: Record<Lang, {
  nav: string; eyebrow: string; title: string; subtitle: string;
  name: string; namePlaceholder: string; rating: string; content: string;
  contentPlaceholder: string; submit: string; empty: string;
  imageLabel: string; imageAdd: string; imageChange: string; imageTooLarge: string;
}> = {
  en: {
    nav: "Reviews", eyebrow: "Reviews", title: "What people say",
    subtitle: "Share your experience or read what others have said.",
    name: "Your name", namePlaceholder: "John D.",
    rating: "Your rating", content: "Your review",
    contentPlaceholder: "How was your experience?",
    submit: "Post Review", empty: "No reviews yet. Be the first to share!",
    imageLabel: "Add a picture (optional)", imageAdd: "Choose image",
    imageChange: "Change image", imageTooLarge: "Image is too large (max 5 MB).",
  },
  he: {
    nav: "ביקורות", eyebrow: "ביקורות", title: "מה אנשים אומרים",
    subtitle: "שתף את החוויה שלך או קרא מה אחרים אמרו.",
    name: "השם שלך", namePlaceholder: "יוסי כ.",
    rating: "הדירוג שלך", content: "הביקורת שלך",
    contentPlaceholder: "איך הייתה החוויה שלך?",
    submit: "פרסם ביקורת", empty: "אין עדיין ביקורות. היה הראשון לשתף!",
    imageLabel: "הוסף תמונה (אופציונלי)", imageAdd: "בחר תמונה",
    imageChange: "החלף תמונה", imageTooLarge: "התמונה גדולה מדי (עד 5 מ\"ב).",
  },
  ar: {
    nav: "التقييمات", eyebrow: "التقييمات", title: "ماذا يقول الناس",
    subtitle: "شارك تجربتك أو اقرأ ما قاله الآخرون.",
    name: "اسمك", namePlaceholder: "أحمد م.",
    rating: "تقييمك", content: "تقييمك المكتوب",
    contentPlaceholder: "كيف كانت تجربتك؟",
    submit: "نشر التقييم", empty: "لا توجد تقييمات بعد. كن أول من يشارك!",
    imageLabel: "أضف صورة (اختياري)", imageAdd: "اختر صورة",
    imageChange: "تغيير الصورة", imageTooLarge: "الصورة كبيرة جداً (الحد الأقصى 5 ميغابايت).",
  },
  ru: {
    nav: "Отзывы", eyebrow: "Отзывы", title: "Что говорят люди",
    subtitle: "Поделитесь опытом или прочитайте отзывы других.",
    name: "Ваше имя", namePlaceholder: "Иван И.",
    rating: "Ваша оценка", content: "Ваш отзыв",
    contentPlaceholder: "Как вам опыт?",
    submit: "Опубликовать", empty: "Пока нет отзывов. Будьте первым!",
    imageLabel: "Добавить фото (необязательно)", imageAdd: "Выбрать фото",
    imageChange: "Сменить фото", imageTooLarge: "Файл слишком большой (макс. 5 МБ).",
  },
};

type Dict = {
  nav: { services: string; pricing: string; how: string; contact: string; cta: string };
  hero: { badge: string; title1: string; title2: string; subtitle: string; cta1: string; cta2: string };
  services: {
    eyebrow: string; title: string; subtitle: string;
    items: Record<"website" | "social" | "full", { title: string; items: string[] }>;
  };
  pricing: {
    eyebrow: string; title: string; subtitle: string; popular: string; choose: string; socialTitle: string;
    tiers: Record<"starter" | "pro" | "full", { name: string; features: string[]; excluded?: string[] }>;
    social: Record<"ig" | "tt" | "bundle", string>;
  };
  how: { eyebrow: string; title: string; subtitle: string; steps: { title: string; desc: string }[] };
  contact: { eyebrow: string; title: string; subtitle: string };
  formName: string; formEmail: string; formPhone: string; formNeed: string; formPlan: string; formDesc: string; formSubmit: string; formThanks: string;
  needs: Record<"website" | "instagram" | "tiktok" | "onlySocials" | "websiteSocials", string>;
  plans: Record<"starter" | "pro" | "full", string>;
  placeholders: { name: string; desc: string };
  emailSubject: string;
  footer: { tagline: string; contactMe: string };
};

const TRANSLATIONS: Record<Lang, Dict> = {
  en: {
    nav: { services: "Services", pricing: "Pricing", how: "How it works", contact: "Contact", cta: "Get Started" },
    hero: {
      badge: "Now accepting new projects",
      title1: "Get a Website or Social Media",
      title2: "Setup Made For You",
      subtitle: "I create clean websites, landing pages, and social media pages for people who want to look professional online.",
      cta1: "Get Started", cta2: "View Pricing",
    },
    services: {
      eyebrow: "Services", title: "Pick what you need", subtitle: "Tap a card to see what's included.",
      items: {
        website: { title: "Website Creation", items: ["Business websites", "Store websites", "Portfolio websites", "Landing pages"] },
        social: { title: "Social Media Setup", items: ["Instagram page setup", "TikTok page setup", "Profile bio and branding", "Highlights / icons / profile picture ideas"] },
        full: { title: "Full Online Setup", items: ["Website + socials", "Branding colors", "Contact buttons", "Basic SEO setup"] },
      },
    },
    pricing: {
      eyebrow: "Pricing", title: "Simple, honest pricing", subtitle: "Pay for what you need. Upgrade anytime.",
      popular: "Most Popular", choose: "Choose plan", socialTitle: "Social Media Setup",
      tiers: {
        starter: { name: "Starter Website", features: ["Simple 1 page website", "Mobile friendly", "Contact button", "Basic design", "Instagram page included"], excluded: ["No purchase button"] },
        pro: { name: "Professional Website", features: ["Multiple sections / pages", "Custom design", "Pricing / services page", "Contact form", "Social links"] },
        full: { name: "Full Brand Setup", features: ["Website", "Instagram setup", "TikTok setup", "Branding / colors", "Profile text and bio", "Best for businesses / creators"] },
      },
      social: { ig: "Instagram Setup", tt: "TikTok Setup", bundle: "Instagram + TikTok Bundle" },
    },
    how: {
      eyebrow: "Process", title: "How it works", subtitle: "From idea to live in 4 steps.",
      steps: [
        { title: "Choose what you need", desc: "Browse services and pick a starting point." },
        { title: "Send your request", desc: "Fill out the form with your details." },
        { title: "I message you", desc: "We chat about scope, timing, and price." },
        { title: "I build it for you", desc: "You receive a clean, finished result." },
      ],
    },
    contact: { eyebrow: "Request", title: "Send your request", subtitle: "Tell me what you need. I'll reply within 24h." },
    formName: "Full name", formEmail: "Gmail address", formPhone: "Phone number", formNeed: "What do you need?", formPlan: "What kind of plan do you want?",
    formDesc: "Describe what you want", formSubmit: "Send Request",
    formThanks: "Thanks! Your request was sent. I'll be in touch soon.",
    needs: { website: "Website", instagram: "Instagram setup", tiktok: "TikTok setup", onlySocials: "Only socials", websiteSocials: "Website + Socials" },
    plans: { starter: "Starter Website", pro: "Professional Website", full: "Full Brand Setup" },
    placeholders: { name: "Your full name", desc: "Style, references, content, deadline..." },
    emailSubject: "New request — NoamWebsites Web Services",
    footer: { tagline: "Websites and social media setup made simple.", contactMe: "Want to get in touch?" },
  },
  he: {
    nav: { services: "שירותים", pricing: "מחירים", how: "איך זה עובד", contact: "צור קשר", cta: "התחל" },
    hero: {
      badge: "מקבל כעת פרויקטים חדשים",
      title1: "קבל אתר או הקמת",
      title2: "רשתות חברתיות בשבילך",
      subtitle: "אני בונה אתרים נקיים, דפי נחיתה ועמודי רשתות חברתיות לאנשים שרוצים להיראות מקצועיים אונליין.",
      cta1: "התחל", cta2: "צפה במחירים",
    },
    services: {
      eyebrow: "שירותים", title: "בחר מה שאתה צריך", subtitle: "לחץ על כרטיס כדי לראות מה כלול.",
      items: {
        website: { title: "בניית אתרים", items: ["אתרים לעסקים", "אתרי חנות", "אתרי פורטפוליו", "דפי נחיתה"] },
        social: { title: "הקמת רשתות חברתיות", items: ["הקמת עמוד אינסטגרם", "הקמת עמוד טיקטוק", "ביו ומיתוג לפרופיל", "הילייטס / אייקונים / רעיונות לתמונת פרופיל"] },
        full: { title: "הקמה מלאה אונליין", items: ["אתר + רשתות חברתיות", "צבעי מיתוג", "כפתורי יצירת קשר", "הגדרות SEO בסיסיות"] },
      },
    },
    pricing: {
      eyebrow: "מחירים", title: "מחירים פשוטים והוגנים", subtitle: "שלם רק על מה שאתה צריך. שדרג מתי שתרצה.",
      popular: "הכי פופולרי", choose: "בחר חבילה", socialTitle: "הקמת רשתות חברתיות",
      tiers: {
        starter: { name: "אתר התחלתי", features: ["אתר פשוט בעמוד אחד", "מותאם לנייד", "כפתור יצירת קשר", "עיצוב בסיסי", "כולל עמוד אינסטגרם"], excluded: ["ללא כפתור רכישה"] },
        pro: { name: "אתר מקצועי", features: ["מספר עמודים / חלקים", "עיצוב מותאם אישית", "עמוד מחירים / שירותים", "טופס יצירת קשר", "קישורים לרשתות"] },
        full: { name: "מיתוג מלא", features: ["אתר", "הקמת אינסטגרם", "הקמת טיקטוק", "מיתוג / צבעים", "טקסט וביו לפרופיל", "מתאים לעסקים / יוצרי תוכן"] },
      },
      social: { ig: "הקמת אינסטגרם", tt: "הקמת טיקטוק", bundle: "חבילה אינסטגרם + טיקטוק" },
    },
    how: {
      eyebrow: "תהליך", title: "איך זה עובד", subtitle: "מרעיון לאוויר ב-4 שלבים.",
      steps: [
        { title: "בחר מה אתה צריך", desc: "עיין בשירותים ובחר נקודת התחלה." },
        { title: "שלח את הבקשה", desc: "מלא את הטופס עם הפרטים שלך." },
        { title: "אני אצור קשר", desc: "נדבר על היקף, זמנים ומחיר." },
        { title: "אני בונה לך את זה", desc: "אתה מקבל תוצאה נקייה ומוגמרת." },
      ],
    },
    contact: { eyebrow: "בקשה", title: "שלח את הבקשה שלך", subtitle: "ספר לי מה אתה צריך. אחזור אליך תוך 24 שעות." },
    formName: "שם מלא", formEmail: "כתובת Gmail", formPhone: "מספר טלפון", formNeed: "מה אתה צריך?", formPlan: "איזו חבילה אתה רוצה?",
    formDesc: "תאר מה אתה רוצה", formSubmit: "שלח בקשה",
    formThanks: "תודה! הבקשה נשלחה. אחזור אליך בקרוב.",
    needs: { website: "אתר", instagram: "הקמת אינסטגרם", tiktok: "הקמת טיקטוק", onlySocials: "רק רשתות חברתיות", websiteSocials: "אתר + רשתות חברתיות" },
    plans: { starter: "אתר התחלתי", pro: "אתר מקצועי", full: "מיתוג מלא" },
    placeholders: { name: "השם המלא שלך", desc: "סגנון, רפרנסים, תוכן, דדליין..." },
    emailSubject: "בקשה חדשה — NoamWebsites Web Services",
    footer: { tagline: "אתרים והקמת רשתות חברתיות בפשטות.", contactMe: "רוצה ליצור קשר?" },
  },
  ar: {
    nav: { services: "الخدمات", pricing: "الأسعار", how: "كيف يعمل", contact: "تواصل", cta: "ابدأ الآن" },
    hero: {
      badge: "أقبل مشاريع جديدة الآن",
      title1: "احصل على موقع أو إعداد",
      title2: "وسائل تواصل اجتماعي مصمم لك",
      subtitle: "أصمم مواقع نظيفة وصفحات هبوط وصفحات تواصل اجتماعي لمن يريد مظهراً احترافياً على الإنترنت.",
      cta1: "ابدأ الآن", cta2: "عرض الأسعار",
    },
    services: {
      eyebrow: "الخدمات", title: "اختر ما تحتاجه", subtitle: "اضغط على البطاقة لرؤية المحتوى.",
      items: {
        website: { title: "إنشاء مواقع", items: ["مواقع تجارية", "مواقع متاجر", "مواقع أعمال", "صفحات هبوط"] },
        social: { title: "إعداد وسائل التواصل", items: ["إعداد إنستغرام", "إعداد تيك توك", "السيرة والهوية", "هايلايتس / أيقونات / أفكار صورة الملف"] },
        full: { title: "إعداد كامل أونلاين", items: ["موقع + تواصل اجتماعي", "ألوان الهوية", "أزرار التواصل", "إعدادات SEO أساسية"] },
      },
    },
    pricing: {
      eyebrow: "الأسعار", title: "أسعار بسيطة وعادلة", subtitle: "ادفع فقط مقابل ما تحتاجه. حدّث متى شئت.",
      popular: "الأكثر شيوعاً", choose: "اختر الخطة", socialTitle: "إعداد وسائل التواصل",
      tiers: {
        starter: { name: "موقع مبتدئ", features: ["موقع بسيط بصفحة واحدة", "متوافق مع الموبايل", "زر تواصل", "تصميم أساسي", "يشمل صفحة إنستغرام"], excluded: ["بدون زر شراء"] },
        pro: { name: "موقع احترافي", features: ["أقسام / صفحات متعددة", "تصميم مخصص", "صفحة أسعار / خدمات", "نموذج تواصل", "روابط اجتماعية"] },
        full: { name: "إعداد العلامة الكامل", features: ["موقع", "إعداد إنستغرام", "إعداد تيك توك", "هوية / ألوان", "نص وسيرة الملف", "الأفضل للأعمال / المبدعين"] },
      },
      social: { ig: "إعداد إنستغرام", tt: "إعداد تيك توك", bundle: "باقة إنستغرام + تيك توك" },
    },
    how: {
      eyebrow: "العملية", title: "كيف يعمل", subtitle: "من الفكرة إلى الإطلاق في 4 خطوات.",
      steps: [
        { title: "اختر ما تحتاجه", desc: "تصفح الخدمات واختر نقطة البداية." },
        { title: "أرسل طلبك", desc: "املأ النموذج بتفاصيلك." },
        { title: "أتواصل معك", desc: "نتحدث عن النطاق والوقت والسعر." },
        { title: "أبنيه لك", desc: "تستلم نتيجة نظيفة ومكتملة." },
      ],
    },
    contact: { eyebrow: "طلب", title: "أرسل طلبك", subtitle: "أخبرني ما تحتاجه. سأرد خلال 24 ساعة." },
    formName: "الاسم الكامل", formEmail: "عنوان Gmail", formPhone: "رقم الهاتف", formNeed: "ماذا تحتاج؟", formPlan: "ما الخطة التي تريدها؟",
    formDesc: "صف ما تريد", formSubmit: "إرسال الطلب",
    formThanks: "شكراً! تم إرسال طلبك. سأتواصل معك قريباً.",
    needs: { website: "موقع", instagram: "إعداد إنستغرام", tiktok: "إعداد تيك توك", onlySocials: "تواصل اجتماعي فقط", websiteSocials: "موقع + تواصل اجتماعي" },
    plans: { starter: "موقع مبتدئ", pro: "موقع احترافي", full: "إعداد العلامة الكامل" },
    placeholders: { name: "اسمك الكامل", desc: "الأسلوب، المراجع، المحتوى، الموعد النهائي..." },
    emailSubject: "طلب جديد — NoamWebsites Web Services",
    footer: { tagline: "مواقع وإعداد تواصل اجتماعي بكل بساطة.", contactMe: "تريد التواصل؟" },
  },
  ru: {
    nav: { services: "Услуги", pricing: "Цены", how: "Как это работает", contact: "Контакты", cta: "Начать" },
    hero: {
      badge: "Принимаю новые проекты",
      title1: "Получите сайт или настройку",
      title2: "соцсетей под вас",
      subtitle: "Я создаю чистые сайты, лендинги и страницы соцсетей для тех, кто хочет выглядеть профессионально онлайн.",
      cta1: "Начать", cta2: "Посмотреть цены",
    },
    services: {
      eyebrow: "Услуги", title: "Выберите, что вам нужно", subtitle: "Нажмите на карточку, чтобы увидеть детали.",
      items: {
        website: { title: "Создание сайтов", items: ["Сайты для бизнеса", "Сайты магазинов", "Сайты-портфолио", "Лендинги"] },
        social: { title: "Настройка соцсетей", items: ["Настройка Instagram", "Настройка TikTok", "Био и брендинг профиля", "Хайлайты / иконки / идеи аватара"] },
        full: { title: "Полная настройка онлайн", items: ["Сайт + соцсети", "Цвета бренда", "Кнопки связи", "Базовое SEO"] },
      },
    },
    pricing: {
      eyebrow: "Цены", title: "Простые и честные цены", subtitle: "Платите только за то, что нужно. Обновляйте когда хотите.",
      popular: "Популярный", choose: "Выбрать план", socialTitle: "Настройка соцсетей",
      tiers: {
        starter: { name: "Стартовый сайт", features: ["Простой одностраничный сайт", "Адаптивный", "Кнопка связи", "Базовый дизайн", "Включена страница Instagram"], excluded: ["Без кнопки покупки"] },
        pro: { name: "Профессиональный сайт", features: ["Несколько секций / страниц", "Индивидуальный дизайн", "Страница цен / услуг", "Форма связи", "Соцссылки"] },
        full: { name: "Полный бренд", features: ["Сайт", "Настройка Instagram", "Настройка TikTok", "Брендинг / цвета", "Текст и био профиля", "Для бизнеса / авторов"] },
      },
      social: { ig: "Настройка Instagram", tt: "Настройка TikTok", bundle: "Instagram + TikTok вместе" },
    },
    how: {
      eyebrow: "Процесс", title: "Как это работает", subtitle: "От идеи до запуска за 4 шага.",
      steps: [
        { title: "Выберите нужное", desc: "Посмотрите услуги и выберите старт." },
        { title: "Отправьте заявку", desc: "Заполните форму со своими данными." },
        { title: "Я свяжусь с вами", desc: "Обсудим объём, сроки и цену." },
        { title: "Я создам это для вас", desc: "Вы получите чистый готовый результат." },
      ],
    },
    contact: { eyebrow: "Заявка", title: "Отправьте заявку", subtitle: "Расскажите, что вам нужно. Отвечу в течение 24 ч." },
    formName: "Полное имя", formEmail: "Адрес Gmail", formPhone: "Номер телефона", formNeed: "Что вам нужно?", formPlan: "Какой план вы хотите?",
    formDesc: "Опишите, что вы хотите", formSubmit: "Отправить заявку",
    formThanks: "Спасибо! Заявка отправлена. Я скоро свяжусь с вами.",
    needs: { website: "Сайт", instagram: "Instagram", tiktok: "TikTok", onlySocials: "Только соцсети", websiteSocials: "Сайт + соцсети" },
    plans: { starter: "Стартовый сайт", pro: "Профессиональный сайт", full: "Полный бренд" },
    placeholders: { name: "Ваше полное имя", desc: "Стиль, референсы, контент, сроки..." },
    emailSubject: "Новая заявка — NoamWebsites Web Services",
    footer: { tagline: "Сайты и настройка соцсетей — это просто.", contactMe: "Хотите связаться?" },
  },
};
