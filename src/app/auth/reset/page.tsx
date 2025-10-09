"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

export default function ResetPassword() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const redirectTo = `${process.env.NEXT_PUBLIC_APP_URL || "https://huckhub.netlify.app"}/auth/update-password`;
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Check your email for a link to reset your password.");
      }
    } catch (err) {
      setMessage("Unexpected error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <Image src="/icon-192x192.png" alt="HuckHub Logo" width={64} height={64} className="mx-auto rounded-full" />
          <h1 className="mt-4 text-2xl font-bold text-white">Reset your password</h1>
          <p className="text-gray-300 text-sm mt-1">Enter your account email and we’ll send a reset link.</p>
        </div>

        <form className="space-y-4" onSubmit={handleSend}>
          <div>
            <label htmlFor="email" className="block text-sm text-gray-300 mb-1">Email</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="you@example.com"
            />
          </div>

          {message && <div className="text-sm text-gray-200">{message}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50"
          >
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>

        <div className="text-center">
          <Link href="/auth/login" className="text-sm text-green-400 hover:text-green-300">Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}


