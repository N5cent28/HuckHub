"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import Image from "next/image";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Auth callback error:", error);
          router.push("/auth/login?error=callback_error");
          return;
        }

        if (data.session) {
          // Check if user has a profile
          const { data: profile } = await supabase
            .from("profiles")
            .select("id")
            .eq("id", data.session.user.id)
            .maybeSingle();

          // Ensure profile exists with email prefilled
          if (!profile) {
            await supabase.from("profiles").insert({
              id: data.session.user.id,
              email: data.session.user.email,
            }).eq("id", data.session.user.id);
          }

          if (profile) router.push("/dashboard");
          else router.push("/profile/setup");
        } else {
          router.push("/auth/login");
        }
      } catch (error) {
        console.error("Unexpected error:", error);
        router.push("/auth/login?error=unexpected_error");
      }
    };

    handleAuthCallback();
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <Image
            src="/icon-192x192.png"
            alt="HuckHub Logo"
            width={60}
            height={60}
            className="rounded-full"
          />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">
          Confirming your account...
        </h2>
        <p className="text-gray-300">
          Please wait while we verify your email address.
        </p>
      </div>
    </div>
  );
}
