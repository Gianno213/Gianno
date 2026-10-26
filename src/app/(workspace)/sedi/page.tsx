import { MapPin, Users, Plus } from "lucide-react";
import { createLocation } from "@/app/actions";
import { workspaceData } from "@/components/data";
import {
  PageHeader,
  Card,
  Empty,
  Field,
  Submit,
  Badge,
  Feedback,
} from "@/components/ui";
export default async function Locations({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { data, profile } = await workspaceData(["locations", "employees"]);
  return (
    <>
      <PageHeader
        eyebrow="IL NOSTRO TERRITORIO"
        title="Punti vendita"
        description="Una sola squadra, in ogni sede."
      />
      <Feedback params={params} />
      <div className="grid-two">
        {(data.locations || []).map((l) => (
          <Card title={l.name} key={l.id}>
            <div className="card-body">
              <p
                className="muted"
                style={{ display: "flex", gap: 8, marginBottom: 20 }}
              >
                <MapPin size={15} />
                {l.address || "Indirizzo non inserito"}
              </p>
              <div className="section-title">
                <span className="muted">
                  <Users
                    size={14}
                    style={{ display: "inline", marginRight: 6 }}
                  />
                  {
                    (data.employees || []).filter(
                      (e) => e.location_id === l.id && e.status === "attivo",
                    ).length
                  }{" "}
                  collaboratori attivi
                </span>
                <Badge tone={l.active ? "success" : "neutral"}>
                  {l.active ? "Attiva" : "Non attiva"}
                </Badge>
              </div>
              <p className="muted">
                ID per importazioni: <code>{l.id}</code>
              </p>
            </div>
          </Card>
        ))}
      </div>
      {!data.locations?.length && (
        <Card>
          <Empty
            title="Ogni progetto parte da un luogo"
            description="Aggiungi il primo punto vendita per iniziare a organizzare i collaboratori."
          />
        </Card>
      )}
      {profile?.role === "direzione" && (
        <Card title="Aggiungi un punto vendita" className="mt-6">
          <form action={createLocation} className="card-body">
            <input type="hidden" name="return_to" value="/sedi" />
            <div className="form-grid">
              <Field label="Nome della sede">
                <input
                  name="name"
                  placeholder="Es. Gianno Centro"
                  required
                  maxLength={120}
                />
              </Field>
              <Field label="Indirizzo">
                <input name="address" maxLength={300} />
              </Field>
            </div>
            <div className="form-actions">
              <Submit>
                <Plus size={15} />
                Crea punto vendita
              </Submit>
            </div>
          </form>
        </Card>
      )}
    </>
  );
}
