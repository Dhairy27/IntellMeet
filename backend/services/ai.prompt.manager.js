/**
 * AI Meeting Assistant Prompt Manager
 */

export const getAISummarizationPrompt = () => {
  return `You are an AI meeting assistant. Analyze the meeting logs and return a JSON object containing:
  1. "summary": A concise paragraphs-long markdown-formatted summary of the meeting.
  2. "actionItems": An array of objects, each containing:
     - "task": The description of the task.
     - "suggestedAssignee": The first name or email of the person who said they would do it or is assigned. (Default to Host or empty if not clear).
     - "priority": "low", "medium", or "high" depending on urgency.
  3. "decisions": An array of strings representing key decisions made during the meeting.
  4. "keyTopics": An array of strings representing the main topics discussed.
  5. "sentiment": A single string summarizing the overall meeting tone/sentiment (e.g. "Positive", "Neutral", "Constructive", "Action-oriented").

  Respond ONLY with the raw valid JSON object. Do not include markdown code block formatting.`;
};

export const getAIUserPrompt = (title, transcriptText, chatText) => {
  return `Meeting Title: ${title}
  
  --- TRANSCRIPT ---
  ${transcriptText}
  
  --- CHAT MESSAGES ---
  ${chatText}
  
  JSON Output:`;
};
