"use client";

import Image from "next/image";
import Link from "next/link";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <Link href="/" className="mr-4 p-2 text-gray-400 hover:text-gray-300" aria-label="Go back">←</Link>
          <Image src="/icon-192x192.png" alt="HuckHub" width={40} height={40} className="mr-4" />
          <h1 className="text-white text-3xl font-bold">Terms of Service</h1>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8">
          <div className="prose prose-invert max-w-none">
            <h2 className="text-2xl font-bold text-white mb-6">Terms of Service for HuckHub</h2>
            
            <p className="text-gray-300 mb-4">Last updated: {new Date().toLocaleDateString()}</p>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">1. Acceptance of Terms</h3>
              <p className="text-gray-300 mb-4">
                By creating an account and using HuckHub, you confirm that you are at least 18 years old and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">2. Description of Service</h3>
              <p className="text-gray-300 mb-4">
                HuckHub is a platform that connects ultimate frisbee players in Madison, Wisconsin, to find throwing partners. We facilitate connections but do not guarantee the safety, reliability, or behavior of other users.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">3. User Responsibilities</h3>
              <ul className="text-gray-300 mb-4 list-disc list-inside space-y-2">
                <li>You are responsible for your own safety when meeting other users</li>
                <li>You must be at least 18 years old to use this service</li>
                <li>You agree to treat other users with respect and follow community guidelines</li>
                <li>You are responsible for the accuracy of information in your profile</li>
                <li>You will not use the service for any illegal or harmful purposes</li>
              </ul>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">4. Safety and Liability</h3>
              <p className="text-gray-300 mb-4">
                <strong>IMPORTANT:</strong> HuckHub facilitates connections between users but does not guarantee the safety of in-person meetings. Users meet at their own risk. We are not responsible for any injuries, damages, or incidents that occur during user interactions.
              </p>
              <p className="text-gray-300 mb-4">
                We strongly recommend following safety guidelines when meeting other users, including meeting in public places, informing others of your plans, and trusting your instincts.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">5. Content and Conduct</h3>
              <p className="text-gray-300 mb-4">
                Users may not post inappropriate, offensive, or harmful content. We reserve the right to remove content and suspend accounts that violate these terms.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">6. Privacy</h3>
              <p className="text-gray-300 mb-4">
                Your privacy is important to us. Please review our Privacy Policy to understand how we collect, use, and protect your information.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">7. Account Termination</h3>
              <p className="text-gray-300 mb-4">
                We reserve the right to suspend or terminate accounts that violate these terms. Users may also delete their accounts at any time.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">8. Changes to Terms</h3>
              <p className="text-gray-300 mb-4">
                We may update these terms from time to time. Continued use of the service constitutes acceptance of any changes.
              </p>
            </section>

            <section className="mb-8">
              <h3 className="text-xl font-semibold text-white mb-4">9. Contact Information</h3>
              <p className="text-gray-300 mb-4">
                If you have questions about these terms, please contact us at: noahryannicol@gmail.com
              </p>
            </section>

            <div className="mt-8 p-4 bg-yellow-900 border border-yellow-700 rounded-lg">
              <p className="text-yellow-200 text-sm">
                <strong>Safety Reminder:</strong> Always prioritize your safety when meeting new people. Meet in public places, tell someone where you're going, and trust your instincts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
