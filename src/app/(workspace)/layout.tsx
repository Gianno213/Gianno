import { requireAuth } from "@/lib/auth";
import { Navigation } from "@/components/navigation";
import { ChevronRight, Bell } from "lucide-react";
export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { profile } = await requireAuth();
  return (
    <>
      <Navigation role={profile.role} name={profile.full_name} />
      <div className="workspace">
        <div className="topbar">
          <div className="topbar-crumb">
            Gianno Group <ChevronRight size={12} />{" "}
            <span>People & Culture</span>
          </div>
          <div className="topbar-right">
            <time>
              {new Intl.DateTimeFormat("it-IT", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "Europe/Rome",
              }).format(new Date())}
            </time>
            <span>
              <i className="secure-dot" />
              Area riservata
            </span>
            <Bell size={16} />
          </div>
        </div>
        <main className="content">
          {children}
          <footer className="footer-caption">
            <span>GIANNO PEOPLE · Le persone fanno la differenza.</span>
            <span>Riservato · Gruppo Gianno</span>
          </footer>
        </main>
      </div>
    </>
  );
}
