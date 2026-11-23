import type { Metadata } from "next";
import { colors, GROUPS, VERSIONS } from "@rupshi/shared";
import { getT } from "@/lib/i18n-server";
import { Header } from "@/components/Header";
import { Badge, Button, Card } from "@/components/ui";
import { OnboardingForm } from "@/app/onboarding/OnboardingForm";

export const metadata: Metadata = { title: "Design system", robots: { index: false } };

function Swatches({ name, scale }: { name: string; scale: Record<string | number, string> }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-neutral-700">{name}</h3>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {Object.entries(scale).map(([step, hex]) => (
          <div key={step} className="text-center text-[11px] text-neutral-600">
            <div className="h-12 rounded-lg border border-neutral-200" style={{ background: hex }} />
            <div className="mt-1 font-semibold">{step}</div>
            <div>{hex}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 border-b border-neutral-200 pb-2 text-xl font-bold text-neutral-900">{title}</h2>
      {children}
    </section>
  );
}

export default async function DesignPage() {
  const { t } = await getT();
  return (
    <main className="page py-10">
      <h1 className="text-3xl font-bold text-neutral-900">Design system · নকশার নিয়ম</h1>
      <p className="mt-2 max-w-2xl text-neutral-600">
        রঙ, font, বোতাম ও Header — Web আর Android App দুটোতেই একই নিয়ম (packages/shared/src/theme.ts)।
      </p>

      <Section title="রঙ · Colours">
        <div className="space-y-6">
          <Swatches name="Primary (flag green)" scale={colors.primary} />
          <Swatches name="Accent (flag red: Live, alerts)" scale={colors.accent} />
          <Swatches name="Highlight (amber)" scale={colors.highlight} />
          <Swatches name="Neutral" scale={colors.neutral} />
        </div>
      </Section>

      <Section title="লেখা · Typography (Hind Siliguri)">
        <div className="space-y-3">
          <p className="text-4xl font-bold">শিরোনাম ৪৮ · Heading</p>
          <p className="text-2xl font-semibold">উপশিরোনাম · Subheading</p>
          <p className="text-lg">
            বাংলা ও English একই font-এ: পাঠ ১ — বাক্য ও বাক্যের প্রকারভেদ। Lesson 1 — Sentences.
          </p>
          <p className="text-sm text-neutral-500">ছোট লেখা · Small text · ০১২৩৪৫৬৭৮৯ 0123456789</p>
        </div>
      </Section>

      <Section title="বোতাম ও চিহ্ন · Buttons and badges">
        <div className="flex flex-wrap items-center gap-3">
          <Button>{t("home.hero.cta")}</Button>
          <Button variant="secondary">{t("home.hero.secondary")}</Button>
          <Button variant="ghost">{t("common.backHome")}</Button>
          <Button variant="danger">● LIVE</Button>
          <Button disabled>Disabled</Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Badge tone="green">পাস</Badge>
          <Badge tone="red">● লাইভ</Badge>
          <Badge tone="amber">{t("common.comingSoon")}</Badge>
          <Badge tone="gray">🔒 {t("common.paidOnly")}</Badge>
        </div>
      </Section>

      <Section title="কার্ড · Cards">
        <div className="grid gap-4 sm:grid-cols-3">
          {["বাংলা ১ম পত্র", "সাধারণ গণিত", "English 1st Paper"].map((s, i) => (
            <Card key={s}>
              <div className="text-xs font-semibold text-primary-700">শ্রেণি ৯ · {t(`version.${VERSIONS[0]}`)}</div>
              <div className="mt-1 text-lg font-semibold">{s}</div>
              <div className="mt-3 h-2 rounded-full bg-neutral-100">
                <div className="h-2 rounded-full bg-primary-500" style={{ width: `${[40, 15, 70][i]}%` }} />
              </div>
              <div className="mt-1 text-xs text-neutral-500">অগ্রগতি</div>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-sm text-neutral-500">
          ভার্সন: {VERSIONS.map((v) => t(`version.${v}`)).join(" · ")} — বিভাগ:{" "}
          {GROUPS.map((g) => t(`group.${g}`)).join(" · ")}
        </p>
      </Section>

      <Section title="Header — শিক্ষার্থী ও শিক্ষক Login করা অবস্থায়">
        <div className="space-y-4">
          <div className="relative z-[2] rounded-card border border-neutral-200">
            <Header user={{ name: "রাফি আহমেদ", role: "student" }} />
          </div>
          <div className="relative z-[1] rounded-card border border-neutral-200">
            <Header user={{ name: "নাসরিন সুলতানা", role: "teacher" }} />
          </div>
        </div>
        <p className="mt-2 text-sm text-neutral-500">ছবির জায়গায় চাপলে নিজের তালিকা খোলে। ছোট পর্দায় মেনু ☰ বোতামে।</p>
      </Section>

      <Section title="ভর্তির ফর্ম (নমুনা) — প্রথমবার Login-এর পর">
        <Card className="max-w-xl p-6">
          <OnboardingForm />
        </Card>
        <p className="mt-2 text-sm text-neutral-500">নবম শ্রেণি বা তার উপরে বাছলে বিভাগের ঘর দেখা যায়। এই নমুনা থেকে জমা দেওয়া যাবে না।</p>
      </Section>
    </main>
  );
}
