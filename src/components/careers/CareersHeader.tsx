import Link from "next/link";
import Image from "next/image";

export function CareersHeader({ authenticated }: { authenticated?: boolean }) {
  return (
    <header className="bg-white border-b border-sky-100 shadow-sm sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/careers" className="flex items-center gap-2 min-w-0">
          <Image src="/icon-192x192.png" alt="HuckHub" width={36} height={36} className="rounded-full shrink-0" />
          <div className="min-w-0">
            <div className="font-bold text-sky-900 leading-tight">HuckHub Careers</div>
            <div className="text-xs text-sky-600 truncate">Ultimate community networking</div>
          </div>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3 text-sm shrink-0">
          <Link href="/" className="text-slate-500 hover:text-sky-700 px-2 py-1 hidden sm:inline">
            HuckHub
          </Link>
          <Link href="/throwing" className="text-slate-600 hover:text-sky-700 px-2 py-1 hidden sm:inline">
            Throwing
          </Link>
          {authenticated ? (
            <Link
              href="/careers/me/edit"
              className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg font-medium"
            >
              My profile
            </Link>
          ) : (
            <Link
              href="/auth/login?next=/careers"
              className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg font-medium"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
