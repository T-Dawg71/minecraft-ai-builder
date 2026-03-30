import { Header } from "@/components/Header";
import { LayoutShell } from "@/components/LayoutShell";

export default function Home() {
  return (
    <div className="min-h-screen bg-mc-stone-050">
      <Header />
      <LayoutShell>
        <section className="rounded-xl border border-mc-stone-300 bg-white p-5 shadow-sm sm:p-6">
          <h1 className="text-2xl font-semibold tracking-tight text-mc-stone-900 sm:text-3xl">
            Minecraft AI Builder
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-mc-stone-700 sm:text-base">
            This skeleton is ready for prompt refinement, AI image generation, and block
            mapping workflows. Use the left panel to manage project settings and the main area
            to run generation tasks.
          </p>
        </section>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <article className="rounded-xl border border-mc-grass-300 bg-mc-grass-100/70 p-4">
            <h2 className="text-base font-semibold text-mc-grass-900">Prompt Refinement</h2>
            <p className="mt-2 text-sm text-mc-grass-800">
              Convert rough descriptions into Minecraft-friendly image prompts.
            </p>
          </article>

          <article className="rounded-xl border border-mc-dirt-300 bg-mc-dirt-100/60 p-4">
            <h2 className="text-base font-semibold text-mc-dirt-900">Image Generation</h2>
            <p className="mt-2 text-sm text-mc-dirt-800">
              Create concept images using the local Stable Diffusion endpoint.
            </p>
          </article>

          <article className="rounded-xl border border-mc-stone-300 bg-mc-stone-100/90 p-4 sm:col-span-2 xl:col-span-1">
            <h2 className="text-base font-semibold text-mc-stone-900">Block Mapping</h2>
            <p className="mt-2 text-sm text-mc-stone-700">
              Translate image pixels into practical block palettes and structures.
            </p>
          </article>
        </section>
      </LayoutShell>
    </div>
  );
}
