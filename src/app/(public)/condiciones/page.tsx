import { getPublicCompany } from "@/server/services/public";
import { getPrefs } from "@/server/public-prefs";
import { t } from "@/lib/i18n";

export default async function TermsPage() {
  const [company, { lang }] = await Promise.all([getPublicCompany(), getPrefs()]);
  return (
    <div className="mx-auto max-w-2xl space-y-4 px-5 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">{t(lang, "terms.title")}</h1>
      {company?.terms_text ? <div className="whitespace-pre-wrap text-sm leading-relaxed">{company.terms_text}</div> : <p className="empty">{t(lang, "terms.soon")}</p>}
    </div>
  );
}
