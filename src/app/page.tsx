import Image from "next/image";
import Link from "next/link";
import { Disc, Briefcase } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-10 max-w-lg">
          <Image
            src="/icon-192x192.png"
            alt="HuckHub"
            width={88}
            height={88}
            priority
            className="rounded-full mx-auto mb-5"
          />
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">HuckHub</h1>
          <p className="text-slate-400 mt-2 text-sm md:text-base">
            Ultimate community tools for the field and beyond
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 w-full max-w-4xl">
          <Link
            href="/throwing"
            className="group relative overflow-hidden rounded-2xl border border-emerald-800/60 bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950 p-8 md:p-10 transition-all hover:border-emerald-500/50 hover:shadow-lg hover:shadow-emerald-900/20"
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="p-3 rounded-xl bg-emerald-500/15 text-emerald-400">
                <Disc className="h-8 w-8" />
              </div>
              <span className="text-emerald-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Enter →
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Throwing</h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              Find throwing partners in Madison&apos;s ultimate community. Match by skill, park,
              and availability — then get out and toss.
            </p>
            <ul className="text-slate-400 text-xs space-y-1">
              <li>Real-time partner matching</li>
              <li>Park preferences &amp; notifications</li>
              <li>Free account required</li>
            </ul>
          </Link>

          <Link
            href="/careers"
            className="group relative overflow-hidden rounded-2xl border border-sky-800/50 bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 p-8 md:p-10 transition-all hover:border-sky-400/50 hover:shadow-lg hover:shadow-sky-900/20"
          >
            <div className="flex items-start justify-between gap-4 mb-6">
              <div className="p-3 rounded-xl bg-sky-500/15 text-sky-400">
                <Briefcase className="h-8 w-8" />
              </div>
              <span className="text-sky-400 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                Browse →
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Careers</h2>
            <p className="text-slate-300 text-sm leading-relaxed mb-4">
              Discover what ultimate players do off the field. Search by career, city, or name —
              and connect through shared community ties.
            </p>
            <ul className="text-slate-400 text-xs space-y-1">
              <li>Search the ultimate career network</li>
              <li>No account needed to browse</li>
              <li>Sign in to view names &amp; LinkedIn</li>
            </ul>
          </Link>
        </div>
      </main>

      <footer className="border-t border-slate-800 py-6 px-4">
        <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
          <span>© 2025 HuckHub</span>
          <div className="flex gap-5">
            <Link href="/terms" className="hover:text-slate-300">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-slate-300">
              Privacy
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
