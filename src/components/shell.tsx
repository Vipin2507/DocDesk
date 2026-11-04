import { FileText, LayoutDashboard, Library, LogOut, Settings, Upload } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { client, type SessionUser } from "../lib/api";
import { clsx } from "clsx";

const links = [
  { to: "/document-studio", label: "Studio", icon: LayoutDashboard, end: true },
  { to: "/document-studio/masters", label: "Masters", icon: Library, end: false },
  { to: "/document-studio/upload", label: "Upload", icon: Upload, end: false },
  { to: "/document-studio/generated", label: "Generated", icon: FileText, end: false },
  { to: "/document-studio/settings", label: "Settings", icon: Settings, end: false },
];

export function Shell({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  return (
    <div className="flex h-full min-h-screen bg-canvas text-ink">
      <aside className="hidden w-60 shrink-0 flex-col bg-sidebar text-white lg:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm font-bold">B</div>
          <div>
            <div className="text-sm font-semibold">Buildesk</div>
            <div className="text-[11px] text-sky-100/70">Document Studio</div>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
                  isActive ? "bg-white/10 text-white" : "text-sky-100/80 hover:bg-white/5",
                )
              }
            >
              <link.icon className="h-4 w-4" />
              {link.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 p-3 text-xs text-sky-100/70">
          <div className="font-medium text-white">{user.name}</div>
          <div className="capitalize">{user.role}</div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-line bg-white px-4">
          <div className="font-semibold lg:hidden">Document Studio</div>
          <form
            className="mx-auto hidden w-full max-w-md md:block"
            onSubmit={(event) => {
              event.preventDefault();
              navigate(`/document-studio?q=${encodeURIComponent(query)}`);
            }}
          >
            <input
              aria-label="Search templates"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search templates"
              className="h-9 w-full rounded-full border border-line bg-canvas px-4 text-sm outline-none focus:border-brand"
            />
          </form>
          <button
            className="ml-auto inline-flex items-center gap-1 text-sm text-muted"
            onClick={async () => {
              await client.logout();
              navigate("/login");
            }}
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </header>
        <nav className="flex gap-2 overflow-auto border-b border-line bg-white px-3 py-2 lg:hidden">
          {links.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end} className="rounded-full px-3 py-1 text-sm text-muted aria-[current=page]:bg-brand aria-[current=page]:text-white">
              {link.label}
            </NavLink>
          ))}
        </nav>
        <main className="min-h-0 flex-1 overflow-auto">
          <Outlet context={{ user }} />
        </main>
      </div>
    </div>
  );
}
