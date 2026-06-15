const { Server } = require("socket.io");
const User = require("../../models/User");
const Message = require("../../models/Message");
const socketAuthMiddleware = require("../middlerwares/socketAuthMiddleware");
const handleVideoCallEvents = require("../../utils/video-call-events");

// Map to store online users: userId -> socketId
const onlineUsers = new Map();

// Map to track typing status: userId -> { [conversationId]: boolean, [conversationId_timeout]: timeout }
const typingUsers = new Map();

const initializeSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    },
    pingTimeout: 60000, // Disconnect inactive sockets after 60s
  });

  //middleware
  // io.use(socketAuthMiddleware);

  // When a new socket connection is established
  io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);
    let userId = null; // Will store the current user's ID

    /**
     * Handle user connection and mark them online in DB
     */
    socket.on("user_connected", async (connectingUserId) => {
      try {
        if (!connectingUserId) return;
        userId = String(connectingUserId);
        socket.userId = userId;

        // Initialize set if not exists and add current socket
        if (!onlineUsers.has(userId)) {
          onlineUsers.set(userId, new Set());
        }
        onlineUsers.get(userId).add(socket.id);
        
        socket.join(userId);
        console.log(`User connected and joined room: ${userId} (Total sockets: ${onlineUsers.get(userId).size})`);

        // Update user status in DB
        await User.findByIdAndUpdate(userId, {
          isOnline: true,
          lastSeen: new Date(),
        });

        // Notify all users that this user is now online
        io.emit("user_status", { userId, isOnline: true });

        // Update any undelivered messages for this connected user to "delivered"
        const undeliveredMessages = await Message.find({
          receiver: userId,
          messageStatus: "send",
        });

        if (undeliveredMessages.length > 0) {
          await Message.updateMany(
            { receiver: userId, messageStatus: "send" },
            { $set: { messageStatus: "delivered" } }
          );

          // Notify the senders of each message
          undeliveredMessages.forEach((msg) => {
            const senderIdStr = String(msg.sender);
            io.to(senderIdStr).emit("message_status_update", {
              messageId: msg._id,
              messageStatus: "delivered",
            });
          });
          console.log(`Delivered ${undeliveredMessages.length} pending messages to user: ${userId}`);
        }
      } catch (error) {
        console.error("Error handling user connection:", error);
      }
    });

    /**
     * Return online status of requested user
     */
    socket.on("get_user_status", async (requestedUserId, callback) => {
      try {
        const userIdStr = String(requestedUserId);
        const userSockets = onlineUsers.get(userIdStr);
        const isOnline = userSockets && userSockets.size > 0;
        let lastSeen = null;

        if (isOnline) {
          lastSeen = new Date();
        } else {
          const user = await User.findById(userIdStr).select("lastSeen");
          lastSeen = user ? user.lastSeen : null;
        }

        const status = {
          userId: userIdStr,
          isOnline,
          lastSeen,
        };

        socket.emit("user_status", status);

        if (typeof callback === "function") {
          callback(status);
        }
      } catch (error) {
        console.error("Error in get_user_status:", error);
        const errorStatus = { userId: requestedUserId, isOnline: false, lastSeen: null };
        socket.emit("user_status", errorStatus);
        if (typeof callback === "function") {
          callback(errorStatus);
        }
      }
    });

    /**
     * Forward message to receiver if online
     */
    socket.on("send_message", async (message) => {
      try {
        const receiverId = message.receiver?._id || message.receiver;
        console.log(`Sending message from ${userId} to ${receiverId}`);
        // Emit to user's room (reaches all open tabs)
        io.to(String(receiverId)).emit("receive_message", message);
      } catch (error) {
        console.error("Error sending message:", error);
        socket.emit("message_error", { error: "Failed to send message" });
      }
    });

    /**
     * Handle message receipt acknowledgement (turns single tick to double gray)
     */
    socket.on("message_received", async ({ messageId, senderId }) => {
      try {
        console.log(`Message receipt acknowledged for ID: ${messageId} to sender: ${senderId}`);
        await Message.findByIdAndUpdate(messageId, { messageStatus: "delivered" });
        const rid = String(senderId);
        io.to(rid).emit("message_status_update", {
          messageId,
          messageStatus: "delivered",
        });
      } catch (error) {
        console.error("Error updating delivery status:", error);
      }
    });

    /**
     * Update messages as read and notify sender
     */
    socket.on("message_read", async ({ messageIds, senderId }) => {
      try {
        await Message.updateMany(
          { _id: { $in: messageIds } },
          { $set: { messageStatus: "read" } }
        );

        const rid = String(senderId);
        messageIds.forEach((messageId) => {
          io.to(rid).emit("message_status_update", {
            messageId,
            messageStatus: "read",
          });
        });
      } catch (error) {
        console.error("Error updating message read status:", error);
      }
    });

    /**
     * Handle typing start event and auto-stop after 3s
     */
    socket.on("typing_start", ({ conversationId, receiverId }) => {
      if (!userId || !conversationId || !receiverId) return;

      const rid = String(receiverId);
      if (!typingUsers.has(userId)) typingUsers.set(userId, {});
      const userTyping = typingUsers.get(userId);

      userTyping[conversationId] = true;

      // Clear any existing timeout
      if (userTyping[`${conversationId}_timeout`]) {
        clearTimeout(userTyping[`${conversationId}_timeout`]);
      }

      // Auto-stop typing after 3 seconds
      userTyping[`${conversationId}_timeout`] = setTimeout(() => {
        userTyping[conversationId] = false;
        io.to(rid).emit("user_typing", {
          userId,
          conversationId,
          isTyping: false,
        });
      }, 3000);

      // Notify receiver
      io.to(rid).emit("user_typing", {
        userId,
        conversationId,
        isTyping: true,
      });
    });

    /**
     * Handle manual typing stop event
     */
    socket.on("typing_stop", ({ conversationId, receiverId }) => {
      if (!userId || !conversationId || !receiverId) return;

      const rid = String(receiverId);
      if (typingUsers.has(userId)) {
        const userTyping = typingUsers.get(userId);
        userTyping[conversationId] = false;

        if (userTyping[`${conversationId}_timeout`]) {
          clearTimeout(userTyping[`${conversationId}_timeout`]);
          delete userTyping[`${conversationId}_timeout`];
        }
      }

      io.to(rid).emit("user_typing", {
        userId,
        conversationId,
        isTyping: false,
      });
    });

    /**
     * Add or update reaction on a message
     */
    socket.on(
      "add_reaction",
      async ({ messageId, emoji, userId: reactingUserId }) => {
        try {
          const message = await Message.findById(messageId);
          if (!message) return;

          const existingIndex = message.reactions.findIndex(
            (r) => r.user.toString() === reactingUserId
          );

          if (existingIndex > -1) {
            const existing = message.reactions[existingIndex];
            if (existing.emoji === emoji) {
              // Remove same reaction (toggle off)
              message.reactions.splice(existingIndex, 1);
            } else {
              // Change emoji
              message.reactions[existingIndex].emoji = emoji;
            }
          } else {
            // Add new reaction
            message.reactions.push({ user: reactingUserId, emoji });
          }

          await message.save();

          // Repopulate updated message
          const populatedMessage = await Message.findById(messageId)
            .populate("sender", "username profilePicture")
            .populate("receiver", "username profilePicture")
            .populate("reactions.user", "username");

          const reactionUpdate = {
            messageId,
            reactions: populatedMessage.reactions,
          };

          // Emit to both sender and receiver rooms (reaches all tabs)
          io.to(populatedMessage.sender._id.toString()).emit("reaction_update", reactionUpdate);
          io.to(populatedMessage.receiver._id.toString()).emit("reaction_update", reactionUpdate);
        } catch (error) {
          console.error("Error handling reaction:", error);
        }
      }
    );

    // Handle video call events
    handleVideoCallEvents(socket, io, onlineUsers);

    /**
     * Handle disconnection and mark user offline only if all sockets are gone
     * Includes a 3-second grace period to handle tab refreshes/flickers
     */
    const handleDisconnect = async () => {
      if (!userId) return;
      const currentUserId = String(userId);

      try {
        console.log(`Socket disconnecting: ${socket.id} (User: ${currentUserId})`);
        
        const userSockets = onlineUsers.get(currentUserId);
        if (userSockets) {
          userSockets.delete(socket.id);
          
          if (userSockets.size === 0) {
            // Wait for 3 seconds before marking offline (Grace Period)
            setTimeout(async () => {
              const freshSockets = onlineUsers.get(currentUserId);
              if (!freshSockets || freshSockets.size === 0) {
                console.log(`Grace period ended: User ${currentUserId} is truly offline`);
                onlineUsers.delete(currentUserId);

                // Clear typing status
                if (typingUsers.has(currentUserId)) {
                  const userTyping = typingUsers.get(currentUserId);
                  Object.keys(userTyping).forEach((key) => {
                    if (key.endsWith("_timeout")) clearTimeout(userTyping[key]);
                  });
                  typingUsers.delete(currentUserId);
                }

                await User.findByIdAndUpdate(currentUserId, {
                  isOnline: false,
                  lastSeen: new Date(),
                });

                io.emit("user_status", {
                  userId: currentUserId,
                  isOnline: false,
                  lastSeen: new Date(),
                });
              } else {
                console.log(`Grace period saved user: User ${currentUserId} reconnected in time`);
              }
            }, 3000);
          } else {
            console.log(`User ${currentUserId} still has ${userSockets.size} active sockets`);
          }
        }

        socket.leave(currentUserId);
      } catch (error) {
        console.error("Error handling disconnection:", error);
      }
    };

    // Disconnect event
    socket.on("disconnect", handleDisconnect);
  });

  // Attach the online user map to the socket server for external use
  io.socketUserMap = onlineUsers;

  return io;
};

module.exports = initializeSocket;
