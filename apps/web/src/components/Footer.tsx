import { getT } from "@/lib/i18n-server";
import { toBanglaDigits } from "@rupshi/shared";

export async function Footer() {
  const { t, locale } = await getT();
  const year = new Date().getFullYear();
  return (
    <footer className="mt-16 border-t border-neutral-200 bg-white">
      <div className="page flex flex-col gap-1 py-6 text-sm text-neutral-500 sm:flex-row sm:justify-between">
        <span>
          © {locale === "bn" ? toBanglaDigits(year) : year} {t("app.org")}. {t("footer.rights")}
        </span>
        <span>{t("app.name")}</span>
      </div>
    </footer>
  );
}
