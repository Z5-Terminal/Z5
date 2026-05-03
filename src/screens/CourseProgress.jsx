// Z5 :: Course Progress (BootCamp console) — placeholder for Phase B.
// Will hold the per-trainee × module pass/fail grid, attendance, and
// instructor notes once the course schema lands.

import { useI18n } from "../i18n";
import { PageHeader, Panel } from "../ui";
import { C } from "../theme";

export default function CourseProgress() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        title={t("prog.title")}
        subtitle={t("prog.subtitle")}
      />
      <Panel connectTop>
        <div style={{ color: C.dim, fontSize: 14, lineHeight: 1.6 }}>
          {t("prog.placeholder")}
        </div>
      </Panel>
    </>
  );
}
