// Z5 :: Course Progress (BootCamp console) — placeholder for Phase B.
// Will hold the per-trainee × module pass/fail grid, attendance, and
// instructor notes once the course schema lands.

import { useI18n } from "../i18n";
import { PageHeader, Panel, EmptyState } from "../ui";

export default function CourseProgress() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader
        title={t("prog.title")}
        subtitle={t("prog.subtitle")}
      />
      <Panel>
        <EmptyState icon="graduation" title={t("console.coming_soon")}>
          {t("prog.placeholder")}
        </EmptyState>
      </Panel>
    </>
  );
}
