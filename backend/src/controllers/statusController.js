const Status = require("../../models/Status")
const User = require("../../models/User")
const { uploadFileToCloudinary } = require("../../config/cloudinaryConfig")
const response = require("../../utils/responseHandler")

exports.createStatus = async (req, res) => {
  const { content, contentType, caption } = req.body
  const userId = req.user.id
  const file = req.file

  try {
    const user = await User.findById(userId).select('friends');
    const friendIds = user.friends?.map(f => f.toString()) || [];

    let mediaUrl = null
    let finalContentType = contentType || "text"

    if (file) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      mediaUrl = `${baseUrl}/uploads/${file.filename}`;

      if (file.mimetype.startsWith("image")) {
        finalContentType = "image";
      } else if (file.mimetype.startsWith("video")) {
        finalContentType = "video";
      }
    }

    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + 24)

    const status = new Status({
      user: userId,
      content: mediaUrl || content,
      contentType: finalContentType,
      caption: caption || "",
      expiresAt,
    })

    await status.save()

    const populatedStatus = await Status.findById(status._id)
      .populate("user", "username profilePicture")
      .populate("viewers", "username profilePicture")

    // ✅ EMIT SOCKET EVENT - Only to friends
    if (req.io && req.socketUserMap) {
      for (const [connectedUserId, socketId] of req.socketUserMap) {
        if (friendIds.includes(connectedUserId)) {
          req.io.to(socketId).emit("new_status", populatedStatus)
        }
      }
    } 

    return response(res, 201, "Status created successfully", populatedStatus)
  } catch (error) {
    console.error("Error creating status:", error)
    return response(res, 500, error.message)
  }
}

exports.getStatuses = async (req, res) => {
  const userId = req.user.id;
  
  // ANTI-CACHE: Force fresh status retrieval
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  try {
    // 1. Get IDs from Accepted Friend Requests (Auto-Repair)
    const FriendRequest = require('../../models/FriendRequest');
    const acceptedRequests = await FriendRequest.find({
        $or: [
            { sender: userId, status: 'accepted' },
            { receiver: userId, status: 'accepted' }
        ]
    });
    const friendIdsFromRequests = acceptedRequests.map(req => 
        req.sender.toString() === userId ? req.receiver.toString() : req.sender.toString()
    );

    // 2. Get IDs from Active Conversations (Communication Link)
    const Conversation = require('../../models/Conversation');
    const myConversations = await Conversation.find({
        participants: userId
    }).select('participants');
    const conversationPartnerIds = myConversations.flatMap(conv => 
        conv.participants.map(p => p.toString())
    ).filter(id => id !== userId);

    // 3. Get Official Friends List
    const user = await User.findById(userId).select('friends');
    const friendIds = user.friends?.map(f => f.toString()) || [];
    
    // Combine all "Trust Signals" into one list
    const allAuthorizedIds = new Set([
        userId, 
        ...friendIds, 
        ...friendIdsFromRequests, 
        ...conversationPartnerIds
    ]);

    const visibleUserIds = Array.from(allAuthorizedIds);
    
    console.log(`Status Fetch for User ${userId}. Authorized IDs: ${visibleUserIds.length}`);
    
    const statuses = await Status.find({
      user: { $in: visibleUserIds },
      expiresAt: { $gt: new Date() },
    })
      .populate("user", "username profilePicture")
      .populate("viewers", "username profilePicture")
      .sort({ createdAt: -1 })

    // 🧹 DEEP-CLEAN: Automatically remove current user from their own status viewer lists
    const cleanedStatuses = statuses.map(status => {
        if (status.user._id.toString() === userId) {
            status.viewers = status.viewers.filter(v => v._id.toString() !== userId);
        }
        return status;
    });

    return response(res, 200, "Statuses retrieved successfully", cleanedStatuses)
  } catch (error) {
    console.error("Error getting statuses:", error)
    return response(res, 500, error.message)
  }
}

exports.viewStatus = async (req, res) => {
  const { statusId } = req.params
  const userId = req.user.id

  try {
    const status = await Status.findById(statusId)
    if (!status) {
      return response(res, 404, "Status not found")
    }

    // 1. Authorization Check (Triple-Layer Trust)
    const FriendRequest = require('../../models/FriendRequest');
    const Conversation = require('../../models/Conversation');

    const [acceptedRequest, conversation] = await Promise.all([
      FriendRequest.findOne({
        $or: [
          { sender: userId, receiver: status.user, status: 'accepted' },
          { sender: status.user, receiver: userId, status: 'accepted' }
        ]
      }),
      Conversation.findOne({
        participants: { $all: [userId, status.user] }
      })
    ]);

    const user = await User.findById(userId).select('friends');
    const isOfficialFriend = user.friends?.some(fId => fId.toString() === status.user.toString());
    const isOwner = status.user.toString() === userId;

    if (!isOwner && !isOfficialFriend && !acceptedRequest && !conversation) {
      return response(res, 403, "You are not authorized to view this status")
    }

    // 🛠️ PROACTIVE CLEANUP: Remove owner from viewers if they somehow got in (legacy data)
    if (status.viewers.some(vId => vId.toString() === status.user.toString())) {
        status.viewers = status.viewers.filter(vId => vId.toString() !== status.user.toString());
        await status.save();
    }

    // 2. Viewer Update (Exclude Owner)
    const alreadyViewed = status.viewers.some(vId => vId.toString() === userId);
    
    if (!isOwner && !alreadyViewed) {
      status.viewers.push(userId);
      await status.save();

      // 3. Real-time Notification
      if (req.io) {
        const statusOwnerId = status.user.toString();
        const updatedStatus = await Status.findById(statusId).populate("viewers", "username profilePicture");
        
        req.io.to(statusOwnerId).emit("status_viewed", {
          statusId,
          viewerId: userId,
          totalViewers: updatedStatus.viewers.length,
          viewers: updatedStatus.viewers,
        });
      }
    }

    return response(res, 200, "Status viewed successfully")
  } catch (error) {
    console.error("Error viewing status:", error)
    return response(res, 500, error.message)
  }
}

exports.deleteStatus = async (req, res) => {
  const { statusId } = req.params
  const userId = req.user.id


  try {
    const status = await Status.findById(statusId)
    if (!status) {
      return response(res, 404, "Status not found")
    }

    if (status.user.toString() !== userId) {
      return response(res, 403, "Not authorized to delete this status")
    }

    await status.deleteOne()
    console.log('Status deleted from database')

    // Delete physical file if exists
    if ((status.contentType === "image" || status.contentType === "video") && status.content) {
      try {
        const fs = require('fs');
        const path = require('path');
        const filename = status.content.split('/').pop();
        const filePath = path.join(__dirname, '../../uploads', filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log('Physical file deleted:', filePath);
        }
      } catch (err) {
        console.error('Error deleting physical file:', err);
      }
    }

    // ✅ EMIT SOCKET EVENT
    if (req.io && req.socketUserMap) {
      let emittedCount = 0;
      // Broadcast to all connected users except the deleter
      for (const [connectedUserId, socketId] of req.socketUserMap) {
        if (connectedUserId !== userId) {
          req.io.to(socketId).emit("status_deleted", statusId)
          emittedCount++;
        }
      }
      
      console.log(`Emitted status_deleted to ${emittedCount} users`)
    } 
    return response(res, 200, "Status deleted successfully")
  } catch (error) {
    console.error("Error deleting status:", error)
    return response(res, 500, error.message)
  }
}
