const Conversation = require("../../models/Conversation");
const Message = require("../../models/Message");
const { uploadFileToCloudinary } = require("../../config/cloudinaryConfig");
const response = require("../../utils/responseHandler");
const fs = require('fs');
const path = require('path');

// Send a message (text/image/video)
exports.sendMessage = async (req, res) => {
  const { senderId, receiverId, content, messageStatus, parentMessage } = req.body;
  const file = req.file;
  try {
    // Sort participants to maintain consistent conversation key
    const participants = [senderId, receiverId].sort();

    
    // Check if conversation already exits
    let conversation = await Conversation.findOne({
      participants: participants,
    });

    // Create new conversation if not found
    if (!conversation) {
      conversation = new Conversation({
        participants,
        unreadCount: 0,
      });
      await conversation.save();
    }

    let imageOrVideoUrl = null;
    let audioUrl = null;
    let documentUrl = null;
    let contentType = null;
    let finalContent = content;

    // Handle file upload (image, video, audio, or document)
    if (file) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const fileUrl = `${baseUrl}/uploads/${file.filename}`;
      
      console.log("Local file saved:", {
        filename: file.filename,
        mimetype: file.mimetype,
        url: fileUrl
      });

      if (file.mimetype.startsWith("image")) {
        imageOrVideoUrl = fileUrl;
        contentType = "image";
      } else if (file.mimetype.startsWith("video")) {
        imageOrVideoUrl = fileUrl;
        contentType = "video";
      } else if (file.mimetype.startsWith("audio") || file.mimetype.includes("webm") || file.mimetype.includes("ogg") || file.mimetype.includes("audio")) {
        audioUrl = fileUrl;
        contentType = "audio";
      } else if (file.mimetype === "application/pdf" || file.mimetype.startsWith("application/") || file.mimetype.startsWith("text/")) {
        documentUrl = fileUrl;
        contentType = "document";
        if (!finalContent || !finalContent.trim()) {
          finalContent = file.originalname;
        }
      } else {
        return response(res, 400, "Unsupported file type");
      }
    } else if (content?.trim()) {
      contentType = "text";
    } else {
      return response(res, 400, "Message content is required");
    }

    // Determine initial status based on receiver online presence
    const isReceiverOnline = req.socketUserMap?.has(String(receiverId));
    const finalStatus = messageStatus || (isReceiverOnline ? "delivered" : "send");

    // Save message to DB
    const message = new Message({
      conversation: conversation._id,
      sender: senderId,
      receiver: receiverId,
      content: finalContent,
      imageOrVideoUrl,
      audioUrl,
      documentUrl,
      contentType,
      messageStatus: finalStatus,
      parentMessage: parentMessage || null,
    });

    await message.save();

    // Update conversation metadata
    conversation.lastMessage = message._id;
    conversation.unreadCount += 1;
    await conversation.save();

    // Populate sender and receiver info
    const populatedMessage = await Message.findById(message._id)
      .populate("sender", "username profilePicture")
      .populate("receiver", "username profilePicture")
      .populate({
        path: "parentMessage",
        populate: {
          path: "sender",
          select: "username"
        }
      });

    // Get fresh conversation with participants populated
    const populatedConversation = await Conversation.findById(conversation._id)
      .populate("participants", "username profilePicture isOnline lastSeen")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender receiver",
          select: "username profilePicture",
        },
      });

    // Notify both parties via socket
    if (req.io) {
      const rid = String(receiverId);
      const sid = String(senderId);

      // 1. Emit the message to the receiver
      req.io.to(rid).emit("receive_message", populatedMessage.toObject());

      // 2. Emit the conversation update to both (for the sidebar)
      req.io.to(sid).emit("new_conversation", populatedConversation.toObject());
      req.io.to(rid).emit("new_conversation", populatedConversation.toObject());
      
      // 3. Already marked delivered before save if receiver was online
    }

    console.log("SUCCESS: Message sent and conversation synced.");
    return response(res, 201, "Message sent", populatedMessage);
  } catch (error) {
    console.error("Error sending message:", error);
    return response(res, 500, error.message || "Internal server error");
  }
};

// Get all conversations of logged-in user
exports.getConversations = async (req, res) => {
  const userId = req.user.id;

  try {
    // Disable caching to prevent session leaks during account switching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    let conversations = await Conversation.find({
      participants: userId,
    })
      .populate("participants", "username profilePicture isOnline lastSeen")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender receiver",
          select: "username profilePicture",
        },
      })
      .sort({ updatedAt: -1 }); // Most recent first

    // STRICT PRIVACY: Filter out "Self-Conversations" where the other participant is also me
    conversations = conversations.filter(conv => 
      conv.participants.some(p => p._id.toString() !== userId)
    );

    return response(res, 200, "Conversations retrieved", conversations);
  } catch (error) {
    console.error("Error getting conversations:", error);
    return response(res, 500, error.message);
  }
};

