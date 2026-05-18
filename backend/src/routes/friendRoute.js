const express = require('express');
const router = express.Router();
const friendRequestController = require('../controllers/friendRequestController');
const authMiddleware = require('../middlerwares/authMiddleware');

router.post('/send', authMiddleware, friendRequestController.sendFriendRequest);
router.get('/requests', authMiddleware, friendRequestController.getFriendRequests);
router.post('/respond', authMiddleware, friendRequestController.respondToRequest);
router.get('/list', authMiddleware, friendRequestController.getFriends);

module.exports = router;
