import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

router.get('/', (req, res) => {
  const isConnected = mongoose.connection.readyState === 1;
  return res.status(200).json({
    success: true,
    database: isConnected ? 'connected' : 'disconnected',
    dbName: mongoose.connection.name || 'unknown',
  });
});

export default router;
