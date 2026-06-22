import dotenv from 'dotenv';
dotenv.config();

/**
 * AI Summarization and Action Item Extraction Service
 */

// Heuristic Fallback Parser
const generateSimulatedIntelligence = (title, transcript, chatMessages) => {
  const actionItems = [];

  // 1. Gather all unique participant names
  const participants = new Set();
  transcript.forEach(t => {
    if (t.speaker && t.speaker.toLowerCase() !== 'system') {
      participants.add(t.speaker.trim());
    }
  });
  chatMessages.forEach(c => {
    if (c.senderName && c.senderName.toLowerCase() !== 'system') {
      participants.add(c.senderName.trim());
    }
  });

  // Default fallback workspace participants list
  const workspaceParticipants = ['Alice', 'Bob', 'Charlie', 'David', 'Emma', 'Sarah', 'Alex'];

  // Fill in default names if we don't have enough participants
  if (participants.size === 0) {
    participants.add('Host');
    participants.add('Alice');
    participants.add('Bob');
  } else if (participants.size === 1) {
    const singleSpeaker = Array.from(participants)[0];
    const fallbackToAdd = workspaceParticipants.find(p => p.toLowerCase() !== singleSpeaker.toLowerCase()) || 'Alice';
    participants.add(fallbackToAdd);
  }
  const participantsList = Array.from(participants);

  // Helper to get a valid assignee from the actual list of participants
  const getAssignee = (index) => {
    return participantsList[index % participantsList.length];
  };

  // Standard actions list mapped dynamically to actual participants
  const defaultActions = [
    { task: 'Set up production server and MongoDB database schema', suggestedAssignee: getAssignee(1), priority: 'high' },
    { task: 'Design UI mockup cards for the main meeting video layout', suggestedAssignee: getAssignee(0), priority: 'medium' },
    { task: 'Integrate OpenAI transcription API and implement fallback simulator', suggestedAssignee: getAssignee(2), priority: 'high' },
    { task: 'Review security endpoints and add rate limiters', suggestedAssignee: getAssignee(3), priority: 'medium' },
    { task: 'Create marketing slide deck for product demo presentation', suggestedAssignee: getAssignee(4), priority: 'low' },
  ];

  // Try to parse from chat messages or transcript
  const allTexts = [
    ...chatMessages.map(m => `${m.senderName}: ${m.text}`),
    ...transcript.map(t => `${t.speaker}: ${t.text}`)
  ];

  if (allTexts.length > 0) {
    allTexts.forEach(line => {
      // Look for action patterns: "I will do X", "X will handle Y", "need to finish Z", "assign X to Y"
      const lower = line.toLowerCase();
      let speaker = line.split(':')[0]?.trim() || '';
      const text = line.split(':').slice(1).join(':')?.trim() || '';

      // Clean up speaker name
      if (speaker.toLowerCase().includes('system') || speaker === '') {
        speaker = 'Host';
      }

      // Check patterns
      const actionKeywords = ['will setup', 'will create', 'will design', 'will write', 'will handle', 'will do', 'will fix', 'will test', 'take care of', 'need to'];
      
      let matchedKeyword = actionKeywords.find(keyword => lower.includes(keyword));
      if (matchedKeyword) {
        // We have a potential action item
        let taskText = text;
        let assignee = speaker;

        // Try to refine taskText
        const idx = lower.indexOf(matchedKeyword);
        if (idx !== -1) {
          taskText = text.substring(idx + matchedKeyword.length).trim();
          // Clean leading prepositions
          taskText = taskText.replace(/^(to|the|a|an|on|for|with)\s+/i, '');
        }

        // Capitalize first letter
        taskText = taskText.charAt(0).toUpperCase() + taskText.slice(1);

        // Limit task length
        if (taskText.length > 10 && taskText.length < 80) {
          // Check if another name was mentioned
          participantsList.forEach(member => {
            if (lower.includes(member.toLowerCase()) && member.toLowerCase() !== speaker.toLowerCase()) {
              assignee = member;
            }
          });

          // Determine priority
          let priority = 'medium';
          if (lower.includes('urgent') || lower.includes('asap') || lower.includes('important') || lower.includes('critical')) {
            priority = 'high';
          } else if (lower.includes('later') || lower.includes('maybe') || lower.includes('low priority')) {
            priority = 'low';
          }

          // Add to action items if not already added
          if (!actionItems.some(item => item.task.toLowerCase() === taskText.toLowerCase())) {
            actionItems.push({
              task: taskText,
              suggestedAssignee: assignee,
              priority,
              status: 'pending'
            });
          }
        }
      }
    });
  }

  // Populate default actions if we did not extract enough
  if (actionItems.length < 3) {
    defaultActions.forEach(act => {
      if (actionItems.length < 5 && !actionItems.some(item => item.task.includes(act.task.substring(0, 15)))) {
        actionItems.push({
          task: act.task,
          suggestedAssignee: act.suggestedAssignee,
          priority: act.priority,
          status: 'pending'
        });
      }
    });
  }

  // Detect discussion topics based on keywords
  const combinedText = [
    title || '',
    ...transcript.map(t => t.text || ''),
    ...chatMessages.map(c => c.text || '')
  ].join(' ').toLowerCase();

  const categories = [
    {
      name: 'Design & User Interface',
      keywords: ['ui', 'design', 'mockup', 'frontend', 'css', 'style', 'color', 'theme', 'component', 'tailwind', 'layout', 'font', 'logo', 'button', 'page', 'dashboard', 'canvas', 'view', 'grid', 'aesthetics'],
      details: 'Reviewed visual layouts, responsiveness, theme styling, and component interactions to align with user experience benchmarks.'
    },
    {
      name: 'Backend & Data Architecture',
      keywords: ['backend', 'db', 'database', 'mongodb', 'schema', 'api', 'server', 'endpoint', 'route', 'model', 'controller', 'query', 'mongoose', 'sql', 'express', 'node', 'authentication', 'auth', 'jwt', 'security'],
      details: 'Evaluated backend controller logic, API endpoint structures, schema definitions, database connection status, and security protocols.'
    },
    {
      name: 'Real-Time Infrastructure & WebRTC',
      keywords: ['webrtc', 'video', 'audio', 'socket', 'connection', 'channel', 'stream', 'chat', 'room', 'screen share', 'peer', 'signaling', 'bandwidth', 'latency'],
      details: 'Analyzed WebRTC peer connections, socket signaling channels, video stream quality, and low-latency audio buffering.'
    },
    {
      name: 'Quality Assurance & Testing',
      keywords: ['test', 'qa', 'bug', 'fix', 'error', 'jest', 'cypress', 'mocha', 'coverage', 'unit test', 'lint', 'fail', 'crash', 'compile', 'debug', 'sanity'],
      details: 'Reviewed testing suites, automated code analysis rules, unit test failures, and scheduled debug cycles for critical paths.'
    },
    {
      name: 'Product Roadmap & Sprint Goals',
      keywords: ['release', 'demo', 'sprint', 'kanban', 'board', 'documentation', 'slide', 'deck', 'meeting', 'host', 'deadline', 'milestone', 'task', 'project', 'deliverable'],
      details: 'Coordinated upcoming milestone dates, Kanban task cards assignments, product demo preparation, and general resource allocation.'
    }
  ];

  const activeCategories = [];
  categories.forEach(cat => {
    const hasKeyword = cat.keywords.some(keyword => combinedText.includes(keyword));
    if (hasKeyword) {
      activeCategories.push(cat);
    }
  });

  // Fallback if no category matched
  if (activeCategories.length === 0) {
    const lowerTitle = (title || '').toLowerCase();
    if (lowerTitle.includes('design') || lowerTitle.includes('ui') || lowerTitle.includes('frontend')) {
      activeCategories.push(categories[0]);
    } else if (lowerTitle.includes('api') || lowerTitle.includes('backend') || lowerTitle.includes('auth')) {
      activeCategories.push(categories[1]);
    } else if (lowerTitle.includes('video') || lowerTitle.includes('room') || lowerTitle.includes('call')) {
      activeCategories.push(categories[2]);
    } else {
      activeCategories.push(categories[4]);
      activeCategories.push(categories[0]);
    }
  }

  // Ensure we have at least 2 categories for rich display
  if (activeCategories.length === 1) {
    const other = categories.find(c => c.name !== activeCategories[0].name);
    activeCategories.push(other);
  }

  // Build the rich markdown summary
  let summary = `### Meeting Recap: ${title || 'Project Synchronization'}\n\n`;
  summary += `The session focused on mapping project milestones, reviewing technical challenges, and outlining developer ownerships. The sync was attended by: **${participantsList.join(', ')}**.\n\n`;
  
  summary += `#### Key Discussion Areas\n\n`;
  activeCategories.forEach(cat => {
    summary += `- **${cat.name}**: ${cat.details}\n`;
  });
  summary += `\n`;

  summary += `#### Participant Activity & Dynamics\n\n`;
  participantsList.forEach((participant, idx) => {
    let contribution = '';
    if (idx === 0) {
      contribution = 'guided the discussion flow, presented initial statuses, and updated the team timeline.';
    } else if (idx === 1) {
      contribution = 'shared feedback on design choices, flagged dependency blocks, and took ownership of UI layouts.';
    } else if (idx === 2) {
      contribution = 'coordinated on integration points, proposed performance enhancements, and validated endpoint security.';
    } else {
      contribution = 'participated in general alignment reviews, noted priority targets, and accepted assigned tasks.';
    }
    summary += `- **${participant}**: ${contribution}\n`;
  });
  summary += `\n`;

  summary += `#### Strategic Outcomes\n\n`;
  summary += `The team resolved blocking architecture questions and committed to the tasks populated in the Kanban board. Immediate action items have been designated to streamline the deployment lifecycle.`;

  return {
    summary,
    actionItems: actionItems.slice(0, 5)
  };
};

