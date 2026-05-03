// Z5 :: Evaluations (Recruitment console) — placeholder for Phase C.
// Will hold per-candidate scoring against criteria (shooting / fitness /
// interview / overall) plus free-text instructor notes.

import { useI18n } from "../../i18n";
import { PageHeader, Panel } from "../../ui";
import { C } from "../../theme";

export default function Evaluations() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        title={t("rec.evals.title")}
        subtitle={t("rec.evals.subtitle")}
      />
      <Panel connectTop>
        <div style={{ color: C.dim, fontSize: 14, lineHeight: 1.6 }}>
          {t("rec.placeholder")}
        </div>
      </Panel>
    </>
  );
}
