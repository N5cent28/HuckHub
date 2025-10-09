"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Looking() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  const startSeeking = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); setLoading(false); return; }
    const now = new Date();
    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const { error } = await supabase.from("seeking_sessions").insert({
      user_id: user.id,
      time_window_start: now.toISOString(),
      time_window_end: end.toISOString(),
      preferred_parks: [],
      skill_preference: {},
      expires_at: end.toISOString(),
    });
    setLoading(false);
    if (error) { alert(error.message); return; }
    setExpiresAt(end.toISOString());
  };

  const stopSeeking = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); setLoading(false); return; }
    await supabase.from("seeking_sessions").delete().eq("user_id", user.id);
    setExpiresAt(null);
    setLoading(false);
  };

  useEffect(() => {
    const id = setInterval(() => {
      if (!expiresAt) return;
      if (new Date(expiresAt).getTime() <= Date.now()) {
        setExpiresAt(null);
        alert("Your 'looking' status expired. Renew if you're still looking.");
      }
    }, 30000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-12 px-4">
      <div className="max-w-xl mx-auto bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h1 className="text-2xl text-white font-bold mb-4">I'm looking to throw</h1>
        {!expiresAt ? (
          <button disabled={loading} onClick={startSeeking} className="bg-green-600 hover:bg-green-700 text-white font-semibold px-4 py-2 rounded-md disabled:opacity-50">Start for 2 hours</button>
        ) : (
          <div className="space-y-3">
            <p className="text-gray-300">Active until: {new Date(expiresAt).toLocaleTimeString()}</p>
            <div className="flex gap-3">
              <button disabled={loading} onClick={startSeeking} className="border border-green-500 text-green-500 hover:bg-green-600 hover:text-white font-semibold px-4 py-2 rounded-md">Renew 2 hours</button>
              <button disabled={loading} onClick={stopSeeking} className="border border-gray-600 text-gray-300 hover:text-white font-semibold px-4 py-2 rounded-md">Stop</button>
            </div>
          </div>
        )}
        <div className="mt-6">
          <button onClick={()=>router.push("/matches")} className="text-green-400 hover:text-green-300">View matches</button>
        </div>
      </div>
    </div>
  );
}


