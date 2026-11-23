import { getT } from "@/lib/i18n-server";
import { ButtonLink, Card } from "@/components/ui";

export default async function HomePage() {
  const { t } = await getT();
  const features = [
    { icon: "▶", title: t("home.feature.video"), body: t("home.feature.video.body") },
    { icon: "✎", title: t("home.feature.exam"), body: t("home.feature.exam.body") },
    { icon: "✦", title: t("home.feature.tutor"), body: t("home.feature.tutor.body") },
  ];
  return (
    <main>
      <section className="bg-gradient-to-b from-primary-50 to-neutral-50">
        <div className="page py-14 sm:py-20">
          <p className="text-sm font-semibold text-primary-700">{t("app.org")}</p>
          <h1 className="mt-2 max-w-2xl text-3xl font-bold leading-tight text-neutral-900 sm:text-5xl sm:leading-tight">
            {t("home.hero.title")}
          </h1>
          <p className="mt-4 max-w-xl text-lg text-neutral-600">{t("home.hero.body")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/login" size="lg">
              {t("home.hero.cta")}
            </ButtonLink>
            <ButtonLink href="/design" size="lg" variant="secondary">
              {t("home.hero.secondary")}
            </ButtonLink>
          </div>
        </div>
      </section>
      <section className="page grid gap-4 py-10 sm:grid-cols-3">
        {features.map((f) => (
          <Card key={f.title}>
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-100 text-lg text-primary-700" aria-hidden="true">
              {f.icon}
            </div>
            <h2 className="mt-3 text-lg font-semibold text-neutral-900">{f.title}</h2>
            <p className="mt-1 text-neutral-600">{f.body}</p>
          </Card>
        ))}
      </section>
    </main>
  );
}
