import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Workspace from '../models/Workspace.js';
import WorkspaceMember from '../models/WorkspaceMember.js';
import { OAuth2Client } from 'google-auth-library';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

// Helpers to generate JWT Tokens
const generateAccessToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'super_secret_intellmeet_token_key_2026_xyz', {
    expiresIn: '15m',
  });
};

const generateRefreshToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_REFRESH_SECRET || 'super_secret_intellmeet_refresh_key_2026_xyz', {
    expiresIn: '7d',
  });
};

const setRefreshTokenCookie = (res, token) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

// Helper to create a default workspace for a user
export const createDefaultWorkspaceForUser = async (user, firstNameReq) => {
  // Determine firstName
  let firstName = firstNameReq || user.firstName;
  if (!firstName && user.name) {
    firstName = user.name.trim().split(/\s+/)[0];
  }
  
  const workspaceName = firstName ? `${firstName}'s Workspace` : 'My Workspace';
  
  const defaultWorkspace = await Workspace.create({
    name: workspaceName,
    description: 'Your default collaborative workspace for meetings and tasks.',
    owner: user._id,
  });

  // Create default WorkspaceMember record
  await WorkspaceMember.create({
    workspaceId: defaultWorkspace._id,
    userId: user._id,
    role: 'OWNER',
  });

  // Link workspace to user
  if (!user.workspaces) {
    user.workspaces = [];
  }
  if (!user.workspaces.includes(defaultWorkspace._id)) {
    user.workspaces.push(defaultWorkspace._id);
  }
  user.defaultWorkspace = defaultWorkspace._id;
  
  if (firstName && !user.firstName) {
    user.firstName = firstName;
  }
  
  await user.save();
  return defaultWorkspace;
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
export const register = async (req, res, next) => {
  try {
    const { name, email, password, firstName } = req.body;

    // Check if user exists
    const userExists = await User.findOne({ email: String(email).toLowerCase() });
    if (userExists) {
      return errorResponse(res, 400, 'User already exists with this email', { email: ['Email already registered'] });
    }

    // Determine random/preset avatar colors
    const colors = ['#E11D48', '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#0891B2'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const avatar = randomColor;

    // Create user
    const user = await User.create({
      name,
      email: String(email).toLowerCase(),
      password,
      avatar,
      firstName: firstName || undefined,
    });

    // Create default workspace
    const defaultWorkspace = await createDefaultWorkspaceForUser(user, firstName);
    
    // Create access & refresh tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token in database
    user.refreshToken = refreshToken;
    await user.save();

    // Set refresh token in secure cookie
    setRefreshTokenCookie(res, refreshToken);

    return res.status(201).json({
      success: true,
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          role: user.role,
          workspaces: user.workspaces,
          defaultWorkspace: user.defaultWorkspace,
        },
        workspace: {
          _id: defaultWorkspace._id,
          name: defaultWorkspace.name,
          owner: defaultWorkspace.owner,
          createdAt: defaultWorkspace.createdAt,
        },
        accessToken,
        token: accessToken,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Retrieve user with password
    const user = await User.findOne({ email: String(email).toLowerCase() }).select('+password');
    if (!user) {
      return errorResponse(res, 401, 'Invalid email or password');
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return errorResponse(res, 401, 'Invalid email or password');
    }

    // Existing users: If user has no workspace: Create one automatically on next login.
    let userWorkspaces = await WorkspaceMember.find({ userId: user._id });
    if (userWorkspaces.length === 0) {
      await createDefaultWorkspaceForUser(user);
    }

    // Create access & refresh tokens
    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token in database
    user.refreshToken = refreshToken;
    await user.save();

    // Set refresh token in secure cookie
    setRefreshTokenCookie(res, refreshToken);

    return successResponse(res, 200, 'Login successful', {
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        workspaces: user.workspaces,
        defaultWorkspace: user.defaultWorkspace,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user & clear cookie
// @route   POST /api/auth/logout
// @access  Public (or Protected)
export const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;
    if (refreshToken) {
      // Find user and clear token in database
      const user = await User.findOne({ refreshToken });
      if (user) {
        user.refreshToken = undefined;
        await user.save();
      }
    }

    // Clear client cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
    });

    return successResponse(res, 200, 'Logout successful');
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh access token using HTTP-only refresh token cookie (Token Rotation)
// @route   POST /api/auth/refresh-token
// @access  Public
export const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken;
    
    if (!token) {
      return errorResponse(res, 401, 'Refresh token not found');
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET || 'super_secret_intellmeet_refresh_key_2026_xyz');
    } catch (err) {
      return errorResponse(res, 401, 'Invalid or expired refresh token');
    }

    // Check if user exists and token matches
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== token) {
      // Token reuse / hijack attempt detected: invalidate all sessions
      if (user) {
        user.refreshToken = undefined;
        await user.save();
      }
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
      });
      return errorResponse(res, 401, 'Unauthorized or session revoked (reuse detected)');
    }

    // Generate new Access and Refresh Tokens (Rotation)
    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    // Save rotated refresh token in database
    user.refreshToken = newRefreshToken;
    await user.save();

    // Set rotated refresh token in secure cookie
    setRefreshTokenCookie(res, newRefreshToken);

    return successResponse(res, 200, 'Token refreshed successfully', {
      accessToken: newAccessToken,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get current user profile
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('workspaces');
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    return successResponse(res, 200, 'Profile retrieved successfully', {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        bio: user.bio || '',
        phone: user.phone || '',
        role: user.role,
        workspaces: user.workspaces,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Authenticate/Register user via Google Sign-In
// @route   POST /api/auth/google
// @access  Public
export const googleLogin = async (req, res, next) => {
  try {
    const { email, name, avatar, googleId, credential } = req.body;

    let finalEmail = email;
    let finalName = name;
    let finalAvatar = avatar;
    let finalGoogleId = googleId;

    if (credential) {
      const clientId = process.env.GOOGLE_CLIENT_ID;
      if (!clientId) {
        return errorResponse(res, 400, 'Google Client ID is not configured on the server.');
      }

      const client = new OAuth2Client(clientId);
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      const payload = ticket.getPayload();
      
      if (!payload) {
        return errorResponse(res, 400, 'Invalid Google credential token');
      }

      finalEmail = payload.email;
      finalName = payload.name;
      finalAvatar = payload.picture;
      finalGoogleId = payload.sub;
    }

    if (!finalEmail || !finalName) {
      return errorResponse(res, 400, 'Please provide email and name');
    }

    let user = await User.findOne({ email: String(finalEmail).toLowerCase() });

    if (!user) {
      const colors = ['#E11D48', '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#0891B2'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const userAvatar = finalAvatar || randomColor;

      const randomPassword = jwt.sign({ googleId: finalGoogleId || finalEmail, email: finalEmail }, process.env.JWT_SECRET || 'super_secret_intellmeet_token_key_2026_xyz');

      user = await User.create({
        name: finalName,
        email: String(finalEmail).toLowerCase(),
        password: randomPassword,
        avatar: userAvatar,
      });

      await createDefaultWorkspaceForUser(user);
    } else {
      // Existing Google user. Check if they have no workspaces.
      let userWorkspaces = await WorkspaceMember.find({ userId: user._id });
      if (userWorkspaces.length === 0) {
        await createDefaultWorkspaceForUser(user);
      }
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    setRefreshTokenCookie(res, refreshToken);

    return successResponse(res, 200, 'Google login successful', {
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        workspaces: user.workspaces,
        defaultWorkspace: user.defaultWorkspace,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get Google OAuth Client ID settings
// @route   GET /api/auth/google/config
// @access  Public
export const getGoogleConfig = async (req, res, next) => {
  try {
    return successResponse(res, 200, 'Config retrieved successfully', {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Forgot password request - generate reset OTP
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return errorResponse(res, 400, 'Please provide an email address');
    }

    const user = await User.findOne({ email: String(email).toLowerCase() });

    if (!user) {
      return errorResponse(res, 404, 'There is no user with that email');
    }

    // Get 6-digit reset OTP
    const otp = user.getResetPasswordOTP();
    await user.save();

    // Log the reset OTP to console (Crucial: never return secret keys/OTPs in JSON payload)
    console.log(`\n========================================\n[SECURITY LOG] Generated Reset OTP for ${email}: ${otp}\n========================================\n`);

    // Set up email transporter
    const emailHost = process.env.EMAIL_HOST;
    const emailPort = process.env.EMAIL_PORT || 587;
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    const emailSubject = 'IntellMeet Password Reset OTP';
    const emailText = `Hello,\n\nYou requested a password reset on IntellMeet. Your 6-digit OTP code is:\n\n${otp}\n\nThis OTP is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.`;

    if (emailHost && emailUser && emailPass) {
      try {
        const transportConfig = emailHost.includes('gmail')
          ? {
              service: 'gmail',
              auth: {
                user: emailUser,
                pass: emailPass,
              },
            }
          : {
              host: emailHost,
              port: parseInt(emailPort),
              secure: parseInt(emailPort) === 465,
              auth: {
                user: emailUser,
                pass: emailPass,
              },
            };

        const transporter = nodemailer.createTransport(transportConfig);

        await transporter.sendMail({
          from: `"IntellMeet Security" <${emailUser}>`,
          to: email,
          subject: emailSubject,
          text: emailText,
        });

        console.log(`[Email] Password reset OTP sent to ${email} via SMTP.`);
        
        return successResponse(res, 200, 'Password reset OTP sent successfully to your email address.');
      } catch (mailErr) {
        console.error('[Email SMTP Error] Failed to send real email:', mailErr.message);
      }
    }

    // Fallback/Simulated delivery
    console.log(`\n========================================\n[SIMULATED EMAIL SENT]\nTo: ${email}\nSubject: ${emailSubject}\nBody:\n${emailText}\n========================================\n`);

    return successResponse(res, 200, 'Password reset OTP sent successfully (simulated delivery)');
  } catch (error) {
    next(error);
  }
};

// @desc    Reset password using OTP
// @route   PUT /api/auth/reset-password/:resetotp
// @access  Public
export const resetPassword = async (req, res, next) => {
  try {
    const resetPasswordOTP = crypto
      .createHash('sha256')
      .update(req.params.resetotp)
      .digest('hex');

    const user = await User.findOne({
      resetPasswordOTP,
      resetPasswordOTPExpire: { $gt: Date.now() },
    });

    if (!user) {
      return errorResponse(res, 400, 'Invalid or expired 6-digit OTP');
    }

    // Set new password
    user.password = req.body.password;
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpire = undefined;

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    setRefreshTokenCookie(res, refreshToken);

    return successResponse(res, 200, 'Password reset successfully', {
      accessToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
        workspaces: user.workspaces,
      },
    });
  } catch (error) {
    next(error);
  }
};
