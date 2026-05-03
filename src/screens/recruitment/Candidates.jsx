// Z5 :: Candidates (Recruitment console) — placeholder for Phase C.
// Will list candidates with their pipeline status (applied → screening →
// tryout → offer → onboarded) and link to per-candidate detail screens.

import { useI18n } from "../../i18n";
import { PageHeader, Panel } from "../../ui";
import { C } from "../../theme";

export default function Candidates() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        title={t("rec.candidates.title")}
        subtitle={t("rec.candidates.subtitle")}
      />
      <Panel connectTop>
        <div style={{ color: C.dim, fontSize: 14, lineHeight: 1.6 }}>
          {t("rec.placeholder")}
        </div>
      </Panel>
    </>
  );
}
