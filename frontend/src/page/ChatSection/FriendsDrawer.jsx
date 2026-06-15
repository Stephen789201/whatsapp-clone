import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FaArrowLeft, FaSearch, FaUserPlus, FaCheck, FaTimes, FaUserClock } from "react-icons/fa";
import useFriendStore from "../../store/friendStore";
import useThemeStore from "../../store/themeStore";

export default function FriendsDrawer({ isOpen, onClose, allUsers, refreshUsers }) {
  const { theme } = useThemeStore();
  const {
    pendingRequests,
    fetchPendingRequests,
    sendRequest,
    respondToRequest
  } = useFriendStore();

  const [activeTab, setActiveTab] = useState("add"); // "add" or "requests"
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      fetchPendingRequests();
    }
  }, [isOpen, fetchPendingRequests]);

  if (!isOpen) return null;

  // Filter strangers/non-friends for "Add Friend" tab (excluding the Talkies Support account)
  const strangers = allUsers.filter(
    (u) =>
      !u.isFriend &&
      String(u.phoneNumber) !== "7892392608" &&
      u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSendRequest = async (userId) => {
    await sendRequest(userId);
    if (refreshUsers) refreshUsers();
  };

  const handleRespond = async (requestId, status) => {
    await respondToRequest(requestId, status);
    if (refreshUsers) refreshUsers();
  };

  return (
    <motion.div
      initial={{ x: "-100%" }}
      animate={{ x: 0 }}
      exit={{ x: "-100%" }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className={`absolute inset-0 z-40 flex flex-col h-full w-full ${
        theme === "dark" ? "bg-[#111b21] text-white" : "bg-white text-black"
      }`}
    >
      {/* Header */}
      <div
        className={`px-6 py-5 flex items-center gap-6 ${
          theme === "dark" ? "bg-[#202c33]" : "bg-[#008069] text-white"
        }`}
      >
        <button onClick={onClose} className="focus:outline-none hover:opacity-80">
          <FaArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-medium">Friend Requests</h1>
      </div>

      {/* Tabs */}
      <div className={`flex border-b ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
        <button
          onClick={() => setActiveTab("add")}
          className={`flex-1 py-3 text-center font-medium border-b-2 text-sm transition-colors ${
            activeTab === "add"
              ? theme === "dark"
                ? "border-green-500 text-green-500"
                : "border-[#008069] text-[#008069]"
              : "border-transparent text-gray-500"
          }`}
        >
          Add Friends
        </button>
        <button
          onClick={() => setActiveTab("requests")}
          className={`flex-1 py-3 text-center font-medium border-b-2 text-sm transition-colors relative ${
            activeTab === "requests"
              ? theme === "dark"
                ? "border-green-500 text-green-500"
                : "border-[#008069] text-[#008069]"
              : "border-transparent text-gray-500"
          }`}
        >
          Requests
          {pendingRequests.length > 0 && (
            <span className="absolute top-2 right-4 bg-red-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {pendingRequests.length}
            </span>
          )}
        </button>
      </div>

      {/* Search Input for Add Friends */}
      {activeTab === "add" && (
        <div className="p-3">
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by username..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
                theme === "dark"
                  ? "bg-gray-800 text-white border-gray-700 placeholder-gray-500"
                  : "bg-gray-100 text-black border-gray-200 placeholder-gray-400"
              }`}
            />
          </div>
        </div>
      )}

      {/* Content List */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "add" ? (
          strangers.length === 0 ? (
            <div className="text-center py-8 text-gray-500 text-sm">
              No new users found to add.
            </div>
          ) : (
            strangers.map((u) => (
              <div
                key={u._id}
                className={`p-3 flex items-center justify-between border-b ${
                  theme === "dark" ? "border-gray-800" : "border-gray-100"
                }`}
              >
                <div className="flex items-center gap-3">
                  <img
                    src={u.profilePicture || "/default-avatar.png"}
                    alt={u.username}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <h2 className="font-semibold text-sm">{u.username}</h2>
                    <p className="text-xs text-gray-500 truncate max-w-[150px]">
                      {u.about || "Hey there! I am using Talkies."}
                    </p>
                  </div>
                </div>

                <div>
                  {u.requestStatus === "sent" ? (
                    <span className="flex items-center gap-1 text-xs text-gray-500 bg-gray-200 dark:bg-gray-700 px-2.5 py-1 rounded-full">
                      <FaUserClock /> Requested
                    </span>
                  ) : u.requestStatus === "received" ? (
                    <span className="text-xs text-yellow-600 bg-yellow-50 dark:bg-yellow-950/20 px-2.5 py-1 rounded-full">
                      Received
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSendRequest(u._id)}
                      className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full text-white transition-transform active:scale-95 ${
                        theme === "dark"
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-[#008069] hover:bg-[#008069]/90"
                      }`}
                    >
                      <FaUserPlus /> Add
                    </button>
                  )}
                </div>
              </div>
            ))
          )
        ) : pendingRequests.length === 0 ? (
          <div className="text-center py-8 text-gray-500 text-sm">
            No pending friend requests.
          </div>
        ) : (
          pendingRequests.map((req) => (
            <div
              key={req._id}
              className={`p-3 flex items-center justify-between border-b ${
                theme === "dark" ? "border-gray-800" : "border-gray-100"
              }`}
            >
              <div className="flex items-center gap-3">
                <img
                  src={req.sender?.profilePicture || "/default-avatar.png"}
                  alt={req.sender?.username}
                  className="w-10 h-10 rounded-full object-cover"
                />
                <div>
                  <h2 className="font-semibold text-sm">{req.sender?.username}</h2>
                  <p className="text-xs text-gray-500 truncate max-w-[150px]">
                    {req.sender?.email}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => handleRespond(req._id, "accepted")}
                  className="p-2 bg-green-500 hover:bg-green-600 text-white rounded-full transition-transform active:scale-90"
                  title="Accept Request"
                >
                  <FaCheck className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleRespond(req._id, "rejected")}
                  className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-transform active:scale-90"
                  title="Reject Request"
                >
                  <FaTimes className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </motion.div>
  );
}
