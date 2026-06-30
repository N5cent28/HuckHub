"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useCareersAuth } from "@/lib/careers/client";
import { supabase } from "@/lib/supabase";

export default function ThrowingHome() {
  const { authenticated, loading } = useCareersAuth();
  const [showDonationModal, setShowDonationModal] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);

  const handleCopyEmail = async () => {
    try {
      await navigator.clipboard.writeText("noahryannicol@gmail.com");
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy email:", err);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="container mx-auto px-4 py-12">
        <Link
          href="/"
          className="inline-flex items-center text-sm text-gray-400 hover:text-gray-200 mb-8"
        >
          ← All HuckHub
        </Link>

        <div className="text-center">
          <div className="flex justify-center mb-8">
            <Image
              src="/icon-192x192.png"
              alt="HuckHub Logo"
              width={100}
              height={100}
              priority
              className="rounded-full"
            />
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-3">HuckHub Throwing</h1>
          <h2 className="text-lg md:text-xl text-emerald-400/90 mb-6">Madison community throwing</h2>

          <p className="text-lg text-gray-300 mb-10 max-w-2xl mx-auto">
            Find throwing partners for spontaneous tossing at your favorite local parks.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-10 max-w-3xl mx-auto text-left">
            {[
              ["Real-time matching", "Find players looking to throw right now"],
              ["Skill-based pairing", "Match with players at your skill level"],
              ["Park preferences", "Toss at your favorite Madison spots"],
              ["Instant notifications", "Know when someone wants to throw"],
            ].map(([title, desc]) => (
              <div key={title} className="bg-gray-800/80 border border-gray-700 p-5 rounded-lg">
                <h3 className="font-semibold text-white mb-1">{title}</h3>
                <p className="text-gray-400 text-sm">{desc}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {loading ? (
              <p className="text-gray-400 text-sm">Checking sign-in…</p>
            ) : authenticated ? (
              <>
                <Link
                  href="/dashboard"
                  className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors shadow-lg"
                >
                  Go to Dashboard
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    await supabase.auth.signOut();
                  }}
                  className="border-2 border-gray-500 text-gray-300 hover:bg-gray-700 font-semibold py-3 px-8 rounded-lg transition-colors"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/signup?next=/dashboard"
                  className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors shadow-lg"
                >
                  Sign Up
                </Link>
                <Link
                  href="/auth/login?next=/dashboard"
                  className="border-2 border-green-500 text-green-500 hover:bg-green-500 hover:text-white font-semibold py-3 px-8 rounded-lg transition-colors shadow-lg"
                >
                  Login
                </Link>
              </>
            )}
            <button
              onClick={() => setShowDonationModal(true)}
              className="border-2 border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-white font-semibold py-3 px-8 rounded-lg transition-colors shadow-lg"
            >
              Donate
            </button>
          </div>
        </div>
      </div>

      <footer className="bg-gray-800 border-t border-gray-700 py-8 mt-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
          <span className="text-gray-400 text-sm">© 2025 HuckHub</span>
          <div className="flex gap-6 text-sm">
            <Link href="/terms" className="text-gray-400 hover:text-gray-300">
              Terms
            </Link>
            <Link href="/privacy" className="text-gray-400 hover:text-gray-300">
              Privacy
            </Link>
          </div>
        </div>
      </footer>

      {showDonationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white mb-4">Support HuckHub</h3>
              <div className="text-gray-300 mb-6 space-y-3 text-left text-sm">
                <p>
                  Hey! I&apos;m Noah, the creator of HuckHub. Your support covers hosting and helps
                  keep the app improving for Madison&apos;s ultimate community.
                </p>
              </div>
              <div className="space-y-3">
                <a
                  href="https://account.venmo.com/u/Noah-Nicol"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg"
                >
                  Venmo (@Noah-Nicol)
                </a>
                <button
                  onClick={handleCopyEmail}
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-6 rounded-lg"
                >
                  PayPal — noahryannicol@gmail.com
                  {emailCopied && <span className="block text-xs mt-1">Email copied</span>}
                </button>
              </div>
              <button
                onClick={() => setShowDonationModal(false)}
                className="mt-4 text-gray-400 hover:text-gray-300 text-sm underline"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
