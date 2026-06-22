import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

// Set up Cloudinary storage for multer
// This tells multer to upload files directly to Cloudinary instead of saving locally
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'intellmeet-avatars', // folder name in Cloudinary
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'], // only allow image files
    transformation: [{ width: 300, height: 300, crop: 'fill' }], // auto-resize to 300x300
  },
});

// Create the multer upload middleware
const upload = multer({ storage: storage });

export default upload;
