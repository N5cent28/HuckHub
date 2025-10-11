"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";
import Link from "next/link";

export default function SignUp() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [ageVerified, setAgeVerified] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    if (!ageVerified || !termsAccepted) {
      setMessage("Please confirm you are 18+ and accept our terms to continue");
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });

      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Check your email for the confirmation link!");
      }
    } catch (error) {
      setMessage("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="flex justify-center">
            <Image
              src="/icon-192x192.png"
              alt="HuckHub Logo"
              width={80}
              height={80}
              className="rounded-full"
            />
          </div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-white">
            Sign up for HuckHub
          </h2>
          <p className="mt-2 text-center text-sm text-gray-300">
            Join the Madison community throwing
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSignUp}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 bg-gray-800 placeholder-gray-400 text-white rounded-t-md focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-600 bg-gray-800 placeholder-gray-400 text-white rounded-b-md focus:outline-none focus:ring-green-500 focus:border-green-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {message && (
            <div className={`text-sm ${message.includes("Check your email") ? "text-green-400" : "text-red-400"}`}>
              {message}
            </div>
          )}

          {/* Age Verification and Terms */}
          <div className="space-y-4">
            <div className="flex items-start">
              <input
                id="age-verification"
                type="checkbox"
                checked={ageVerified}
                onChange={(e) => setAgeVerified(e.target.checked)}
                className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-600 bg-gray-800 rounded"
              />
              <label htmlFor="age-verification" className="ml-3 text-sm text-gray-300">
                I confirm that I am at least 18 years old
              </label>
            </div>

            <div className="flex items-start">
              <input
                id="terms-acceptance"
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 h-4 w-4 text-green-600 focus:ring-green-500 border-gray-600 bg-gray-800 rounded"
              />
              <label htmlFor="terms-acceptance" className="ml-3 text-sm text-gray-300">
                I have read and agree to the{" "}
                <Link href="/terms" className="text-green-400 hover:text-green-300 underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="/privacy" className="text-green-400 hover:text-green-300 underline">
                  Privacy Policy
                </Link>
              </label>
            </div>
          </div>

          {/* Safety Guidelines */}
          <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4">
            <h3 className="text-yellow-200 font-semibold mb-2">🛡️ Safety Guidelines</h3>
            <p className="text-yellow-200 text-sm mb-2">When meeting other users for throwing:</p>
            <ul className="text-yellow-200 text-sm list-disc list-inside space-y-1">
              <li>Meet in public parks during daylight hours</li>
              <li>Tell someone where you're going</li>
              <li>Trust your instincts - if something feels wrong, leave</li>
              <li>Report any inappropriate behavior immediately</li>
            </ul>
            <p className="text-yellow-200 text-xs mt-2">
              By creating an account, you acknowledge these safety guidelines and understand that you meet other users at your own risk.
            </p>
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
            >
              {loading ? "Signing up..." : "Sign up"}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-300">
              Already have an account?{" "}
              <Link href="/auth/login" className="font-medium text-green-400 hover:text-green-300">
                Sign in
              </Link>
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
