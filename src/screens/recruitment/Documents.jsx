// Z5 :: Documents (Recruitment console) — placeholder for Phase C.
// Will manage candidate document uploads (CV / ID / medical) backed by a
// private Supabase Storage bucket named 'recruitment'.

import { useI18n } from "../../i18n";
import { PageHeader, Panel } from "../../ui";
import { C } from "../../theme";

export default function Documents() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        title={t("rec.docs.title")}
        subtitle={t("rec.docs.subtitle")}
      />
      <Panel connectTop>
        <div style={{ color: C.dim, fontSize: 14, lineHeight: 1.6 }}>
          {t("rec.placeholder")}
        </div>
      </Panel>
    </>
  );
}
