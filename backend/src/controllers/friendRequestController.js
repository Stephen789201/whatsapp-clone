const FriendRequest = require('../../models/FriendRequest');
const User = require('../../models/User');
const response = require('../../utils/responseHandler');

// Send a friend request
exports.sendFriendRequest = async (req, res) => {
    const { receiverId } = req.body;
    const senderId = req.user.id;

    if (senderId === receiverId) {
        return response(res, 400, "You cannot send a request to yourself");
    }

    try {
        // Check if already friends
        const sender = await User.findById(senderId);
        if (sender.friends.includes(receiverId)) {
            return response(res, 400, "You are already friends");
        }

        // Check if a request already exists
        const existingRequest = await FriendRequest.findOne({
            sender: senderId,
            receiver: receiverId
        });

        if (existingRequest) {
            return response(res, 400, "Request already sent");
        }

        const newRequest = new FriendRequest({
            sender: senderId,
            receiver: receiverId
        });

        await newRequest.save();

        // Emit socket event for real-time notification
        if (req.io) {
            req.io.to(receiverId).emit("new_friend_request", {
                senderId,
                senderName: sender.username,
                requestId: newRequest._id
            });
        }

        return response(res, 201, "Friend request sent successfully", newRequest);
    } catch (error) {
        console.error("Error sending friend request:", error);
        return response(res, 500, "Internal server error");
    }
};

// Get pending friend requests
exports.getFriendRequests = async (req, res) => {
    const userId = req.user.id;
    try {
        const requests = await FriendRequest.find({
            receiver: userId,
            status: 'pending'
        }).populate('sender', 'username profilePicture email');

        return response(res, 200, "Friend requests retrieved", requests);
    } catch (error) {
        console.error("Error fetching friend requests:", error);
        return response(res, 500, "Internal server error");
    }
};

// Respond to a friend request (Accept/Reject)
exports.respondToRequest = async (req, res) => {
    const { requestId, status } = req.body; // status: 'accepted' or 'rejected'
    const userId = req.user.id;

    try {
        const friendRequest = await FriendRequest.findById(requestId);

        if (!friendRequest || friendRequest.receiver.toString() !== userId) {
            return response(res, 404, "Request not found");
        }

        friendRequest.status = status;
        await friendRequest.save();

        if (status === 'accepted') {
            // Add to each other's friends list
            await User.findByIdAndUpdate(friendRequest.sender, {
                $addToSet: { friends: friendRequest.receiver }
            });
            await User.findByIdAndUpdate(friendRequest.receiver, {
                $addToSet: { friends: friendRequest.sender }
            });

            // Emit socket event to both parties
            if (req.io) {
                req.io.to(friendRequest.sender.toString()).emit("friend_request_accepted", {
                    friendId: userId,
                    status: 'accepted'
                });
            }
        }

        return response(res, 200, `Request ${status} successfully`);
    } catch (error) {
        console.error("Error responding to friend request:", error);
        return response(res, 500, "Internal server error");
    }
};

// Get list of friends
exports.getFriends = async (req, res) => {
    const userId = req.user.id;
    try {
        // 🛠️ AUTO-REPAIR: Ensure mutual friendship based on accepted requests
        const acceptedRequests = await FriendRequest.find({
            $or: [
                { sender: userId, status: 'accepted' },
                { receiver: userId, status: 'accepted' }
            ]
        });

        const friendIdsFromRequests = acceptedRequests.map(req => 
            req.sender.toString() === userId ? req.receiver.toString() : req.sender.toString()
        );

        if (friendIdsFromRequests.length > 0) {
            await User.findByIdAndUpdate(userId, {
                $addToSet: { friends: { $each: friendIdsFromRequests } }
            });
            
            // Also repair the other side for each friend
            for (const friendId of friendIdsFromRequests) {
                await User.findByIdAndUpdate(friendId, {
                    $addToSet: { friends: userId }
                });
            }
        }

        const user = await User.findById(userId).populate('friends', 'username profilePicture isOnline lastSeen about');
        console.log(`User ${userId} retrieving friends. Found: ${user.friends?.length || 0} (Auto-Repaired: ${friendIdsFromRequests.length})`);
        return response(res, 200, "Friends retrieved", user.friends);
    } catch (error) {
        console.error("Error fetching friends:", error);
        return response(res, 500, "Internal server error");
    }
};
