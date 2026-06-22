import User from '../models/User.js';
import bcrypt from 'bcryptjs';

// @desc    Get the logged-in user's profile
// @route   GET /api/profile
// @access  Private (requires JWT)
export const getProfile = async (req, res) => {
  console.log('--> GET /api/profile called for user ID:', req.user.id);
  try {
    // Find the user by ID and select all fields except the password
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      console.log('--> User not found in database');
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    console.log('--> User profile fetched successfully:', user.email);
    // Send back the user profile in standard format
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    console.error('[profileController] getProfile error:', err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};

// @desc    Update profile fields (name, bio, phone, avatar)
// @route   PUT /api/profile
// @access  Private (requires JWT)
export const updateProfile = async (req, res) => {
  console.log('--> PUT /api/profile called for user ID:', req.user.id);
  console.log('--> Request body received:', req.body);
  try {
    // Explicitly block email or password updates on this route
    if (req.body.email || req.body.password) {
      console.log('--> Blocked attempt to update email or password on general profile route');
      return res.status(400).json({
        success: false,
        error: 'Email and password cannot be changed here. Please use the designated endpoints.'
      });
    }

    // Only allow name, bio, phone, and avatar to be updated here
    const allowedFields = ['name', 'bio', 'phone', 'avatar'];
    const updates = {};

    // Only add field to updates if it is provided in the request body
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Check if there is at least one valid field to update
    if (Object.keys(updates).length === 0) {
      console.log('--> No valid fields provided for update');
      return res.status(400).json({
        success: false,
        error: 'No valid fields provided for update'
      });
    }

    // Update the user in the database and return the updated user (exclude password)
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      console.log('--> User not found for update');
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    console.log('--> Profile updated successfully for user:', user.email);
    // Return success format with the updated user data
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    console.error('[profileController] updateProfile error:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
};

// @desc    Change password (verify old password first)
// @route   PUT /api/profile/password
// @access  Private (requires JWT)
export const changePassword = async (req, res) => {
  console.log('--> PUT /api/profile/password called for user ID:', req.user.id);
  try {
    // Support both oldPassword (from instructions) and currentPassword (from frontend UI)
    const oldPassword = req.body.oldPassword || req.body.currentPassword;
    const { newPassword } = req.body;

    // Both current password and new password are required
    if (!oldPassword || !newPassword) {
      console.log('--> Missing old password or new password');
      return res.status(400).json({
        success: false,
        error: 'Please provide both current password and new password'
      });
    }

    // Check minimum length for the new password
    if (newPassword.length < 6) {
      console.log('--> New password too short');
      return res.status(400).json({
        success: false,
        error: 'New password must be at least 6 characters long'
      });
    }

    // We must select the password field since the User schema excludes it by default
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      console.log('--> User not found');
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Compare entered old password with hashed password in database using bcrypt
    const isMatch = await user.matchPassword(oldPassword);
    if (!isMatch) {
      console.log('--> Current password verification failed');
      return res.status(401).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Set new password (the User schema\'s pre-save middleware will hash it with bcrypt)
    user.password = newPassword;
    await user.save();

    console.log('--> Password changed successfully for user:', user.email);

    // Fetch the updated user details without the password to return in response
    const updatedUser = await User.findById(req.user.id).select('-password');

    // Return success with updated user data
    res.status(200).json({
      success: true,
      data: updatedUser
    });
  } catch (err) {
    console.error('[profileController] changePassword error:', err.message);
    res.status(500).json({ success: false, error: err.message || 'Server error' });
  }
};

// @desc    Upload avatar image to Cloudinary and save URL to user profile
// @route   PUT /api/profile/avatar
// @access  Private (requires JWT)
export const uploadAvatar = async (req, res) => {
  console.log('--> PUT /api/profile/avatar called for user ID:', req.user.id);
  try {
    // req.file is set by multer after uploading to Cloudinary
    if (!req.file) {
      console.log('--> No file provided in request');
      return res.status(400).json({ success: false, error: 'Please upload an image file' });
    }

    // req.file.path contains the Cloudinary URL of the uploaded image
    const avatarUrl = req.file.path;
    console.log('--> Avatar uploaded to Cloudinary. URL:', avatarUrl);

    // Update the user\'s avatar field in MongoDB
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { avatar: avatarUrl },
      { new: true }
    ).select('-password');

    if (!user) {
      console.log('--> User not found for avatar update');
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    console.log('--> Avatar updated in MongoDB successfully for user:', user.email);
    // Send back the updated user
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    console.error('[profileController] uploadAvatar error:', err.message);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
