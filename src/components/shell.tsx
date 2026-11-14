import { FileText, LayoutDashboard, Library, LogOut, Search, Settings, Upload } from "lucide-react";
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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function Shell({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  return (
    <div className="flex h-full min-h-screen bg-transparent text-ink">
      <aside className="hidden w-[15.5rem] shrink-0 flex-col bg-sidebar text-white lg:flex">
        <div className="flex items-center gap-3 px-4 py-5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-sm font-bold shadow-lg shadow-brand/30">B</div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Buildesk</div>
            <div className="text-[11px] text-sky-100/65">Document Studio</div>
          </div>
        </div>
        <div className="px-3 pb-3">
          <div className="rounded-xl bg-white/5 px-3 py-2 text-[11px] leading-relaxed text-sky-100/70">
            Templates, masters, and generated PDFs in one workspace.
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2">
          <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sky-100/45">Workspace</div>
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                clsx(
                  "group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  isActive ? "bg-white/12 text-white shadow-sm" : "text-sky-100/75 hover:bg-sidebar-hover hover:text-white",
                )
              }
            >
              <link.icon className="h-4 w-4 opacity-90" />
              <span className="font-medium">{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="m-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-brand/90 text-xs font-semibold">
              {initials(user.name) || "U"}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-white">{user.name}</div>
              <div className="truncate text-[11px] capitalize text-sky-100/65">{user.role}</div>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b border-line/80 bg-white/85 px-4 backdrop-blur-md">
          <div className="font-semibold tracking-tight lg:hidden">Document Studio</div>
          <form
            className="mx-auto hidden w-full max-w-xl md:block"
            onSubmit={(event) => {
              event.preventDefault();
              navigate(`/document-studio?q=${encodeURIComponent(query)}`);
            }}
          >
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <input
                aria-label="Search templates"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search templates, categories, or authors"
                className="h-10 w-full rounded-full border border-line bg-canvas/80 pl-10 pr-4 text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
              />
            </label>
          </form>
          <div className="ml-auto flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-line bg-white px-2.5 py-1 sm:flex">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-brand-soft text-[11px] font-semibold text-brand-dark">
                {initials(user.name) || "U"}
              </div>
              <div className="pr-1 text-left">
                <div className="text-xs font-medium leading-tight">{user.name}</div>
                <div className="text-[10px] capitalize text-muted">{user.role}</div>
              </div>
            </div>
            <button
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-line bg-white px-3 text-sm text-muted transition hover:bg-slate-50 hover:text-ink"
              onClick={async () => {
                await client.logout();
                navigate("/login");
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </header>
        <nav className="flex gap-1.5 overflow-auto border-b border-line bg-white/90 px-3 py-2 lg:hidden">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                clsx(
                  "rounded-full px-3.5 py-1.5 text-sm font-medium transition",
                  isActive ? "bg-brand text-white shadow-sm shadow-brand/25" : "bg-canvas text-muted hover:text-ink",
                )
              }
            >
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
