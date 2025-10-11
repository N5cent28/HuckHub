"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface BlockedUser {
  id: string;
  blocker_id: string;
  blocked_id: string;
  reason: string | null;
  created_at: string;
  blocker_name: string;
  blocked_name: string;
}

interface ReportedUser {
  id: string;
  reporter_id: string;
  reported_id: string;
  reason: string;
  description: string | null;
  created_at: string;
  reporter_name: string;
  reported_name: string;
}

export default function UserManagement() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [reportedUsers, setReportedUsers] = useState<ReportedUser[]>([]);
  const [activeTab, setActiveTab] = useState<'blocks' | 'reports'>('blocks');

  useEffect(() => {
    const checkAdminAccess = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push("/auth/login");
          return;
        }

        // Check if user is admin (you can modify this logic based on your admin system)
        const { data: profile } = await supabase
          .from("profiles")
          .select("email")
          .eq("id", user.id)
          .single();

        // For now, check if email contains admin or is a specific admin email
        if (!profile?.email?.includes("admin") && profile?.email !== "noahryannicol@gmail.com") {
          router.push("/dashboard");
          return;
        }

        loadData();
      } catch (error) {
        console.error("Error checking admin access:", error);
        router.push("/auth/login");
      }
    };

    checkAdminAccess();
  }, [router]);

  const loadData = async () => {
    try {
      // Load blocked users
      const { data: blocks, error: blocksError } = await supabase
        .from("user_blocks")
        .select(`
          id,
          blocker_id,
          blocked_id,
          reason,
          created_at,
          blocker:profiles!user_blocks_blocker_id_fkey(full_name),
          blocked:profiles!user_blocks_blocked_id_fkey(full_name)
        `)
        .order("created_at", { ascending: false });

      if (blocksError) throw blocksError;

      const formattedBlocks = blocks?.map(block => ({
        id: block.id,
        blocker_id: block.blocker_id,
        blocked_id: block.blocked_id,
        reason: block.reason,
        created_at: block.created_at,
        blocker_name: block.blocker?.full_name || "Unknown",
        blocked_name: block.blocked?.full_name || "Unknown"
      })) || [];

      setBlockedUsers(formattedBlocks);

      // Load reported users
      const { data: reports, error: reportsError } = await supabase
        .from("user_reports")
        .select(`
          id,
          reporter_id,
          reported_id,
          reason,
          description,
          created_at,
          reporter:profiles!user_reports_reporter_id_fkey(full_name),
          reported:profiles!user_reports_reported_id_fkey(full_name)
        `)
        .order("created_at", { ascending: false });

      if (reportsError) throw reportsError;

      const formattedReports = reports?.map(report => ({
        id: report.id,
        reporter_id: report.reporter_id,
        reported_id: report.reported_id,
        reason: report.reason,
        description: report.description,
        created_at: report.created_at,
        reporter_name: report.reporter?.full_name || "Unknown",
        reported_name: report.reported?.full_name || "Unknown"
      })) || [];

      setReportedUsers(formattedReports);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const unblockUser = async (blockId: string) => {
    try {
      const { error } = await supabase
        .from("user_blocks")
        .delete()
        .eq("id", blockId);

      if (error) throw error;

      // Reload data
      loadData();
      alert("User unblocked successfully");
    } catch (error) {
      console.error("Error unblocking user:", error);
      alert("Failed to unblock user");
    }
  };

  const dismissReport = async (reportId: string) => {
    try {
      const { error } = await supabase
        .from("user_reports")
        .delete()
        .eq("id", reportId);

      if (error) throw error;

      // Reload data
      loadData();
      alert("Report dismissed successfully");
    } catch (error) {
      console.error("Error dismissing report:", error);
      alert("Failed to dismiss report");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <p className="text-gray-300">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">User Management</h1>
          <p className="text-gray-300">Manage blocked users and reported content</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mb-8">
          <button
            onClick={() => setActiveTab('blocks')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'blocks'
                ? 'bg-red-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Blocked Users ({blockedUsers.length})
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'reports'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
          >
            Reports ({reportedUsers.length})
          </button>
        </div>

        {/* Blocked Users Tab */}
        {activeTab === 'blocks' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">Blocked Users</h2>
              <p className="text-gray-400 text-sm">Users who have been blocked by other users</p>
            </div>
            
            {blockedUsers.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                No blocked users found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Blocked User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Blocked By</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Reason</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {blockedUsers.map((block) => (
                      <tr key={block.id} className="hover:bg-gray-750">
                        <td className="px-6 py-4 whitespace-nowrap text-white font-medium">
                          {block.blocked_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                          {block.blocker_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                          {block.reason || "No reason provided"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                          {new Date(block.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => unblockUser(block.id)}
                            className="text-green-400 hover:text-green-300 font-medium"
                          >
                            Unblock
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-700">
              <h2 className="text-xl font-semibold text-white">User Reports</h2>
              <p className="text-gray-400 text-sm">Reports submitted by users about other users</p>
            </div>
            
            {reportedUsers.length === 0 ? (
              <div className="p-6 text-center text-gray-400">
                No reports found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-900">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Reported User</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Reported By</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Reason</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {reportedUsers.map((report) => (
                      <tr key={report.id} className="hover:bg-gray-750">
                        <td className="px-6 py-4 whitespace-nowrap text-white font-medium">
                          {report.reported_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                          {report.reporter_name}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                          {report.reason}
                        </td>
                        <td className="px-6 py-4 text-gray-300 max-w-xs truncate">
                          {report.description || "No description provided"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-300">
                          {new Date(report.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => dismissReport(report.id)}
                            className="text-yellow-400 hover:text-yellow-300 font-medium"
                          >
                            Dismiss
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Back Button */}
        <div className="mt-8">
          <button
            onClick={() => router.push("/admin/custom-locations")}
            className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            ← Back to Admin Panel
          </button>
        </div>
      </div>
    </div>
  );
}
