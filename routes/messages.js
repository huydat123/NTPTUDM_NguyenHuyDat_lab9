const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const multer = require('multer');

const Message = require('../schemas/messages');
const authHandler = require('../utils/authHandler');

// Dùng middleware auth có sẵn của project nếu có.
// Nếu tên hàm trong project bạn khác CheckLogin thì đổi lại ở đây.
const authMiddleware =
  authHandler.CheckLogin ||
  authHandler.checkLogin ||
  authHandler.CheckAuth ||
  authHandler.checkAuth ||
  function (req, res, next) {
    next();
  };

const uploadDir = path.join(process.cwd(), 'uploads', 'messages');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname || '');
    const safeName = Date.now() + '-' + Math.round(Math.random() * 1e9) + ext;
    cb(null, safeName);
  }
});

const upload = multer({ storage: storage });

function getCurrentUserId(req) {
  return (
    req.user?._id ||
    req.user?.id ||
    req.auth?._id ||
    req.auth?.id ||
    req.payload?._id ||
    req.payload?.id ||
    req.decoded?._id ||
    req.decoded?.id ||
    req.loginUser?._id ||
    req.loginUser?.id ||
    req.currentUser?._id ||
    req.currentUser?.id ||
    null
  );
}

function toObjectId(id) {
  return new mongoose.Types.ObjectId(id);
}

// GET /api/v1/messages/:userId
// Lấy toàn bộ tin nhắn giữa user hiện tại và userId
router.get('/:userId', authMiddleware, async function (req, res) {
  try {
    const currentUserId = getCurrentUserId(req);
    const userId = typeof req.params.userId === 'string' ? req.params.userId.trim() : '';

    if (!currentUserId) {
      return res.status(401).send({ message: 'Unauthorized.' });
    }

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).send({ message: 'Invalid user id.' });
    }

    const rows = await Message.find({
      $or: [
        { from: currentUserId, to: userId },
        { from: userId, to: currentUserId }
      ]
    })
      .populate('from', 'username email fullName name')
      .populate('to', 'username email fullName name')
      .sort({ createdAt: 1 });

    res.send(rows);
  } catch (error) {
    console.error('GET /messages/:userId error:', error);
    res.status(500).send({ message: error.message || 'Server error.' });
  }
});

// POST /api/v1/messages
// Gửi tin nhắn text hoặc file
router.post('/', authMiddleware, upload.single('file'), async function (req, res) {
  try {
    const currentUserId = getCurrentUserId(req);
    const to = typeof req.body.to === 'string' ? req.body.to.trim() : '';
    const text = typeof req.body.text === 'string' ? req.body.text.trim() : '';

    if (!currentUserId) {
      return res.status(401).send({ message: 'Unauthorized.' });
    }

    if (!mongoose.Types.ObjectId.isValid(to)) {
      return res.status(400).send({ message: 'Invalid receiver id.' });
    }

    let messageContent = null;

    if (req.file) {
      const relativePath = ('uploads/messages/' + req.file.filename).replace(/\\/g, '/');
      messageContent = {
        type: 'file',
        text: relativePath
      };
    } else {
      if (!text) {
        return res.status(400).send({ message: 'Text is required when no file is uploaded.' });
      }

      messageContent = {
        type: 'text',
        text: text
      };
    }

    const created = await Message.create({
      from: currentUserId,
      to: to,
      messageContent: messageContent
    });

    const row = await Message.findById(created._id)
      .populate('from', 'username email fullName name')
      .populate('to', 'username email fullName name');

    res.status(201).send(row);
  } catch (error) {
    console.error('POST /messages error:', error);
    res.status(500).send({ message: error.message || 'Server error.' });
  }
});

// GET /api/v1/messages
// Lấy tin nhắn cuối cùng của mỗi user có hội thoại với user hiện tại
router.get('/', authMiddleware, async function (req, res) {
  try {
    const currentUserId = getCurrentUserId(req);

    if (!currentUserId) {
      return res.status(401).send({ message: 'Unauthorized.' });
    }

    const currentObjectId = toObjectId(currentUserId);

    const rows = await Message.aggregate([
      {
        $match: {
          $or: [
            { from: currentObjectId },
            { to: currentObjectId }
          ]
        }
      },
      {
        $addFields: {
          conversationUser: {
            $cond: [
              { $eq: ['$from', currentObjectId] },
              '$to',
              '$from'
            ]
          }
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$conversationUser',
          lastMessage: { $first: '$$ROOT' }
        }
      },
      {
        $replaceRoot: { newRoot: '$lastMessage' }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'conversationUser',
          foreignField: '_id',
          as: 'conversationUserInfo'
        }
      },
      {
        $unwind: {
          path: '$conversationUserInfo',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ]);

    res.send(rows);
  } catch (error) {
    console.error('GET /messages error:', error);
    res.status(500).send({ message: error.message || 'Server error.' });
  }
});

module.exports = router;