const multer = require('multer');
const cloudinary = require('cloudinary').v2;
require('dotenv').config();
const fs = require('fs'); // Needed to clean up temp files

// Correct environment variable keys
// cloudinary.config({
//     cloud_name: process.env.CLOUDINARY_NAME,       // typo fixed
//     api_key: process.env.CLOUDINARY_API_KEY,       // typo fixed
//     api_secret: process.env.CLOUDINARY_API_SECRET, // typo fixed
// });

// Upload function
const uploadFileToCloudinary = (file) => {
    const isAudioOrVideo = file.mimetype.startsWith('video') || file.mimetype.startsWith('audio') || file.mimetype.includes('webm') || file.mimetype.includes('ogg');
    
    const options = {
        resource_type: isAudioOrVideo ? 'video' : 'auto',
    };

    return new Promise((resolve, reject) => {
        const uploader = (file.mimetype.startsWith('video') || file.mimetype.startsWith('audio') || file.mimetype.includes('webm'))
            ? cloudinary.uploader.upload_large 
            : cloudinary.uploader.upload;

        uploader(file.path, options, (error, result) => {
            fs.unlink(file.path, () => {});
            if (error) {
                return reject(error);
            }
            resolve(result);
        });
    });
};

const path = require('path');

// Multer for local file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    let ext = path.extname(file.originalname);
    if (!ext && file.mimetype.includes('webm')) ext = '.webm';
    if (!ext && file.mimetype.includes('audio')) ext = '.mp3';
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  }
});

const multerMiddleware = multer({ storage: storage }).single('media');

module.exports = {
    multerMiddleware,
    uploadFileToCloudinary
};
