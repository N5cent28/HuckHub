"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function CustomLocation() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [coords, setCoords] = useState<{ lat?: number; lon?: number }>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const useMyLocation = () => {
    navigator.geolocation.getCurrentPosition((pos) => {
      setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    }, () => setMessage("Unable to get location"));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/auth/login"); return; }
    const { error } = await supabase.from("custom_locations").insert({
      user_id: user.id,
      name,
      description: desc,
      coordinates: `(${coords.lon},${coords.lat})`,
      is_approved: false,
    });
    if (error) setMessage(error.message); else router.push("/dashboard");
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-12 px-4">
      <div className="max-w-xl mx-auto bg-gray-800 border border-gray-700 rounded-xl p-6">
        <h1 className="text-white text-2xl font-bold mb-4">Submit a custom throwing location</h1>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-200 mb-1">Location name</label>
            <input className="w-full bg-gray-900 border border-gray-600 text-white rounded-md p-2" value={name} onChange={(e)=>setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-sm text-gray-200 mb-1">Description (optional)</label>
            <textarea className="w-full bg-gray-900 border border-gray-600 text-white rounded-md p-2" value={desc} onChange={(e)=>setDesc(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={useMyLocation} className="border border-gray-600 text-gray-200 px-3 py-2 rounded-md">Use my current location</button>
            <span className="text-gray-400 text-sm">{coords.lat && coords.lon ? `${coords.lat.toFixed(5)}, ${coords.lon.toFixed(5)}` : "no coordinates yet"}</span>
          </div>
          {message && <p className="text-red-400 text-sm">{message}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={()=>router.push("/dashboard")} className="text-gray-300 border border-gray-600 px-4 py-2 rounded-md">Cancel</button>
            <button disabled={loading || !name || !coords.lat} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md disabled:opacity-50">Submit</button>
          </div>
        </form>
      </div>
    </div>
  );
}


