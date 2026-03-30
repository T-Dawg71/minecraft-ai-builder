type LayoutShellProps = {
  children: React.ReactNode;
};

export function LayoutShell({ children }: LayoutShellProps) {
  return (
    <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8 lg:py-8">
      <aside className="h-fit rounded-xl border border-mc-stone-300 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-sm font-semibold tracking-wide text-mc-stone-900">Project Controls</h2>
        <ul className="mt-3 space-y-2 text-sm text-mc-stone-700">
          <li className="rounded-md bg-mc-grass-50 px-3 py-2">Prompt settings</li>
          <li className="rounded-md bg-mc-dirt-100/40 px-3 py-2">Image settings</li>
          <li className="rounded-md bg-mc-stone-100 px-3 py-2">Export options</li>
        </ul>
      </aside>

      <main>{children}</main>
    </div>
  );
}
