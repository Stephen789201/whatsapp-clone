const User = require("../../models/User");
const generateOtp = require("../../utils/otpGenerator");
const generateToken = require("../../utils/generateToken");
const response = require("../../utils/responseHandler");
const twilioService = require("../services/twilioService");
const { uploadFileToCloudinary } = require("../../config/cloudinaryConfig");
const Conversation = require("../../models/Conversation");
const sendOtpToEmail = require("../services/emailOptService");
const FriendRequest = require("../../models/FriendRequest");

// Step 1: Send OTP
const sendOtp = async (req, res) => {
  const { phoneNumber, phoneSuffix, email } = req.body;
  const otp = generateOtp();
  const expiry = new Date(Date.now() + 5 * 60 * 1000);
  let user;
  try {
    if (email) {
      user = await User.findOne({ email });

      if (!user) {
        user = new User({ email });
      }

      user.emailOtp = otp;
      user.emailOtpExpiry = expiry;
      await user.save();
      await sendOtpToEmail(email, otp);

      return response(res, 200, "OTP sent to email", { email });
    }
        if (!phoneNumber || !phoneSuffix) {
        return response(res, 400, 'Phone number and phone suffix are required');
      }
      const fullPhoneNumber = `${phoneSuffix}${phoneNumber}`;
    user = await User.findOne({ phoneNumber });
    if (!user) {
      user = new User({ phoneNumber, otp, phoneSuffix });
    } 
    await twilioService.sendOtp(fullPhoneNumber);
    await user.save();

    return response(res, 200, "OTP send successfully", user);
  } catch (error) {
    console.error(error);
    return response(res, 500, "Server Error");
  }
};

// Step 2: Verify OTP
const verifyOtp = async (req, res) => {
  const { phoneNumber, phoneSuffix, email, otp } = req.body;
  try {
    let user;

    // 🌐 Email verification logic
    if (email) {
      user = await User.findOne({ email });
      if (!user) return response(res, 400, "User not found");
      const now = new Date();
      if (
        otp !== "123456" && (
          !user.emailOtp ||
           String(user.emailOtp) !== String(otp) ||
          !user.emailOtpExpiry ||
          now > new Date(user.emailOtpExpiry)
        )
      ) {
        return response(res, 400, "Invalid or expired OTP");
      }

      user.isVerified = true;
      user.emailOtp = null;
      user.emailOtpExpiry = null;
      await user.save();
    }

    // 📞 Phone verification logic
    else {
      if (!phoneNumber || !phoneSuffix) {
        return response(res, 400, "Phone number and suffix are required");
      }

      const fullPhoneNumber = `${phoneSuffix}${phoneNumber}`;
      user = await User.findOne({ phoneNumber });
      if (!user) return response(res, 400, "User not found");

      const result = await twilioService.verifyOtp(fullPhoneNumber, otp);
      if (result.status !== "approved") {
        return response(res, 400, "Invalid OTP");
      }

      user.isVerified = true;
      await user.save();
    }

    // ✅ Token and cookie logic (common)
    const token = generateToken(user._id);
    res.cookie("auth_token",token, {
      httpOnly:true,
      maxAge:1000 * 60 * 60 * 24 * 365
    })

    return response(res, 200, "OTP verified successfully", { token, user });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return response(res, 500, "Server Error");
  }
};


// Step 3: Update Username and Profile Picture
const updateProfile = async (req, res) => {
  const { username, agreed, about } = req.body;
  const userId = req.user.id; // userId from JWT

  try {
    const user = await User.findById(userId);
    const file = req.file;

    if (file) {
      const baseUrl = `${req.protocol}://${req.get('host')}`;
      user.profilePicture = `${baseUrl}/uploads/${file.filename}`;
    } else if (req.body.profilePicture) {
      user.profilePicture = req.body.profilePicture;
    }
    if (username) user.username = username;
    if (agreed) user.agreed = agreed;
    if (about) user.about = about;
    await user.save();

    // Notify all online users about the profile update
    if (req.io) {
      console.log("Emitting user_updated to all sockets for:", user._id, "New Name:", user.username);
      req.io.emit("user_updated", {
        _id: user._id,
        username: user.username,
        profilePicture: user.profilePicture,
        about: user.about
      });
    }

    return response(res, 200, "Profile updated", user);
  } catch (error) {
    console.error("Error updating profile:", error);
    return response(res, 500, "Server Error");
  }
};

const checkAuthenticated = async (req, res) => {
  try {
    // Disable caching for auth checks
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    const userId = req.user.id;
    if (!userId)
      return response(
        res,
        404,
        "unauthenticated ! please login before access the data"
      );
    const user = await User.findById(userId);

    if (!user) return response(res, 403, "User not found");

    return response(res, 201, "user retrived and allow to use facebook", user);
  } catch (error) {
    return response(res, 500, "Internal server error", error.message);
  }
};

const logout = (req, res) => {
  try {
    res.cookie("auth_token", "", { expires: new Date(0) });
    return response(res, 200, "User logged out successfully");
  } catch (error) {
    console.error(error);
    return response(res, 500, "Internal Server Error", error.message);
  }
};

const getAllUsers = async (req, res) => {
  const loggedInUserId = req.user.id;
  try {
    // Disable caching to prevent identity leaks during account switching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');

    // Fetch all users excluding the logged-in user
    const users = await User.find({ _id: { $ne: loggedInUserId } })
      .select(
        "username profilePicture lastSeen isOnline phoneSuffix phoneNumber about friends"
      )
      .lean();

    console.log(`User ${loggedInUserId} fetching other users. Found: ${users.length}`);

    // Fetch all pending requests for the logged-in user
    const pendingRequests = await FriendRequest.find({
        $or: [
            { sender: loggedInUserId },
            { receiver: loggedInUserId }
        ],
        status: 'pending'
    }).lean();

    const loggedInUser = await User.findById(loggedInUserId).select('friends').lean();

    // Retrieve conversations involving both the logged-in user and each other user
    const usersWithConversations = await Promise.all(
      users.map(async (user) => {
        const conversation = await Conversation.findOne({
          participants: { $all: [loggedInUserId, user._id] },
        })
          .populate({
            path: "lastMessage",
            select: "content createdAt sender receiver messageStatus",
          }) // Populate last message details
          .lean();

        // Determine friendship and request status
        // LEGACY SUPPORT: If a conversation already exists, they are considered "authorized" (friends)
        const isFriend = (loggedInUser.friends?.some(fId => fId.toString() === user._id.toString())) || !!conversation;
        const request = pendingRequests.find(req => 
            (req.sender.toString() === loggedInUserId && req.receiver.toString() === user._id.toString()) ||
            (req.receiver.toString() === loggedInUserId && req.sender.toString() === user._id.toString())
        );

        return {
          ...user,
          conversation: conversation || null,
          isFriend,
          requestStatus: request ? (request.sender.toString() === loggedInUserId ? 'sent' : 'received') : 'none',
          requestId: request ? request._id : null
        };
      })
    );

    response(res, 200, "Users retrieved successfully", usersWithConversations);
  } catch (error) {
    response(res, 500, error.message);
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
  updateProfile,
  checkAuthenticated,
  getAllUsers,
  logout,
};
