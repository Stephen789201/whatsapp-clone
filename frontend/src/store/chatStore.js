import { create } from "zustand";
import { persist } from "zustand/middleware";
import axiosInstance from "../services/url.service";
import { getSocket } from "../services/chat.service";

import useLayoutStore from "./layoutStore";
import useUserStore from "./useUserStore";

// Zustand store for managing chat-related state and actions
export const useChatStore = create(
  persist(
    (set, get) => ({
      // ======== State Variables ========
      conversations: [], // List of all conversations
      currentConversation: null, // Currently selected conversation ID
      messages: [], // Messages of the current conversation
      loading: false, // Loader for API calls
      error: null, // Error holder
      onlineUsers: new Map(), // userId -> { isOnline, lastSeen }
      typingUsers: new Map(), // conversationId -> Set of userIds who are typing
      allUsers: [], // List of all users in the system for starting new chats
      pendingStatusUpdates: {}, // Cache for incoming real-time status updates (race condition fix)
      
      resetChatStore: () => set({
        conversations: [],
        currentConversation: null,
        messages: [],
        allUsers: [],
        loading: false,
        error: null,
        pendingStatusUpdates: {}
      }),

      updateMessageStatusInStore: (messageId, messageStatus) => {
        const targetId = String(messageId);
        set((state) => {
          const updatedPending = { ...state.pendingStatusUpdates, [targetId]: messageStatus };
          
          // 1. Update message in active messages list
          const updatedMessages = state.messages.map((msg) =>
            String(msg._id) === targetId ? { ...msg, messageStatus } : msg
          );

          // 2. Update message in conversations preview list (sidebar)
          const list = Array.isArray(state.conversations) ? state.conversations : (state.conversations?.data || []);
          const updatedConversations = list.map((conv) => {
            if (conv.lastMessage && String(conv.lastMessage._id) === targetId) {
              return {
                ...conv,
                lastMessage: { ...conv.lastMessage, messageStatus }
              };
            }
            return conv;
          });

          const conversationsResult = Array.isArray(state.conversations)
            ? updatedConversations
            : { ...state.conversations, data: updatedConversations };

          return {
            pendingStatusUpdates: updatedPending,
            messages: updatedMessages,
            conversations: conversationsResult,
          };
        });
      },

  // ======== Socket Event Listeners Setup ========
  initSocketListeners: () => { 
    const socket = getSocket();
    if (!socket) return;

    // Remove existing listeners to prevent duplicate handlers
    socket.off("receive_message");
    socket.off("user_typing");
    socket.off("user_status");
    socket.off("message_send");
    socket.off("message_error");
    socket.off("message_deleted");
    socket.off("new_conversation");
    socket.off("message_status_update");
    socket.off("messages_read");

    // Listen for incoming messages
    socket.on("receive_message", (message) => {
      get().receiveMessage(message);
    });

    // Listen for new or updated conversations (for the sidebar)
    socket.on("new_conversation", (conversation) => {
      console.log("Received new_conversation update:", conversation);
      set((state) => {
        const isArray = Array.isArray(state.conversations);
        const list = isArray ? state.conversations : (state.conversations?.data || []);
        
        // Update existing or add new
        const existingIdx = list.findIndex(c => c._id === conversation._id);
        let newList;
        if (existingIdx !== -1) {
          newList = [...list];
          newList[existingIdx] = conversation;
        } else {
          newList = [conversation, ...list];
        }

        return {
          conversations: isArray ? newList : { ...state.conversations, data: newList }
        };
      });
    });

    // Confirm message delivery
    socket.on("message_send", (message) => {
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === message._id ? { ...msg } : msg
        ),
      }));
    });

    // Update message read/delivered status
    socket.on("message_status_update", ({ messageId, messageStatus }) => {
      console.log("Socket message_status_update received:", messageId, messageStatus);
      get().updateMessageStatusInStore(messageId, messageStatus);
    });

    // Handle reactions on messages
    socket.on("reaction_update", ({ messageId, reactions }) => {
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === messageId ? { ...msg, reactions } : msg
        ),
      }));
    });
    
    socket.on("messages_read", ({ messageIds, receiverId }) => {
      console.log("Socket messages_read received:", messageIds);
      if (Array.isArray(messageIds)) {
        messageIds.forEach((id) => {
          get().updateMessageStatusInStore(id, "read");
        });
      }
    });
  
    // Remove a message from local state when deleted for me (real-time sync if needed)
    socket.on("message_deleted", (data) => {
      const deletedMessageId = typeof data === 'string' ? data : data.messageId;
      set((state) => ({
        messages: state.messages.filter((msg) => msg._id !== deletedMessageId),
      }));
    });

    // Handle "Delete for Everyone" (Update to placeholder)
    socket.on("message_deleted_everyone", ({ messageId, updatedMessage }) => {
      console.log("Message deleted for everyone:", messageId);
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === messageId ? { ...msg, ...updatedMessage } : msg
        ),
      }));
    });

    // Handle any message sending error
    socket.on("message_error", (error) => {
      console.error("Message error:", error);
    });

    // Listen for typing indicators
    socket.on("user_typing", ({ userId, conversationId, isTyping }) => {
      set((state) => {
        const newTypingUsers = new Map(state.typingUsers);
        const convIdStr = String(conversationId);
        const typingSet = new Set(newTypingUsers.get(convIdStr) || []);
        
        if (isTyping) {
          typingSet.add(String(userId));
        } else {
          typingSet.delete(String(userId));
        }

        newTypingUsers.set(convIdStr, typingSet);
        return { typingUsers: newTypingUsers };
      });
    });

    // Listen for user profile updates (name/avatar change)
    socket.on("user_updated", (updatedUser) => {
      console.log("Received user_updated:", updatedUser);

      // 1. Update the user profile if it's the current user
      const currentUser = useUserStore.getState().user;
      if (currentUser && String(currentUser._id) === String(updatedUser._id)) {
        console.log("Updating current user profile state");
        useUserStore.getState().setUser({ ...currentUser, ...updatedUser });
      }

      // 2. Update conversations list
      set((state) => {
        const isArray = Array.isArray(state.conversations);
        const list = isArray ? state.conversations : (state.conversations?.data || []);
        
        const updatedList = list.map((conv) => {
          const updatedParticipants = conv.participants.map((p) => 
            String(p._id || p) === String(updatedUser._id) 
              ? { ...p, ...updatedUser } 
              : p
          );
          return { ...conv, participants: updatedParticipants };
        });

        console.log("Updating local conversation state with new user info");
        return {
          conversations: isArray ? updatedList : { ...state.conversations, data: updatedList }
        };
      });

      // 3. Update active chat header if this user is selected
      const { selectedContact, setSelectedContact } = useLayoutStore.getState();
      if (selectedContact && String(selectedContact._id) === String(updatedUser._id)) {
        console.log("Updating active chat header for:", updatedUser.username);
        setSelectedContact({ ...selectedContact, ...updatedUser });
      }
    });

    // Track user's online/offline status
    socket.on("user_status", ({ userId, isOnline, lastSeen }) => {
      set((state) => {
        const newOnlineUsers = new Map(state.onlineUsers);
        newOnlineUsers.set(String(userId), { isOnline, lastSeen });
        return { onlineUsers: newOnlineUsers };
      });
    });

    // Initial status check for all participants
    const { conversations } = get();
    const list = Array.isArray(conversations) ? conversations : (conversations?.data || []);
    list.forEach((conv) => {
      const otherUser = conv.participants?.find(
        (p) => String(p._id || p) !== String(get().currentUser?._id)
      );
      if (otherUser) {
        socket.emit("get_user_status", otherUser._id || otherUser);
      }
    });
  },

  refreshUserStatuses: () => {
    const socket = getSocket();
    if (!socket) return;

    const { conversations } = get();
    const list = Array.isArray(conversations) ? conversations : (conversations?.data || []);
    
    list.forEach((conv) => {
      const otherUser = conv.participants?.find(
        (p) => String(p._id || p) !== String(get().currentUser?._id)
      );
      if (otherUser) {
        socket.emit("get_user_status", otherUser._id || otherUser);
      }
    });
  },

  // ======== Set Current User ========
  setCurrentUser: (user) => set({ currentUser: user }),

  // ======== Fetch All Users for New Chat ========
  fetchAllUsers: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await axiosInstance.get("/users/other-users-list");
      // The backend returns an array of users with optional conversation info
      const users = data.data || data || [];
      set({ allUsers: users, loading: false });
      return users;
    } catch (error) {
      console.error("Error fetching all users:", error);
      set({
        error: error.response?.data?.message || error.message,
        loading: false,
      });
      return [];
    }
  },

  // ======== Fetch Conversations from API ========
  fetchConversations: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await axiosInstance.get("/chats/conversations");
      set({ conversations: data, loading: false });

      // Initialize socket after fetching conversations
      get().initSocketListeners();
      
      // Refresh statuses
      get().refreshUserStatuses();
      return data;
    } catch (error) {
      set({
        error: error.response?.data?.message || error.message,
        loading: false,
      });
      return null;
    }
  },

  // ======== Fetch Messages for a Conversation ========
  fetchMessages: async (conversationId, conversationPartnerId) => {
    if (!conversationId) return;

    set({ loading: true, error: null });
    try {
      const { data } = await axiosInstance.get(
        `/chats/conversations/${conversationId}/messages`
      );

      const messageArray = data.data || data || [];
      const userId = get().currentUser?._id;

      set({
        messages: messageArray.filter(msg => !msg.deletedFor?.some(id => String(id) === String(userId))),
        currentConversation: conversationId,
        loading: false,
      });

      // We no longer mark as read here automatically. 
      // It is handled by the focus/visibility listeners in ChatWindow.

      return messageArray;
    } catch (error) {
      console.error("Error fetching messages:", error);
      set({
        error: error.response?.data?.message || error.message,
        loading: false,
      });
      return [];
    }
  },

  // ======== Send a Message with Optimistic Update ========
  sendMessage: async (formData) => {
    const senderId = formData.get("senderId");
    const receiverId = formData.get("receiverId");
    const media = formData.get("media");
    const content = formData.get("content");
    const messageStatus = formData.get("messageStatus");
    const parentMessageId = formData.get("parentMessage");

    const socket = getSocket();

    // Find existing conversation between sender & receiver
    const { conversations } = get();
    let conversationId = null;

    if (conversations?.data?.length > 0) {
      const conversation = conversations.data.find(
        (conv) =>
          conv.participants.some((p) => p._id === senderId) &&
          conv.participants.some((p) => p._id === receiverId)
      );

      if (conversation) {
        conversationId = conversation._id;
        set({ currentConversation: conversationId });
      }
    }

    let optimisticParent = null;
    if (parentMessageId) {
      const parentMsgObj = get().messages.find(m => String(m._id) === String(parentMessageId));
      if (parentMsgObj) {
        optimisticParent = {
          _id: parentMsgObj._id,
          content: parentMsgObj.content,
          isDeleted: parentMsgObj.isDeleted,
          sender: typeof parentMsgObj.sender === "object" ? { username: parentMsgObj.sender.username } : { username: "Contact" }
        };
      }
    }

    // Temporary message before actual response
    const tempId = `temp-${Date.now()}`;
    const optimisticMessage = {
      _id: tempId,
      sender: { _id: senderId },
      receiver: { _id: receiverId },
      conversation: conversationId,
      imageOrVideoUrl:
        media && typeof media !== "string" && !media.type.startsWith("audio") && !media.type.includes("webm") 
          ? URL.createObjectURL(media) 
          : null,
      audioUrl:
        media && typeof media !== "string" && (media.type.startsWith("audio") || media.type.includes("webm"))
          ? URL.createObjectURL(media)
          : null,
      content: content,
      contentType: media
        ? media.type.startsWith("image")
          ? "image"
          : (media.type.startsWith("audio") || media.type.includes("webm"))
            ? "audio"
            : "video"
        : "text",
      createdAt: new Date().toISOString(),
      messageStatus: messageStatus || "send",
      parentMessage: optimisticParent,
    };

    set((state) => ({
      messages: [...state.messages, optimisticMessage],
    }));

    try {
      // Send to backend API
      const { data } = await axiosInstance.post(
        "/chats/send-message",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      console.log(data)
      const messageData = data.data || data;
      const realId = String(messageData._id);

      // Check if a socket event already delivered or read this message
      const pendingStatus = get().pendingStatusUpdates[realId];
      const finalMessage = pendingStatus
        ? { ...messageData, messageStatus: pendingStatus }
        : messageData;

      // Replace optimistic message with real one
      set((state) => {
        const newPending = { ...state.pendingStatusUpdates };
        delete newPending[realId];

        return {
          messages: state.messages.map((msg) =>
            msg._id === tempId ? finalMessage : msg
          ),
          pendingStatusUpdates: newPending,
          currentConversation: messageData.conversation
        };
      });

      // Notify other user via socket
      if (socket) {
        socket.emit("send_message", messageData);
      }

      return messageData;
    } catch (error) {
      console.error("Error sending message:", error);
      // Mark message as failed if API fails
      set((state) => ({
        messages: state.messages.map((msg) =>
          msg._id === tempId ? { ...msg, messageStatus: "failed" } : msg
        ),
        error: error.response?.data?.message || error.message,
      }));
      throw error;
    }
  },

  // ======== Add Message from Socket into Store ========
  receiveMessage: (message) => {
    if (!message) return;

    const { currentConversation, currentUser, messages } = get();

    const messageExists = messages.some((msg) => msg._id === message._id);
    if (messageExists) return;

    // Acknowledge delivery to sender immediately
    const receiverId = message.receiver?._id || message.receiver;
    const senderId = message.sender?._id || message.sender;
    if (String(receiverId) === String(currentUser?._id)) {
      const socket = getSocket();
      if (socket) {
        socket.emit("message_received", {
          messageId: message._id,
          senderId: senderId,
        });
      }
    }

    if (message.conversation === currentConversation) {
      set((state) => ({
        messages: [...state.messages, message],
      }));

      // Automatically mark as read if actively viewing this specific conversation
      const activeContact = useLayoutStore.getState().selectedContact;
      const activeTab = useLayoutStore.getState().activeTab;
      
      const isViewingThisChat = 
        window.location.pathname === "/" &&
        activeTab === "chats" &&
        activeContact &&
        String(activeContact._id) === String(senderId) &&
        document.visibilityState !== "hidden";

      if (String(receiverId) === String(currentUser?._id) && isViewingThisChat) {
        get().markMessagesAsRead(senderId, [message._id]);
      }
    }

    // Update conversation preview and unread count
    set((state) => {
      const updatedConversations = state.conversations?.data?.map((conv) => {
        if (conv._id === message.conversation) {
          return {
            ...conv,
            lastMessage: message,
            unreadCount:
              String(message.receiver?._id) === String(currentUser?._id)
                ? (conv.unreadCount || 0) + 1
                : conv.unreadCount || 0,
          };
        }
        return conv;
      });

      return {
        conversations: {
          ...state.conversations,
          data: updatedConversations,
        },
      };
    });
  },

  // ======== Mark Unread Messages as Read ========
  markMessagesAsRead: async (conversationPartnerId, specificMessageIds = null) => {
    const { messages, currentUser } = get();
    if (!currentUser) return;
    
    // Mark messages as read

    let unreadIds = [];
    if (specificMessageIds) {
      unreadIds = specificMessageIds.filter(Boolean);
    } else if (messages?.length) {
      unreadIds = messages
        .filter(
          (msg) =>
            msg.messageStatus !== "read" &&
            String(msg.receiver?._id || msg.receiver) === String(currentUser?._id)
        )
        .map((msg) => msg._id)
        .filter(Boolean);
    }

    if (unreadIds.length === 0) return;

    try {
      await axiosInstance.put("/chats/messages/read", {
        messageIds: unreadIds,
      });

      const stringUnreadIds = unreadIds.map(String);
      set((state) => ({
        messages: state.messages.map((msg) =>
          stringUnreadIds.includes(String(msg._id)) ? { ...msg, messageStatus: "read" } : msg
        ),
      }));

      // Emit update to sender (the partner)
      const socket = getSocket();
      if (socket && conversationPartnerId) {
        socket.emit("message_read", {
          messageIds: unreadIds,
          senderId: conversationPartnerId,
        });
      }
    } catch (error) {
      console.error("Failed to mark messages as read:", error);
    }
  },

  // Delete a message by ID
deleteMessage: async (messageId, deleteType = 'everyone') => {
  try {
    // Make API call to delete the message
    await axiosInstance.delete(`/chats/messages/${messageId}`, { 
      data: { deleteType } 
    });

    // Optimistically update local state
    set((state) => ({
      messages: state.messages.map((msg) => {
        if (msg._id === messageId) {
          if (deleteType === 'everyone') {
            return { 
              ...msg, 
              isDeleted: true, 
              content: "🚫 This message was deleted", 
              contentType: "text",
              audioUrl: null,
              imageOrVideoUrl: null,
              reactions: []
            };
          }
          // For 'me', we filter it out in the next step
          return msg;
        }
        return msg;
      }).filter(msg => {
        if (msg._id === messageId && deleteType === 'me') return false;
        return true;
      }),
    }));

    return true;
  } catch (error) {
    console.error("Error deleting message:", error);
    set({ error: error.response?.data?.message || error.message });
    return false;
  }
},


  // ======== Add/Change/Delete Reaction ========
  addReaction: async (messageId, emoji) => {
    const socket = getSocket();
    const { currentUser } = get();

    if (socket && currentUser) {
      socket.emit("add_reaction", {
        messageId,
        emoji,
        userId: currentUser._id,
      });
    }
  },

  // ======== Typing Events (start/stop) ========
  startTyping: (receiverId) => {
    const { currentConversation } = get();
    const socket = getSocket();

    if (socket && currentConversation && receiverId) {
      console.log("Emitting typing start:", currentConversation, receiverId);
      socket.emit("typing_start", {
        conversationId: currentConversation,
        receiverId,
      });
    }
  },

  stopTyping: (receiverId) => {
    const { currentConversation } = get();
    const socket = getSocket();

    if (socket && currentConversation && receiverId) {
      console.log("Emitting typing stop:", currentConversation, receiverId);
      socket.emit("typing_stop", {
        conversationId: currentConversation,
        receiverId,
      });
    }
  },

  // ======== Utility Getters ========
  isUserTyping: (userId) => {
    const { typingUsers, currentConversation } = get();
    if (
      !currentConversation ||
      !typingUsers.has(String(currentConversation)) ||
      !userId
    ) {
      return false;
    }
    return typingUsers.get(String(currentConversation)).has(String(userId));
  },

  isUserOnline: (userId) => {
    if (!userId) return false;
    const { onlineUsers } = get();
    return onlineUsers.get(String(userId))?.isOnline || false;
  },

  getUserLastSeen: (userId) => {
    if (!userId) return null;
    const { onlineUsers } = get();
    return onlineUsers.get(String(userId))?.lastSeen || null;
  },

  // ======== Fetch/Refresh User Status ========
  fetchUserStatus: (userId) => {
    if (!userId) return;
    const socket = getSocket();
    if (socket) {
      socket.emit("get_user_status", userId, (status) => {
        set((state) => {
          const newOnlineUsers = new Map(state.onlineUsers);
          newOnlineUsers.set(String(status.userId), {
            isOnline: status.isOnline,
            lastSeen: status.lastSeen,
          });
          return { onlineUsers: newOnlineUsers };
        });
      });
    }
  },

  // ======== Cleanup Store ========
  cleanup: () => {
    // Clear all chat data from the store
    set({
      conversations: [],
      currentConversation: null,
      messages: [],
      onlineUsers: new Map(),
      typingUsers: new Map(),
    });
  },
    }),
    {
      name: "chat-storage",
      getStorage: () => localStorage,
      partialize: (state) => ({
        conversations: state.conversations,
      }),
    }
  )
);
