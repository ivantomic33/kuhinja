import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteTemplateButton } from "@/components/create/DeleteTemplateButton";
import { OfflineCacheSeeder } from "@/components/offline/OfflineCacheSeeder";
import { ShiftChecklist } from "@/components/shift/ShiftChecklist";
import { sr } from "@/lib/i18n/sr";
import { parseChecklistItems } from "@/lib/shift/parse-items";
import { runFromRow } from "@/lib/shift/run";
import { getPlan } from "@/lib/supabase/plan-server";
import { createClient } from "@/lib/supabase/server";

type ShiftPageProps = {
  params: Promise<{ templateId: string }>;
};

export default async function ShiftChecklistPage({ params }: ShiftPageProps) {
  const { templateId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: template, error: templateError } = await supabase
    .from("checklist_templates")
    .select("id, name, venue_id, items")
    .eq("id", templateId)
    .maybeSingle();

  if (templateError && templateError.code !== "22P02") throw templateError;
  if (!template) {
    notFound();
  }

  const [plan, { data: activeRun, error: runError }] = await Promise.all([
    getPlan(),
    supabase
      .from("checklist_runs")
      .select("*")
      .eq("template_id", template.id)
      .eq("user_id", user.id)
      .eq("status", "active")
      .maybeSingle(),
  ]);
  if (runError) throw runError;

  const items = parseChecklistItems(template.items);
  const initialRun = activeRun ? runFromRow(activeRun) : null;

  return (
    <div className="flex flex-col gap-2">
      <OfflineCacheSeeder
        templateDetail={{
          id: template.id,
          name: template.name,
          venue_id: template.venue_id,
          items,
        }}
        templates={[
          {
            id: template.id,
            name: template.name,
            venue_id: template.venue_id,
          },
        ]}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/dashboard"
          className="text-sm text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-[var(--radius-input)]"
        >
          {sr.shift.backToDashboard}
        </Link>
        <DeleteTemplateButton
          templateId={template.id}
          templateName={template.name}
        />
      </div>

      <ShiftChecklist
        templateId={template.id}
        templateName={template.name}
        venueId={template.venue_id}
        userId={user.id}
        plan={plan}
        items={items}
        initialRun={initialRun}
      />
    </div>
  );
}
