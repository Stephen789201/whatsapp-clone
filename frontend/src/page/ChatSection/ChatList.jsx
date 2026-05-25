import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FaPlus, FaSearch, FaCheck, FaCheckDouble } from "react-icons/fa";
import useStore from "../../store/layoutStore";
import useThemeStore from "../../store/themeStore";
import formatTimestamp from "../../utils/formatTime";
import userStore from "../../store/useUserStore";
import FriendsDrawer from "./FriendsDrawer";
import { useChatStore } from "../../store/chatStore";

const ChatList = ({ contacts, refreshUsers }) => {
  const onlineUsers = useChatStore((state) => state.onlineUsers);
  const fetchUserStatus = useChatStore((state) => state.fetchUserStatus);
  const setSelectedContact = useStore((state) => state.setSelectedContact);
  const selectedContact = useStore((state) => state.selectedContact);
  const { theme } = useThemeStore();
  const { user } = userStore();
  const [searchTerm, setSearchTerm] = useState("");
  const [showFriendsDrawer, setShowFriendsDrawer] = useState(false);

  useEffect(() => {
    if (contacts && contacts.length > 0) {
      contacts.forEach((contact) => {
        if (contact?._id) {
          fetchUserStatus(contact._id);
        }
      });
    }
  }, [contacts, fetchUserStatus]);

  // Filter contacts: only show users who are friends OR have active conversations
  const friendsAndChats = contacts?.filter((contact) => contact.isFriend || contact.conversation !== null) || [];

  // Search filter
  const filteredContacts = friendsAndChats.filter((contact) =>
    contact?.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div
      className={`w-full border-r h-screen relative overflow-hidden ${
        theme === "dark"
          ? "bg-[rgb(17,27,33)] border-gray-600"
          : "bg-white border-gray-200"
      }`}
    >
      <FriendsDrawer
        isOpen={showFriendsDrawer}
        onClose={() => setShowFriendsDrawer(false)}
        allUsers={contacts || []}
        refreshUsers={refreshUsers}
      />
      <div
        className={`p-4 flex justify-between ${
          theme === "dark" ? "text-white" : "text-gray-800"
        }`}
      >
        <h2 className="text-xl font-semibold">Talkies Chats</h2>
        <button
          onClick={() => setShowFriendsDrawer(true)}
          className="p-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-colors focus:outline-none"
          title="Friend Requests"
        >
          <FaPlus />
        </button>
      </div>
      <div className="p-2">
        <div className="relative">
          <FaSearch
            className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${
              theme === "dark" ? "text-gray-400" : "text-gray-400"
            }`}
          />
          <input
            type="text"
            placeholder="Search or start new chat"
            className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 ${
              theme === "dark"
                ? "bg-gray-800 text-white border-gray-700 placeholder-gray-500"
                : "bg-gray-100 text-black border-gray-200 placeholder-gray-400"
            }`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="overflow-y-auto h-[calc(100vh-120px)]">
        {filteredContacts.map((contact) => {
          const isOnline = onlineUsers.has(String(contact._id))
            ? onlineUsers.get(String(contact._id))?.isOnline
            : contact.isOnline || false;

          return (
            <motion.div
              key={contact._id}
              onClick={() => setSelectedContact(contact)}
              className={`p-3  flex items-center cursor-pointer ${
                theme === "dark"
                  ? selectedContact?._id === contact._id
                    ? "bg-gray-700"
                    : "hover:bg-gray-800"
                  : selectedContact?._id === contact._id
                  ? "bg-gray-200"
                  : "hover:bg-gray-100"
              }`}
            >
              <div className="relative flex-shrink-0 w-12 h-12">
                <img
                  src={contact?.profilePicture}
                  alt={contact?.username}
                  className="w-12 h-12 rounded-full object-cover"
                />
                {isOnline && (
                  <span className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full bg-green-500 ring-2 ring-white" />
                )}
              </div>
              <div className="ml-3 flex-1">
              <div className="flex justify-between items-baseline">
                <h2
                  className={`font-semibold ${
                    theme === "dark" ? "text-white" : "text-black"
                  }`}
                >
                  {contact.username}
                </h2>
                {contact?.conversation && (
                  <span
                    className={`text-xs ${
                      theme === "dark" ? "text-gray-500" : "text-gray-500"
                    }`}
                  >
                    {formatTimestamp(contact?.conversation?.lastMessage?.createdAt)}
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center mt-1">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {contact?.conversation?.lastMessage && (
                    (() => {
                      console.log("ChatList DEBUG:", {
                        contact: contact.username,
                        lastMsgContent: contact.conversation.lastMessage.content,
                        sender: contact.conversation.lastMessage.sender,
                        receiver: contact.conversation.lastMessage.receiver,
                        status: contact.conversation.lastMessage.messageStatus,
                        userId: user?._id
                      });
                      return null;
                    })()
                  )}
                  {contact?.conversation?.lastMessage && 
                   String(contact.conversation.lastMessage.sender?._id || contact.conversation.lastMessage.sender) === String(user?._id) && (
                    <span className="flex-shrink-0 flex items-center">
                      {contact.conversation.lastMessage.messageStatus === "send" && (
                        <FaCheck size={12} className="text-gray-400" />
                      )}
                      {contact.conversation.lastMessage.messageStatus === "delivered" && (
                        <FaCheckDouble size={12} className="text-gray-400" />
                      )}
                      {contact.conversation.lastMessage.messageStatus === "read" && (
                        <FaCheckDouble size={12} className="drop-shadow-sm" style={{ color: "#34b7f1" }} />
                      )}
                    </span>
                  )}
                  <p
                    className={`text-sm ${
                      theme === "dark" ? "text-gray-400" : "text-gray-500"
                    } truncate flex-1 ${contact?.conversation?.lastMessage?.isDeleted ? "italic opacity-60" : ""}`}
                  >
                    {contact?.conversation?.lastMessage?.isDeleted
                      ? (String(contact.conversation.lastMessage.sender?._id || contact.conversation.lastMessage.sender) === String(user?._id)
                          ? "🚫 You deleted this message"
                          : "🚫 This message was deleted")
                      : contact?.conversation?.lastMessage?.content
                    }
                  </p>
                </div>
                {contact?.conversation &&
                  contact?.conversation?.unreadCount > 0 &&
                  contact?.conversation?.lastMessage &&
                  String(contact.conversation.lastMessage.receiver?._id || contact.conversation.lastMessage.receiver) === String(user?._id) && (
                    <p
                      className={`text-xs font-semibold w-5 h-5 flex items-center justify-center bg-green-500 text-white rounded-full flex-shrink-0 ml-2`}
                    >
                      {contact?.conversation?.unreadCount}
                    </p>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
      </div>
    </div>
  );
};

export default ChatList;