// Get messages of a specific conversation
exports.getMessages = async (req, res) => {
  const { conversationId } = req.params;
  const userId = req.user.id;

  try {
    // Validate conversation
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return response(res, 404, "Conversation not found");
    }

    // Check access permission
    if (!conversation.participants.includes(userId)) {
      return response(res, 403, "Not authorized to view this conversation");
    }

    // Fetch messages sorted by creation time
    const messages = await Message.find({ conversation: conversationId })
      .populate("sender", "username profilePicture")
      .populate("receiver", "username profilePicture")
      .populate({
        path: "parentMessage",
        populate: {
          path: "sender",
          select: "username"
        }
      })
      .sort("createdAt");

    // Find unread messages to get their sender IDs before updating
    const unreadMessages = await Message.find({
      conversation: conversationId,
      receiver: userId,
      messageStatus: { $in: ["send", "delivered"] },
    });

    if (unreadMessages.length > 0) {
      await Message.updateMany(
        {
          conversation: conversationId,
          receiver: userId,
          messageStatus: { $in: ["send", "delivered"] },
        },
        { $set: { messageStatus: "read" } }
      );

      // Notify the senders via socket in real-time
      if (req.io) {
        const senderGroups = unreadMessages.reduce((acc, msg) => {
          const sid = msg.sender.toString();
          if (!acc[sid]) acc[sid] = [];
          acc[sid].push(msg._id);
          return acc;
        }, {});

        for (const [senderId, ids] of Object.entries(senderGroups)) {
          req.io.to(senderId).emit("messages_read", {
            messageIds: ids,
            receiverId: userId,
          });
        }
      }
    }

    // Reset conversation unread count
    conversation.unreadCount = 0;
    await conversation.save();

    return response(res, 200, "Messages retrieved", messages);
  } catch (error) {
    console.error("Error getting messages:", error);
    return response(res, 500, error.message);
  }
};

// Mark multiple messages as read
exports.markAsRead = async (req, res) => {
  const { messageIds } = req.body;
  const userId = req.user.id;

  try {
    // Get relevant messages to determine senders
    let messages = await Message.find({
      _id: { $in: messageIds },
      receiver: userId,
    });

    // Update messageStatus to "read"
    await Message.updateMany(
      { _id: { $in: messageIds }, receiver: userId },
      { $set: { messageStatus: "read" } }
    );

    // Notify original senders in real-time
    if (req.io) {
      // Group message IDs by sender to minimize socket emits
      const senderGroups = messages.reduce((acc, msg) => {
        const sid = msg.sender.toString();
        if (!acc[sid]) acc[sid] = [];
        acc[sid].push(msg._id);
        return acc;
      }, {});

      for (const [senderId, ids] of Object.entries(senderGroups)) {
        // Emit to the sender's room
        req.io.to(senderId).emit("messages_read", {
          messageIds: ids,
          receiverId: userId,
        });
      }
    }

    return response(res, 200, "Messages marked as read");
  } catch (error) {
    console.error("Error marking messages as read:", error);
    return response(res, 500, error.message);
  }
};

// Delete a message (only by sender)
exports.deleteMessage = async (req, res) => {
  const { messageId } = req.params;
  const { deleteType } = req.body; // 'me' or 'everyone'
  const userId = req.user.id;

  try {
    const message = await Message.findById(messageId);
    if (!message) {
      return response(res, 404, "Message not found");
    }

    if (deleteType === "everyone") {
      // Permission check: only sender can delete for everyone
      if (message.sender.toString() !== userId) {
        return response(res, 403, "Only the sender can delete for everyone");
      }

      // 1. Delete physical file from storage
      if (message.audioUrl || message.imageOrVideoUrl) {
        const mediaUrl = message.audioUrl || message.imageOrVideoUrl;
        if (mediaUrl.includes("/uploads/")) {
          const filename = mediaUrl.split("/").pop();
          const filePath = path.join(__dirname, "../../uploads", filename);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            console.log("SUCCESS: Physical file removed for everyone:", filename);
          }
        }
      }

      // 2. Update message record to "Deleted" state
      message.content = "🚫 This message was deleted";
      message.contentType = "text";
      message.isDeleted = true;
      message.audioUrl = null;
      message.imageOrVideoUrl = null;
      message.reactions = []; // Clear reactions too
      await message.save();

      // 3. Notify both parties in real-time with the UPDATED message
      if (req.io) {
        const updatePayload = {
          messageId: message._id,
          updatedMessage: message
        };
        req.io.to(message.sender.toString()).emit("message_deleted_everyone", updatePayload);
        req.io.to(message.receiver.toString()).emit("message_deleted_everyone", updatePayload);
      }

      return response(res, 200, "Message deleted for everyone", message);
    } else {
      // Delete for Me: Hide from current user
      if (!message.deletedFor.includes(userId)) {
        message.deletedFor.push(userId);
        await message.save();
      }

      return response(res, 200, "Message deleted for you");
    }
  } catch (error) {
    console.error("Error deleting message:", error);
    return response(res, 500, error.message || "Internal server error");
  }
};