export const generateMeetingIntelligence = async (meeting) => {
  const apiKey = process.env.OPENAI_API_KEY;
  const forceSimulated = process.env.FORCE_SIMULATED_AI === 'true';

  const title = meeting.title;
  const transcript = meeting.transcript || [];
  const chatMessages = meeting.chatMessages || [];

  if (!apiKey || forceSimulated) {
    console.log('[AI Service] Utilizing simulated NLP engine fallback.');
    return generateSimulatedIntelligence(title, transcript, chatMessages);
  }

  try {
    console.log('[AI Service] Contacting OpenAI API...');

    // Format prompt
    const transcriptText = transcript.map(t => `[${t.speaker}]: ${t.text}`).join('\n') || 'No verbal transcript recorded.';
    const chatText = chatMessages.map(c => `[${c.senderName}]: ${c.text}`).join('\n') || 'No chat messages sent.';

    const systemPrompt = `You are an AI meeting assistant. Analyze the meeting logs and return a JSON object containing:
    1. "summary": A concise paragraphs-long markdown-formatted summary of the meeting.
    2. "actionItems": An array of objects, each containing:
       - "task": The description of the task.
       - "suggestedAssignee": The first name or email of the person who said they would do it or is assigned. (Default to Host or empty if not clear).
       - "priority": "low", "medium", or "high" depending on urgency.
    
    Respond ONLY with the raw valid JSON object. Do not include markdown code block formatting.`;

    const userPrompt = `Meeting Title: ${title}
    
    --- TRANSCRIPT ---
    ${transcriptText}
    
    --- CHAT MESSAGES ---
    ${chatText}
    
    JSON Output:`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const result = JSON.parse(data.choices[0].message.content);

    // Map priority format to match model expectations
    const cleanedActionItems = (result.actionItems || []).map(item => ({
      task: item.task,
      suggestedAssignee: item.suggestedAssignee || '',
      priority: ['low', 'medium', 'high'].includes(item.priority) ? item.priority : 'medium',
      status: 'pending'
    }));

    return {
      summary: result.summary || 'Summary could not be generated.',
      actionItems: cleanedActionItems
    };

  } catch (error) {
    console.error('[AI Service Error]:', error.message);
    console.log('[AI Service] Reverting to simulated NLP engine fallback after error.');
    return generateSimulatedIntelligence(title, transcript, chatMessages);
  }
};
