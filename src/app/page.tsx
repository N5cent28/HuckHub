"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

export default function Home() {
  const [showDonationModal, setShowDonationModal] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          {/* Logo */}
          <div className="flex justify-center mb-8">
            <Image
              src="/icon-192x192.png"
              alt="HuckHub Logo"
              width={120}
              height={120}
              priority
              className="rounded-full"
            />
          </div>
          
          {/* Main heading */}
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">
            HuckHub
          </h1>
          <h2 className="text-xl md:text-2xl text-gray-300 mb-8">
            Madison community throwing
          </h2>
          
          {/* Description */}
          <p className="text-lg text-gray-300 mb-12 max-w-2xl mx-auto">
            Find throwing partners for spontaneous tossing at your favorite local parks!
          </p>
          
          {/* Features */}
          <div className="grid md:grid-cols-2 gap-6 mb-12 max-w-4xl mx-auto">
            <div className="bg-gray-800 border border-gray-700 p-6 rounded-lg shadow-lg">
              <h3 className="font-semibold text-lg mb-2 text-white">Real-time Matching</h3>
              <p className="text-gray-300">Find players looking to throw right now</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 p-6 rounded-lg shadow-lg">
              <h3 className="font-semibold text-lg mb-2 text-white">Skill-based Pairing</h3>
              <p className="text-gray-300">Match with players at your skill level</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 p-6 rounded-lg shadow-lg">
              <h3 className="font-semibold text-lg mb-2 text-white">Location-based Suggestions</h3>
              <p className="text-gray-300">Find partners at your preferred parks</p>
            </div>
            <div className="bg-gray-800 border border-gray-700 p-6 rounded-lg shadow-lg">
              <h3 className="font-semibold text-lg mb-2 text-white">Instant Notifications</h3>
              <p className="text-gray-300">Get notified instantly when someone wants to throw</p>
            </div>
          </div>
          
          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/auth/signup"
              className="bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-8 rounded-lg transition-colors shadow-lg"
            >
              Sign Up
            </Link>
            <Link
              href="/auth/login"
              className="border-2 border-green-500 text-green-500 hover:bg-green-500 hover:text-white font-semibold py-3 px-8 rounded-lg transition-colors shadow-lg"
            >
              Login
            </Link>
            <button
              onClick={() => setShowDonationModal(true)}
              className="border-2 border-yellow-500 text-yellow-500 hover:bg-yellow-500 hover:text-white font-semibold py-3 px-8 rounded-lg transition-colors shadow-lg"
            >
              Donate
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-800 border-t border-gray-700 py-8 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center mb-4 md:mb-0">
              <Image
                src="/icon-192x192.png"
                alt="HuckHub Logo"
                width={32}
                height={32}
                className="rounded-full mr-3"
              />
              <span className="text-gray-300 text-sm">© 2025 HuckHub</span>
            </div>
            <div className="flex space-x-6">
              <Link href="/terms" className="text-gray-400 hover:text-gray-300 text-sm">
                Terms of Service
              </Link>
              <Link href="/privacy" className="text-gray-400 hover:text-gray-300 text-sm">
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>

      {/* Donation Modal */}
      {showDonationModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-lg max-w-md w-full p-6 shadow-xl">
            <div className="text-center">
              <h3 className="text-2xl font-bold text-white mb-4">Support HuckHub 💝</h3>
              
              <div className="text-gray-300 mb-6 space-y-3 text-left">
                <p>
                  Hey! I'm Noah, the creator of HuckHub. I hope you enjoy using this app to become 
                  stronger throwers and to connect with Madison's ultimate community!
                </p>
                <p>
                  With your participation, I truly believe we can make an impact on Madison's throwing 
                  scene—from newer players who don't yet have tossing partners to frisbee fanatics 
                  like me, it could help us all spend more time throwing and place names with familiar faces.
                </p>
                <p>
                  If you like what you see and want to help keep it going, any contribution is deeply 
                  appreciated. Your support covers hosting and domain costs—and helps keep this 
                  unemployed dumpster-diver fed while I keep improving the app for everyone :)
                </p>
              </div>

              <div className="space-y-3">
                <a
                  href="https://account.venmo.com/u/Noah-Nicol"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
                >
                  💙 Venmo (@Noah-Nicol)
                </a>
                <div className="bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors">
                  <div className="text-center">
                    <div className="font-bold mb-1">💛 PayPal</div>
                    <div className="text-sm">noahryannicol@gmail.com</div>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-400 mt-4">
                Thank you so much for being part of the community! 🙏
              </p>

              <button
                onClick={() => setShowDonationModal(false)}
                className="mt-4 text-gray-400 hover:text-gray-300 text-sm underline"
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
