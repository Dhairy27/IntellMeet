import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name'],
    trim: true,
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please add a valid email',
    ],
    lowercase: true,
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false,
  },
  avatar: {
    type: String,
    required: [true, 'Please add an avatar'],
    default: '',
  },
  bio: {
    type: String,
    default: '',
    maxlength: [300, 'Bio cannot be more than 300 characters'],
  },
  phone: {
    type: String,
    default: '',
  },
  role: {
    type: String,
    enum: ['user', 'admin', 'Member', 'member'],
    default: 'user',
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
  refreshToken: {
    type: String,
  },
  workspaces: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
  }],
  defaultWorkspace: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Workspace',
  },
  firstName: {
    type: String,
    trim: true,
  },
  resetPasswordOTP: String,
  resetPasswordOTPExpire: Date,
}, {
  timestamps: true,
});

// Encrypt password using bcrypt
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Generate and hash 6-digit OTP
UserSchema.methods.getResetPasswordOTP = function () {
  // Generate a 6-digit random number
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Hash OTP and set to resetPasswordOTP field
  this.resetPasswordOTP = crypto
    .createHash('sha256')
    .update(otp)
    .digest('hex');

  // Set expire (10 minutes)
  this.resetPasswordOTPExpire = Date.now() + 10 * 60 * 1000;

  return otp;
};

const User = mongoose.model('User', UserSchema);
export default User;
