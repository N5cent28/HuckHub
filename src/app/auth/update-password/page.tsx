"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function UpdatePassword() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // Ensure the recovery session is established when landing from the email link
    const establishSession = async () => {
      try {
        const hash = window.location.hash; // e.g. #access_token=...&type=recovery
        if (hash && hash.includes('access_token')) {
          const params = new URLSearchParams(hash.substring(1));
          const access_token = params.get('access_token') || undefined;
          const refresh_token = params.get('refresh_token') || undefined;
          const type = params.get('type');
          if (type === 'recovery' && access_token && refresh_token) {
            await supabase.auth.setSession({ access_token, refresh_token });
          }
        }
      } catch {}
    };
    establishSession();
  }, []);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (password.length < 8) { setMessage("Password must be at least 8 characters"); return; }
    if (password !== confirm) { setMessage("Passwords do not match"); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage(error.message);
      } else {
        setMessage("Password updated. Redirecting to sign in...");
        setTimeout(() => router.push("/auth/login"), 1200);
      }
    } catch {
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
          <h1 className="mt-4 text-2xl font-bold text-white">Set a new password</h1>
          <p className="text-gray-300 text-sm mt-1">Enter and confirm your new password.</p>
        </div>

        <form className="space-y-4" onSubmit={handleUpdate}>
          <div>
            <label htmlFor="password" className="block text-sm text-gray-300 mb-1">New password</label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label htmlFor="confirm" className="block text-sm text-gray-300 mb-1">Confirm password</label>
            <input
              id="confirm"
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-600 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>

          {message && <div className="text-sm text-gray-200">{message}</div>}

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md disabled:opacity-50"
          >
            {loading ? "Updating..." : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}


