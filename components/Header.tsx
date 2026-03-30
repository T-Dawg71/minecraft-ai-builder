import Link from "next/link";

const navItems = [
  { href: "#overview", label: "Overview" },
  { href: "#generator", label: "Generator" },
  { href: "#export", label: "Export" },
];

export function Header() {
  return (
    <header className="border-b border-mc-stone-300 bg-mc-stone-100/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <span className="inline-flex size-7 items-center justify-center rounded-md bg-mc-grass-700 text-sm font-bold text-white">
            MB
          </span>
          <span className="text-sm font-semibold tracking-wide text-mc-stone-900 sm:text-base">
            Minecraft AI Builder
          </span>
        </Link>

        <nav aria-label="Primary navigation" className="hidden items-center gap-1 sm:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm font-medium text-mc-stone-700 transition-colors hover:bg-mc-grass-100 hover:text-mc-grass-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          type="button"
          className="inline-flex rounded-md border border-mc-stone-300 bg-white px-3 py-2 text-sm font-medium text-mc-stone-800 shadow-sm transition-colors hover:bg-mc-stone-50 sm:hidden"
          aria-label="Open navigation"
        >
          Menu
        </button>
      </div>
    </header>
  );
}
