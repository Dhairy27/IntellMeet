import AIResult from '../models/AIResult.js';
import Meeting from '../models/Meeting.js';
import { generateMeetingIntelligence } from '../services/ai.service.js';
import { successResponse, errorResponse } from '../utils/apiResponse.js';

/**
 * Get AI Analysis result for a meeting
 * @route GET /api/meetings/:meetingId/ai-result
 */
export const getAIResult = async (req, res, next) => {
  try {
    const { meetingId } = req.params;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return errorResponse(res, 404, 'Meeting not found');
    }

    // Retrieve the AI result
    const aiResult = await AIResult.findOne({ meetingId });
    if (!aiResult) {
      return errorResponse(res, 404, 'AI results not generated or not found for this meeting');
    }

    return successResponse(res, 200, 'AI intelligence result retrieved successfully', aiResult);
  } catch (error) {
    next(error);
  }
};

/**
 * Manually trigger/re-run AI analysis pipeline for a meeting
 * @route POST /api/meetings/:meetingId/ai-analyze
 */
export const reAnalyzeMeeting = async (req, res, next) => {
  try {
    const { meetingId } = req.params;

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return errorResponse(res, 404, 'Meeting not found');
    }

    console.log(`[AI Controller] Manually triggering analysis for meeting: ${meeting.title}`);
    const aiResults = await generateMeetingIntelligence(meeting);

    // Sync back to meeting document for backward compatibility
    meeting.aiSummary = aiResults.summary;
    meeting.aiActionItems = aiResults.actionItems;
    await meeting.save();

    const savedResult = await AIResult.findOne({ meetingId });

    return successResponse(res, 200, 'Meeting intelligence analyzed and updated successfully', savedResult);
  } catch (error) {
    next(error);
  }
};

/**
 * Analyze meeting with ID passed in req.body
 * @route POST /api/ai/analyze
 */
export const analyzeMeetingFromBody = async (req, res, next) => {
  try {
    const { meetingId } = req.body;
    if (!meetingId) {
      return errorResponse(res, 400, 'Please provide meetingId in request body');
    }

    const meeting = await Meeting.findById(meetingId);
    if (!meeting) {
      return errorResponse(res, 404, 'Meeting not found');
    }

    console.log(`[AI Controller] Triggering analysis from body for meeting ID: ${meetingId}`);
    const aiResults = await generateMeetingIntelligence(meeting);

    // Sync back to meeting document for backward compatibility
    meeting.aiSummary = aiResults.summary;
    meeting.aiActionItems = aiResults.actionItems;
    await meeting.save();

    const savedResult = await AIResult.findOne({ meetingId });

    return successResponse(res, 200, 'Meeting intelligence analyzed successfully', savedResult);
  } catch (error) {
    next(error);
  }
};

/**
 * Test OpenAI API key connection end-to-end
 * @route GET /api/ai/test
 */
export const testOpenAIConnection = async (req, res, next) => {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return res.status(400).json({
        success: false,
        status: 'Missing API key',
        message: 'No OPENAI_API_KEY found in environmental variables.'
      });
    }

    console.log(`[AI Test] Testing OpenAI key prefix: ${apiKey.substring(0, 12)}...`);

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: 'Ping' }],
        max_tokens: 5
      })
    });

    const responseBody = await response.text();
    let json = null;
    try {
      json = JSON.parse(responseBody);
    } catch (e) {
      // Not JSON
    }

    if (response.status === 200 && json) {
      return res.status(200).json({
        success: true,
        status: 'Active and verified',
        message: 'OpenAI API connection verified successfully.',
        data: json
      });
    }

    // Handle error codes
    let statusText = 'Model errors / Connection issues';
    if (response.status === 401) {
      statusText = 'Invalid API key';
    } else if (response.status === 429) {
      statusText = 'Billing issues / Rate limit issues';
    }

    return res.status(response.status).json({
      success: false,
      status: statusText,
      statusCode: response.status,
      message: json?.error?.message || response.statusText || 'Unknown connection error.',
      error: json?.error || responseBody
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      status: 'Connection failure',
      message: error.message
    });
  }
};
