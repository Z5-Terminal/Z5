// Z5 :: Pipeline (Recruitment console) — placeholder for Phase C.
// Will show the recruitment-scoped calendar of interviews, tryouts and
// other candidate-facing events.

import { useI18n } from "../../i18n";
import { PageHeader, Panel } from "../../ui";
import { C } from "../../theme";

export default function Pipeline() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        title={t("rec.pipeline.title")}
        subtitle={t("rec.pipeline.subtitle")}
      />
      <Panel connectTop>
        <div style={{ color: C.dim, fontSize: 14, lineHeight: 1.6 }}>
          {t("rec.placeholder")}
        </div>
      </Panel>
    </>
  );
}
