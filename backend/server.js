import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';

// Import Database connection
import { connectDatabase } from './config/database.js';

// Import Routes
import authRoutes from './routes/auth.js';
import meetingRoutes from './routes/meetings.js';
import workspaceRoutes from './routes/workspaces.js';
import profileRoutes from './routes/profile.js';
import healthRoutes from './routes/health.js';
import noteRoutes from './routes/notes.js';
import tasksRoutes from './routes/tasks.js';
import aiRoutes from './routes/ai.js';
import dashboardRoutes from './routes/dashboard.js';

// Import Middleware
import { errorHandler } from './middleware/errorHandler.js';

// Import Socket handler
import { handleSocketConnections } from './services/socketService.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});
app.set('io', io);

// Security, Compression & Parsing Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Turn off CSP constraints in development to ease WebRTC integrations
}));
app.use(compression());
app.use(mongoSanitize());
app.use(xss());
app.use(cors({
  origin: true, // allows the origin in req.headers to align cookie credentials
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Debug logger
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.url}`);
  next();
});

// Rate Limiter for Authentication routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { success: false, error: 'Too many authentication attempts. Please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate Limiter for general API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // limit each IP to 500 requests per windowMs
  message: { success: false, error: 'Too many API requests. Please try again after 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Route Mountings
app.use(['/api/auth', '/auth'], authLimiter, authRoutes);
app.use(['/api/meetings', '/meetings'], apiLimiter, meetingRoutes);
app.use(['/api/workspaces', '/workspaces'], apiLimiter, workspaceRoutes);
app.use(['/api/profile', '/profile'], apiLimiter, profileRoutes);
app.use(['/api/health', '/health'], apiLimiter, healthRoutes);
app.use(['/api/notes', '/notes'], apiLimiter, noteRoutes);
app.use(['/api/tasks', '/tasks'], apiLimiter, tasksRoutes);
app.use(['/api/ai', '/ai'], apiLimiter, aiRoutes);
app.use(['/api/dashboard', '/dashboard'], apiLimiter, dashboardRoutes);

// Centralized Error Handling Middleware
app.use(errorHandler);

// Initialize Sockets
handleSocketConnections(io);

// Connect to database and boot server
const PORT = process.env.PORT || 5000;
console.log(`[Startup] MONGO_URI value: ${process.env.MONGO_URI || process.env.MONGODB_URI}`);
connectDatabase().then(() => {
  server.listen(PORT, () => {
    console.log(`[Server] IntellMeet backend listening on port ${PORT}`);
  });
}).catch((error) => {
  console.error(`[Server Critical] Server failed to start due to database connection failure: ${error.message}`);
  process.exit(1);
});

// Graceful Shutdown
process.on('SIGTERM', async () => {
  console.log('[Server] SIGTERM received. Shutting down gracefully...');
  const { disconnectDatabase } = await import('./config/database.js');
  await disconnectDatabase();
  server.close(() => {
    console.log('[Server] Server closed.');
    process.exit(0);
  });
});
