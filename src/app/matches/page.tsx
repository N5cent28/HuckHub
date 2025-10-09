"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Session = {
  user_id: string;
  expires_at: string;
  profiles: { id: string; full_name?: string | null; pronouns?: string | null; skill_level: number | null; league_level: string | null; general_availability?: Record<string,string[]> | null; radius_miles?: number | null };
};

export default function Matches() {
  const [active, setActive] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [myProfile, setMyProfile] = useState<{skill_level:number|null; radius_miles:number|null; general_availability:any; preferred_parks?: any[]} | null>(null);
  const [fallback, setFallback] = useState<any[]>([]);
  const [fallbackContext, setFallbackContext] = useState<{day?:string;slot?:string}>({});
  const [myUserId, setMyUserId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      // First, get my profile and user ID
      let currentUserId: string | null = null;
      let myProfileData: any = null;
      let accessToken: string | undefined;
      
      try {
        try {
          const { createClient } = await import("@supabase/supabase-js");
          const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);
          const session = (await sb.auth.getSession()).data.session;
          accessToken = session?.access_token;
          console.log('[DEBUG] Access token present:', !!accessToken);
        } catch (e) {
          console.error('[DEBUG] Error getting session:', e);
        }
        const me = await fetch("/api/profile/me", { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} });
        if (me.ok) {
          const mj = await me.json();
          console.log('[DEBUG] Profile response:', mj);
          myProfileData = mj.profile || null;
          currentUserId = mj.profileUserId || null;
          setMyProfile(myProfileData);
          setMyUserId(currentUserId);
        } else {
          console.error('[DEBUG] Profile fetch failed:', me.status, await me.text());
        }
      } catch (e) {
        console.error('[DEBUG] Profile fetch error:', e);
      }

      // fetch active
      const res = await fetch("/api/seeking/active", { 
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} 
      });
      const json = await res.json();
      if (!res.ok) { alert(json.error || "Failed to load"); setLoading(false); return; }
      setActive(json.sessions);

      // Always load fallback suggested profiles (non-active but available now)
      try {
        const f = await fetch("/api/profile/available", { 
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} 
        });
        if (f.ok) {
          const fj = await f.json();
          console.log('[DEBUG] Fallback API response:', fj);
          // remove currently active and myself from fallback list
          const activeIds = new Set((json.sessions || []).map((s:any)=>s.user_id));
          console.log('[DEBUG] Active user IDs:', Array.from(activeIds));
          console.log('[DEBUG] My user ID:', currentUserId);
          const filtered = (fj.profiles || []).filter((p:any)=> !activeIds.has(p.id) && (!currentUserId || p.id !== currentUserId));
          console.log('[DEBUG] Filtered fallback users:', filtered.length, filtered.map(p => p.full_name));
          setFallback(filtered);
          setFallbackContext({ day: fj.day, slot: fj.slot });
        }
      } catch (e) {
        console.error('[DEBUG] Fallback API error:', e);
      }
      setLoading(false);
    };
    load();
  }, []);

  const score = (s: Session) => {
    if (!myProfile) return 0;
    let pts = 0;
    // skill proximity (0..10)
    if (myProfile.skill_level != null && s.profiles?.skill_level != null) {
      const diff = Math.abs(myProfile.skill_level - s.profiles.skill_level);
      const skillPts = 10 - diff;
      pts += skillPts;
      console.debug('[SCORE] active skill', { target: s.profiles?.full_name, my: myProfile.skill_level, theirs: s.profiles.skill_level, diff, skillPts });
    }
    // shared parks bonus (0..10)
    const mineArr = (myProfile.preferred_parks || []) as any[];
    const theirsArr = (s.profiles?.preferred_parks || []) as any[];
    const mine = new Set(mineArr);
    const theirs = new Set(theirsArr);
    let shared = 0; theirs.forEach((v:any)=>{ if (mine.has(v)) shared++; });
    const sharedPts = 2 * Math.min(shared, 5);
    pts += sharedPts;
    console.debug('[SCORE] active parks', { target: s.profiles?.full_name, mine: mineArr, theirs: theirsArr, sharedCount: shared, sharedPts });

    console.debug('[SCORE] active total', { target: s.profiles?.full_name, total: pts });
    return pts;
  };

  const fallbackScore = (p:any) => {
    if (!myProfile) return 0;
    let pts = 0;
    // skill proximity (0..10)
    if (myProfile.skill_level != null && p.skill_level != null) {
      const diff = Math.abs(myProfile.skill_level - p.skill_level);
      const skillPts = 10 - diff;
      pts += skillPts;
      console.debug('[SCORE] skill', { target: p.full_name, my: myProfile.skill_level, theirs: p.skill_level, diff, skillPts });
    }
    // Availability is not part of score; it's a filter in the API

    // shared parks bonus (0..10)
    const mineArr = (myProfile.preferred_parks || []) as any[];
    const theirsArr = (p.preferred_parks || []) as any[];
    const mine = new Set(mineArr);
    const theirs = new Set(theirsArr);
    let shared = 0; theirs.forEach((v:any)=>{ if (mine.has(v)) shared++; });
    const sharedPts = 2 * Math.min(shared, 5);
    pts += sharedPts;
    console.debug('[SCORE] parks', { target: p.full_name, mine: mineArr, theirs: theirsArr, sharedCount: shared, sharedPts });

    console.debug('[SCORE] total', { target: p.full_name, total: pts });
    return pts;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center mb-4">
          <button
            onClick={() => window.history.back()}
            className="mr-4 p-2 text-gray-400 hover:text-gray-300"
            aria-label="Go back"
          >
            ←
          </button>
          <h1 className="text-white text-2xl font-bold">Active seekers</h1>
        </div>
        {loading ? (
          <p className="text-gray-300">Loading...</p>
        ) : (
          <>
            {active.length === 0 ? (
              <p className="text-gray-300">No one is actively looking right now.</p>
            ) : (
              <div className="space-y-3">
                {[...active]
                  .filter((s) => !myUserId || s.user_id !== myUserId) // Filter out current user
                  .sort((a,b)=>score(b)-score(a))
                  .map((s) => {
                    const mine = new Set((myProfile?.preferred_parks || []) as any[]);
                    const theirs = (s.profiles?.preferred_parks || []) as any[];
                    const shared = theirs.filter((x:any)=>mine.has(x)).slice(0,3);
                    return (
                      <div key={(s as any).id || s.user_id+String(Math.random())} className="bg-gray-800 border border-gray-700 rounded-md p-4 flex items-center justify-between">
                        <div>
                          <p className="text-white font-semibold">{s.profiles?.full_name || `User ${s.user_id.slice(0,8)}...`}{s.profiles?.pronouns ? ` (${s.profiles?.pronouns})` : ""}</p>
                          <p className="text-gray-300 text-sm">Throwing level: {s.profiles?.skill_level ?? "—"} • League: {s.profiles?.league_level ?? "—"}</p>
                          {shared.length > 0 && (
                            <p className="text-gray-400 text-xs mt-1">Shared parks: {shared.join(", ")}</p>
                          )}
                          <p className="text-gray-400 text-xs">Match score: {score(s)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <RequestButton targetId={s.user_id} seekingSessionId={(s as any).id} />
                          <UserActions targetId={s.user_id} targetName={s.profiles?.full_name || 'User'} />
                          <div className="text-gray-400 text-sm">expires in {Math.max(0, Math.ceil((new Date(s.expires_at).getTime() - Date.now()) / (1000 * 60)))} minutes</div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}

            {/* Fallback suggestions should always render below active section */}
            {fallback.length > 0 && (
              <div className="mt-8">
                <p className="text-gray-300 mb-2">Also consider these people who might be available nearby ({fallbackContext.day} {fallbackContext.slot}):</p>
                {fallback.sort((a,b)=>fallbackScore(b)-fallbackScore(a)).slice(0,10).map((p:any)=> {
                  const mine = new Set((myProfile?.preferred_parks || []) as any[]);
                  const theirs = (p.preferred_parks || []) as any[];
                  const shared = theirs.filter((x:any)=>mine.has(x)).slice(0,3);
                  return (
                    <div key={p.id} className="bg-gray-800 border border-gray-700 rounded-md p-4 flex items-center justify-between mb-3">
                      <div>
                        <p className="text-white font-semibold">{p.full_name || `User ${p.id.slice(0,8)}...`}{p.pronouns ? ` (${p.pronouns})` : ""}</p>
                        <p className="text-gray-300 text-sm">Throwing level: {p.skill_level ?? "—"} • League: {p.league_level ?? "—"}</p>
                        {shared.length > 0 && (
                          <p className="text-gray-400 text-xs mt-1">Shared parks: {shared.join(", ")}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <RequestButton targetId={p.id} />
                        <UserActions targetId={p.id} targetName={p.full_name || 'User'} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function RequestButton({ targetId, seekingSessionId }: { targetId: string; seekingSessionId?: string }) {
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  
  const send = async (notificationType: 'email' | 'push') => {
    if (!msg.trim()) {
      alert("Please enter a message");
      return;
    }

    setSending(true);
    try {
      // Attach Supabase access token for server auth
      let accessToken: string | undefined;
      try {
        const { createClient } = await import("@supabase/supabase-js");
        const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);
        const session = (await sb.auth.getSession()).data.session;
        accessToken = session?.access_token;
      } catch {}

      const res = await fetch("/api/requests/create", { 
        method: "POST", 
        headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) }, 
        body: JSON.stringify({ targetId, seekingSessionId, message: msg, notificationType }) 
      });
      const j = await res.json();
      if (!res.ok) { 
        alert(j.error || "Failed to send"); 
        return; 
      }
      
      if (j.success) {
        alert(`${notificationType === 'email' ? 'Email' : 'Push notification'} sent!`);
        setOpen(false);
        setMsg("");
      } else {
        alert(j.message || "Failed to send");
      }
    } catch (error) {
      alert("Failed to send request");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="relative">
      <button onClick={()=>setOpen(true)} className="p-1 rounded-md hover:bg-gray-700">
        <Image src="/icon-24x24.ico" alt="request" width={24} height={24} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 bg-gray-900 border border-gray-700 rounded-md p-3 w-64 z-10">
          <p className="text-sm text-white mb-2">Personalize your request</p>
          <textarea className="w-full bg-gray-800 border border-gray-600 text-white rounded-md p-2 text-sm" rows={3} value={msg} onChange={(e)=>setMsg(e.target.value)} placeholder="Hey! Want to throw at Vilas around 5?" />
          <div className="flex justify-between gap-2 mt-2">
            <button onClick={()=>setOpen(false)} className="text-gray-300 border border-gray-600 px-2 py-1 rounded-md text-sm">Cancel</button>
            <div className="flex gap-1">
              <button 
                onClick={() => send('email')} 
                disabled={sending}
                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-2 py-1 rounded-md text-sm"
              >
                {sending ? "..." : "Email"}
              </button>
              <button 
                onClick={() => send('push')} 
                disabled={sending}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-2 py-1 rounded-md text-sm"
              >
                {sending ? "..." : "Push"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserActions({ targetId, targetName }: { targetId: string; targetName: string }) {
  const [showActions, setShowActions] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [blockReason, setBlockReason] = useState("");
  const [reportReason, setReportReason] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [contactInfo, setContactInfo] = useState<any>(null);

  const handleBlock = async () => {
    let accessToken: string | undefined;
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);
      const session = (await sb.auth.getSession()).data.session;
      accessToken = session?.access_token;
    } catch {}

    const res = await fetch("/api/users/block", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: JSON.stringify({ targetId, reason: blockReason || null })
    });
    
    if (res.ok) {
      alert("User blocked successfully");
      setShowBlockModal(false);
      setBlockReason("");
    } else {
      const error = await res.json();
      alert(error.error || "Failed to block user");
    }
  };

  const handleReport = async () => {
    if (!reportReason) {
      alert("Please select a reason for reporting");
      return;
    }

    let accessToken: string | undefined;
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);
      const session = (await sb.auth.getSession()).data.session;
      accessToken = session?.access_token;
    } catch {}

    const res = await fetch("/api/users/report", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: JSON.stringify({ targetId, reason: reportReason, description: reportDescription || null })
    });
    
    if (res.ok) {
      alert("Report submitted successfully");
      setShowReportModal(false);
      setReportReason("");
      setReportDescription("");
    } else {
      const error = await res.json();
      alert(error.error || "Failed to submit report");
    }
  };

  const handleContactShare = async () => {
    let accessToken: string | undefined;
    try {
      const { createClient } = await import("@supabase/supabase-js");
      const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string);
      const session = (await sb.auth.getSession()).data.session;
      accessToken = session?.access_token;
    } catch {}

    const res = await fetch("/api/contact/share", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
      body: JSON.stringify({ targetId })
    });
    
    if (res.ok) {
      const data = await res.json();
      setContactInfo(data);
      setShowContactModal(true);
    } else {
      const error = await res.json();
      alert(error.error || "Failed to get contact info");
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setShowActions(!showActions)} 
        className="p-1 rounded-md hover:bg-gray-700 text-gray-400 hover:text-white"
        title="More actions"
      >
        ⋯
      </button>
      
      {showActions && (
        <div className="absolute right-0 mt-2 bg-gray-900 border border-gray-700 rounded-md p-2 w-48 z-20">
          <button 
            onClick={() => { handleContactShare(); setShowActions(false); }}
            className="w-full text-left px-3 py-2 text-sm text-green-400 hover:bg-gray-800 rounded"
          >
            View Contact Info
          </button>
          <button 
            onClick={() => { setShowBlockModal(true); setShowActions(false); }}
            className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-gray-800 rounded"
          >
            Block {targetName}
          </button>
          <button 
            onClick={() => { setShowReportModal(true); setShowActions(false); }}
            className="w-full text-left px-3 py-2 text-sm text-yellow-400 hover:bg-gray-800 rounded"
          >
            Report {targetName}
          </button>
        </div>
      )}

      {/* Block Modal */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-white mb-4">Block {targetName}</h3>
            <p className="text-gray-300 mb-4">This user will no longer appear in your matches and cannot send you requests.</p>
            <div className="mb-4">
              <label className="block text-sm text-gray-200 mb-2">Reason (optional)</label>
              <select 
                value={blockReason} 
                onChange={(e) => setBlockReason(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 text-white rounded-md p-2"
              >
                <option value="">Select a reason</option>
                <option value="inappropriate_behavior">Inappropriate behavior</option>
                <option value="spam">Spam or harassment</option>
                <option value="safety_concerns">Safety concerns</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowBlockModal(false)}
                className="px-4 py-2 text-gray-300 border border-gray-600 rounded-md hover:bg-gray-700"
              >
                Cancel
              </button>
              <button 
                onClick={handleBlock}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md"
              >
                Block User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-white mb-4">Report {targetName}</h3>
            <div className="mb-4">
              <label className="block text-sm text-gray-200 mb-2">Reason *</label>
              <select 
                value={reportReason} 
                onChange={(e) => setReportReason(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 text-white rounded-md p-2"
                required
              >
                <option value="">Select a reason</option>
                <option value="inappropriate_behavior">Inappropriate behavior</option>
                <option value="harassment">Harassment or bullying</option>
                <option value="spam">Spam or fake profile</option>
                <option value="safety_concerns">Safety concerns</option>
                <option value="inappropriate_content">Inappropriate content</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-gray-200 mb-2">Additional details (optional)</label>
              <textarea 
                value={reportDescription} 
                onChange={(e) => setReportDescription(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 text-white rounded-md p-2 h-20"
                placeholder="Please provide more details about the issue..."
              />
            </div>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setShowReportModal(false)}
                className="px-4 py-2 text-gray-300 border border-gray-600 rounded-md hover:bg-gray-700"
              >
                Cancel
              </button>
              <button 
                onClick={handleReport}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-md"
              >
                Submit Report
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contact Sharing Modal */}
      {showContactModal && contactInfo && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 w-96">
            <h3 className="text-lg font-semibold text-white mb-4">Contact Information</h3>
            
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-200 mb-2">Your Contact Info:</h4>
                <div className="bg-gray-900 p-3 rounded-md">
                  <p className="text-white">{contactInfo.requester.name}</p>
                  {contactInfo.requester.email && (
                    <p className="text-gray-300 text-sm">{contactInfo.requester.email}</p>
                  )}
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-medium text-gray-200 mb-2">{targetName}'s Contact Info:</h4>
                <div className="bg-gray-900 p-3 rounded-md">
                  <p className="text-white">{contactInfo.target.name}</p>
                  {contactInfo.target.email ? (
                    <p className="text-gray-300 text-sm">{contactInfo.target.email}</p>
                  ) : (
                    <p className="text-gray-500 text-sm">Email not shared</p>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 mt-6">
              <button 
                onClick={() => setShowContactModal(false)}
                className="px-4 py-2 text-gray-300 border border-gray-600 rounded-md hover:bg-gray-700"
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


