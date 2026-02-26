"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";

// Helper: coerce optional numeric input ("" or NaN) to undefined
const optionalNumber = (min: number, max: number) =>
  z.preprocess((val) => {
    if (val === "" || val === undefined || val === null) return undefined;
    const n = typeof val === "string" ? Number(val) : (val as number);
    if (Number.isNaN(n)) return undefined;
    return n;
  }, z.number().min(min).max(max).optional());

const profileSchema = z.object({
  full_name: z.string().min(1, "Name is required"),
  pronouns: z.string().max(32).optional().or(z.literal("")),
  skill_level: z.preprocess((val) => {
    const n = typeof val === "string" ? Number(val) : (val as number);
    return Number.isNaN(n) ? 5 : n;
  }, z.number().min(1).max(10)),
  league_level: z.enum(["none", "mufa", "college", "college/club", "ufa"]),
  radius_miles: optionalNumber(1, 25),
  general_availability: z.record(z.string(), z.array(z.string())).optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;
type InstallGuide = "ios" | "android_chrome" | "other";
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function detectInstallGuide(): InstallGuide {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;

  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isAndroid = /Android/.test(ua);
  const isChrome = /CriOS\//.test(ua) || /Chrome\//.test(ua);

  if (isIOS) return "ios";
  if (isAndroid && isChrome) return "android_chrome";
  return "other";
}

export default function ProfileSetup() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");
  const [installGuide, setInstallGuide] = useState<InstallGuide>("other");
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [deferredInstallPrompt, setDeferredInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      full_name: "",
      pronouns: "",
      skill_level: 5,
      league_level: "none",
      radius_miles: undefined,
    },
  });

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/auth/login");
        return;
      }
      setUserId(user.id);
      setUserEmail(user.email ?? null);

      // Prefill form from existing profile
      const { data: existing } = await supabase
        .from("profiles")
        .select("full_name, pronouns, skill_level, league_level, radius_miles, general_availability")
        .eq("id", user.id)
        .maybeSingle();
      if (existing) {
        if (existing.full_name) setValue("full_name", existing.full_name);
        if (existing.pronouns) setValue("pronouns", existing.pronouns);
        if (existing.skill_level) setValue("skill_level", existing.skill_level);
        if (existing.league_level) setValue("league_level", existing.league_level);
        if (existing.radius_miles !== null && existing.radius_miles !== undefined) {
          // coerce numeric to string/number acceptable by input
          setValue("radius_miles", Number(existing.radius_miles));
        }
        if (existing.general_availability) {
          setValue("general_availability", existing.general_availability as any);
        }
      }
      setLoading(false);
    };
    init();
  }, [router]);

  useEffect(() => {
    setInstallGuide(detectInstallGuide());
  }, []);

  useEffect(() => {
    if (typeof navigator === "undefined" || typeof window === "undefined") return;
    const android = /Android/.test(navigator.userAgent);
    setIsAndroid(android);
    if (!android) return;

    const standaloneByDisplayMode = window.matchMedia("(display-mode: standalone)").matches;
    const standaloneByNavigator = (navigator as any).standalone === true;
    setIsInstalled(standaloneByDisplayMode || standaloneByNavigator);

    const displayModeQuery = window.matchMedia("(display-mode: standalone)");
    const onDisplayModeChange = (event: MediaQueryListEvent) => {
      setIsInstalled(event.matches);
    };

    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const onAppInstalled = () => {
      setDeferredInstallPrompt(null);
      setIsInstalled(true);
    };

    displayModeQuery.addEventListener("change", onDisplayModeChange);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onAppInstalled);
    return () => {
      displayModeQuery.removeEventListener("change", onDisplayModeChange);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
    };
  }, []);

  const handleAndroidInstall = async () => {
    if (!deferredInstallPrompt) {
      alert('Install is not available yet. In Chrome, open the menu (⋮) and tap "Install app" or "Add to Home screen".');
      return;
    }
    await deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    setDeferredInstallPrompt(null);
  };

  const onSubmit = async (form: ProfileForm) => {
    if (!userId) return;
    setMessage("");
    
    // Custom validation for name field
    if (!form.full_name || form.full_name.trim() === "") {
      setMessage("Name required for account setup");
      return;
    }
    
    // Get user's current location to fetch nearby parks
    let preferredParks: any[] = [];
    
    if (form.radius_miles) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false,
            timeout: 5000,
            maximumAge: 300000 // 5 minutes
          });
        });

        const { latitude, longitude } = position.coords;
        
        // Fetch parks within radius
        const response = await fetch(
          `/api/parks/within?lat=${latitude}&lon=${longitude}&radius=${form.radius_miles}`
        );
        const data = await response.json();
        
        if (data.parks) {
          // Convert parks to preferred_parks format
          preferredParks = data.parks.map((park: any) => ({
            id: park.id,
            name: park.name,
            description: park.description,
            coordinates: [park.longitude, park.latitude], // Store as [lon, lat] array
            is_custom: false
          }));
        }
        
        // Update user's last location
        await supabase
          .from("profiles")
          .update({
            last_location: `(${longitude}, ${latitude})`,
            last_location_updated_at: new Date().toISOString()
          })
          .eq("id", userId);
          
      } catch (locationError) {
        console.error("Error getting location for park fetching:", locationError);
        // Continue without location - user can add parks manually later
      }
    }

    const { error } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        email: userEmail ?? undefined,
        full_name: form.full_name,
        pronouns: form.pronouns || null,
        skill_level: form.skill_level,
        league_level: form.league_level,
        radius_miles: form.radius_miles ?? null,
        general_availability: form.general_availability || {},
        preferred_parks: preferredParks, // Always set preferred_parks (empty array if no parks found)
      }, { onConflict: "id" });

    if (error) {
      setMessage(error.message);
      return;
    }
    router.push("/dashboard");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <p className="text-gray-300">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-12 px-4">
      <div className="max-w-2xl mx-auto bg-gray-800 border border-gray-700 rounded-xl p-6 shadow-xl">
        <h1 className="text-2xl font-bold text-white mb-2">Complete your profile</h1>
        <p className="text-gray-300 mb-6">This helps us match you with compatible partners.</p>
        {isAndroid && !isInstalled && (
          <div className="mb-6 rounded-lg border border-green-700 bg-green-900/20 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-green-100">
                Install HuckHub for faster access and push notifications.
              </p>
              <button
                type="button"
                onClick={handleAndroidInstall}
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 px-4 rounded-lg"
              >
                Install HuckHub
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">League level</label>
            <select className="w-full bg-gray-900 border border-gray-600 text-white rounded-md p-2" {...register("league_level")}>
              <option value="none">None</option>
              <option value="mufa">MUFA</option>
              <option value="college/club">College/Club</option>
              <option value="ufa">UFA</option>
            </select>
            {errors.league_level && <p className="text-red-400 text-sm">{errors.league_level.message as string}</p>}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-1">Name</label>
              <input className="w-full bg-gray-900 border border-gray-600 text-white rounded-md p-2" {...register("full_name")} />
              {errors.full_name && <p className="text-red-400 text-sm">{String(errors.full_name.message)}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-1">Pronouns (optional)</label>
              <input className="w-full bg-gray-900 border border-gray-600 text-white rounded-md p-2" {...register("pronouns")} placeholder="e.g. she/her, they/them" />
            </div>
          </div>

          <div className="flex items-end gap-3 mt-4">
            <label className="block text-sm font-medium text-gray-200 mb-1">Radius (miles) <span className="text-gray-400">(optional)</span></label>
            <input type="number" min={1} max={25} step={0.1} placeholder="e.g. 1.5" className="w-full bg-gray-900 border border-gray-600 text-white rounded-md p-2" {...register("radius_miles") } />
            <p className="text-gray-400 text-xs mt-1">All parks within this radius will automatically be added to your favorites.</p>
            {errors.radius_miles && <p className="text-red-400 text-sm">{errors.radius_miles.message as string}</p>}
            <button type="button" onClick={async ()=>{
              if (!navigator.geolocation) return;
              navigator.geolocation.getCurrentPosition(async (pos)=>{
                const r = Number(watch("radius_miles")) || 5;
                const url = `/api/parks/within?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&radius=${r}`;
                const res = await fetch(url);
                const json = await res.json();
                alert(`Parks within ${r} mi:\n` + json.parks.map((p:any)=>`${p.name} (${p.distance_mi.toFixed(2)} mi)`).join('\n'));
              });
            }} className="border border-gray-600 text-gray-200 px-3 py-2 rounded-md">Preview parks</button>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">Throwing level (1-10)</label>
            <input type="range" min={1} max={10} className="w-full" {...register("skill_level")} />
            <div className="text-gray-300 mt-1">Selected: {watch("skill_level")}</div>
            {errors.skill_level && <p className="text-red-400 text-sm">{errors.skill_level.message as string}</p>}
          </div>

          <div className="bg-gray-900 border border-gray-700 rounded-md p-3">
            <details>
              <summary className="cursor-pointer text-sm text-gray-200">How to choose your self‑rated throwing ability</summary>
              <ul className="mt-3 text-gray-300 text-sm space-y-1 list-disc pl-5">
                <li>1 - Just learning how to throw</li>
                <li>2 - Can throw a backhand accurately, but forehand is inconsistent</li>
                <li>3 - Can throw a forehand consistently, but with limited range</li>
                <li>4 - Most throws consistent; at least one accurate forehand deep throw</li>
                <li>5 - Most throws consistent; only one deep throw struggles in no wind</li>
                <li>6 - Can make almost any throw to any distance consistently in no wind</li>
                <li>7 - Can make almost any throw to any distance consistently in medium wind</li>
                <li>8 - Can make almost any throw to any distance consistently against a flat mark</li>
                <li>9 - Can make any throw to any space at any time against a double‑team</li>
                <li>10 - Off‑hand, no‑look passes, and out of a double‑team consistently in medium wind</li>
              </ul>
            </details>
          </div>

          {/* Weekly availability */}
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">Weekly availability (optional)</label>
            <AvailabilityGrid
              value={(watch("general_availability") as any) || {}}
              onChange={(next) => setValue("general_availability", next as any)}
            />
          </div>


          {/* PWA Installation Instructions */}
          <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4 mb-6">
            <h3 className="text-blue-300 font-semibold mb-2 flex items-center">
              📱 Install HuckHub on Your Phone
            </h3>
            <div className="text-sm text-blue-200 space-y-3">
              {installGuide === "ios" && (
                <>
                  <details className="bg-blue-950/30 border border-blue-800 rounded-md p-3">
                    <summary className="cursor-pointer font-semibold text-blue-100">Install on my iPhone</summary>
                    <div className="mt-3 space-y-4">
                      <div className="bg-blue-950/40 border border-blue-800 rounded-md p-2">
                        <p className="text-sm text-blue-100 mb-2 font-medium">Step 1: Tap the menu (⋯) in the top-right.</p>
                        <img src="/Install_images/Chrome_step1.png" alt="Chrome iOS install step 1" className="w-full rounded-md border border-blue-800" />
                      </div>
                      <div className="bg-blue-950/40 border border-blue-800 rounded-md p-2">
                        <p className="text-sm text-blue-100 mb-2 font-medium">Step 2: Tap "Add to Home Screen".</p>
                        <img src="/Install_images/Chrome_step2.png" alt="Chrome iOS install step 2" className="w-full rounded-md border border-blue-800" />
                      </div>
                      <div className="bg-blue-950/40 border border-blue-800 rounded-md p-2">
                        <p className="text-sm text-blue-100 mb-2 font-medium">Step 3: Tap "Add" to finish installation.</p>
                        <img src="/Install_images/Chrome_step3.png" alt="Chrome iOS install step 3" className="w-full rounded-md border border-blue-800" />
                      </div>
                    </div>
                  </details>
                </>
              )}

              {installGuide === "android_chrome" && (
                <>
                  <p><strong>You're on Android Chrome. Follow these steps:</strong></p>
                  <ol className="list-decimal list-inside ml-4 space-y-1">
                    <li>Tap the menu (⋮) in the top-right corner.</li>
                    <li>Tap "Add to Home screen" or "Install app".</li>
                    <li>Tap "Install" or "Add" to confirm.</li>
                  </ol>
                  <p className="text-xs text-blue-100">Android screenshots coming soon.</p>
                </>
              )}

              {installGuide === "other" && (
                <>
                  <p><strong>For install instructions, open HuckHub on your phone:</strong></p>
                  <p>Use Safari on iPhone or Chrome on iPhone/Android for step-by-step install guidance.</p>
                </>
              )}

              <p className="mt-2 text-blue-100">
                <strong>Pro tip:</strong> Installing the app gives you instant push notifications when someone wants to throw!
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="text-gray-300 hover:text-white border border-gray-600 hover:border-gray-500 font-semibold py-2 px-4 rounded-lg"
            >
              Cancel
            </button>
            <button disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg disabled:opacity-50">
              {isSubmitting ? "Saving..." : "Save profile"}
            </button>
          </div>

          {message && <p className="text-red-400 text-center font-medium">{message}</p>}
        </form>
      </div>
    </div>
  );
}

type AvailabilityValue = Record<string, string[]>;

function AvailabilityGrid({ value, onChange }: { value: AvailabilityValue; onChange: (next: AvailabilityValue) => void }) {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const slots = ["Morning", "Afternoon", "Evening"];

  const toggle = (day: string, slot: string) => {
    const daySlots = new Set(value[day] || []);
    if (daySlots.has(slot)) daySlots.delete(slot); else daySlots.add(slot);
    onChange({ ...value, [day]: Array.from(daySlots) });
  };

  return (
    <div className="grid grid-cols-4 gap-2">
      <div></div>
      {slots.map((s) => (
        <div key={s} className="text-center text-xs text-gray-300">{s}</div>
      ))}
      {days.map((d) => (
        <div key={`row-${d}`} className="contents">
          <div className="text-sm text-gray-300 py-1">{d}</div>
          {slots.map((s) => {
            const active = (value[d] || []).includes(s);
            return (
              <button
                key={`${d}-${s}`}
                type="button"
                onClick={() => toggle(d, s)}
                className={`text-xs rounded-md border px-2 py-1 ${active ? "bg-green-600 border-green-500 text-white" : "bg-gray-900 border-gray-600 text-gray-300"}`}
              >
                {active ? "✓" : ""}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}


