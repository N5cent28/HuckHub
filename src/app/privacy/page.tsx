"use client";

import Image from "next/image";
import Link from "next/link";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <Link href="/" className="mr-4 p-2 text-gray-400 hover:text-gray-300" aria-label="Go back">←</Link>
          <Image src="/icon-192x192.png" alt="HuckHub" width={40} height={40} className="mr-4" />
          <h1 className="text-white text-3xl font-bold">Privacy Policy</h1>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8">
          <div className="prose prose-invert max-w-none">
            <h2 className="text-2xl font-bold text-white mb-6">Privacy Policy for HuckHub</h2>
            
            <p className="text-gray-300 mb-4">Last updated: {new Date().toLocaleDateString()}</p>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">1. Information We Collect</h3>
              <p className="text-gray-300 mb-4">We collect the following types of information:</p>
              <ul className="text-gray-300 mb-4 list-disc list-inside space-y-2">
                <li><strong>Account Information:</strong> Email address, password (encrypted)</li>
                <li><strong>Profile Information:</strong> Name, skill level, availability, preferred parks</li>
                <li><strong>Location Data:</strong> Your current location and preferred throwing locations</li>
                <li><strong>Usage Data:</strong> How you interact with the app, seeking sessions, requests</li>
                <li><strong>Communication Data:</strong> Messages sent through the platform</li>
              </ul>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">2. How We Use Your Information</h3>
              <p className="text-gray-300 mb-4">We use your information to:</p>
              <ul className="text-gray-300 mb-4 list-disc list-inside space-y-2">
                <li>Connect you with potential throwing partners</li>
                <li>Show you relevant matches based on location and availability</li>
                <li>Send you notifications about throwing requests</li>
                <li>Improve our service and user experience</li>
                <li>Ensure platform safety and prevent abuse</li>
              </ul>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">3. Information Sharing</h3>
              <p className="text-gray-300 mb-4">
                We share your information only as necessary to provide our service:
              </p>
              <ul className="text-gray-300 mb-4 list-disc list-inside space-y-2">
                <li><strong>With Other Users:</strong> Your name, skill level, and availability are visible to potential matches</li>
                <li><strong>Contact Information:</strong> Email addresses are only shared when both users agree to exchange contact info</li>
                <li><strong>Location Data:</strong> Your general location is used for matching but exact coordinates are not shared</li>
                <li><strong>Service Providers:</strong> We use Supabase for data storage and authentication</li>
              </ul>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">4. Data Security</h3>
              <p className="text-gray-300 mb-4">
                We take reasonable measures to protect your information:
              </p>
              <ul className="text-gray-300 mb-4 list-disc list-inside space-y-2">
                <li>Data is encrypted in transit using HTTPS/TLS</li>
                <li>Data is encrypted at rest using Supabase's security features</li>
                <li>We use secure authentication and authorization</li>
                <li>Access to your data is limited to necessary operations</li>
                <li>We regularly review and update our security practices</li>
              </ul>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">5. Your Rights</h3>
              <p className="text-gray-300 mb-4">You have the right to:</p>
              <ul className="text-gray-300 mb-4 list-disc list-inside space-y-2">
                <li><strong>Access:</strong> View the personal information we have about you</li>
                <li><strong>Correction:</strong> Update or correct your information</li>
                <li><strong>Deletion:</strong> Request deletion of your account and data</li>
                <li><strong>Opt-out:</strong> Unsubscribe from non-essential communications</li>
              </ul>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">6. Data Retention</h3>
              <p className="text-gray-300 mb-4">
                We retain your information for as long as your account is active. When you delete your account, we will remove your personal information within 30 days, except where we are required to retain certain information for legal or safety reasons.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">7. Cookies and Tracking</h3>
              <p className="text-gray-300 mb-4">
                We use essential cookies for authentication and app functionality:
              </p>
              <ul className="text-gray-300 mb-4 list-disc list-inside space-y-2">
                <li><strong>Session Cookies:</strong> Used by Supabase for user authentication and maintaining login state</li>
                <li><strong>Functional Cookies:</strong> Used to remember user preferences and app settings</li>
              </ul>
              <p className="text-gray-300 mb-4">
                We do not use tracking cookies or third-party analytics that collect personal information. You can disable cookies in your browser settings, but this may affect app functionality.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">8. Children's Privacy</h3>
              <p className="text-gray-300 mb-4">
                Our service is not intended for users under 18 years of age. We do not knowingly collect personal information from children under 18.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">9. Changes to This Policy</h3>
              <p className="text-gray-300 mb-4">
                We may update this privacy policy from time to time. We will notify users of significant changes via email or through the app.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">10. Contact Us</h3>
              <p className="text-gray-300 mb-4">
                If you have questions about this privacy policy or want to exercise your rights, please contact us at: noahryannicol@gmail.com
              </p>
            </section>

            <div className="mt-8 p-4 bg-blue-900 border border-blue-700 rounded-lg">
              <p className="text-blue-200 text-sm">
                <strong>Your Privacy Matters:</strong> We are committed to protecting your privacy and being transparent about how we use your information. If you have any concerns, please don't hesitate to contact us.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
