import type { MessageKey } from "@rupshi/shared";
import { getT } from "@/lib/i18n-server";
import { Badge, ButtonLink, Card } from "./ui";

export async function ComingSoon({ titleKey }: { titleKey: MessageKey }) {
  const { t } = await getT();
  return (
    <main className="page py-12">
      <Card className="mx-auto max-w-xl py-10 text-center">
        <Badge tone="amber">{t("common.comingSoon")}</Badge>
        <h1 className="mt-4 text-2xl font-bold text-neutral-900">{t(titleKey)}</h1>
        <p className="mt-2 text-neutral-600">{t("common.comingSoon.body")}</p>
        <ButtonLink href="/" variant="secondary" className="mt-6">
          {t("common.backHome")}
        </ButtonLink>
      </Card>
    </main>
  );
}
