const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Gemini AI Service for Restaurant Booking Conversations
 * Handles natural language understanding and response generation
 */
class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
    
    // Conversation history per client (store in memory)
    this.conversations = new Map();
  }

  /**
   * Initialize conversation for a new client
   */
  initConversation(clientId) {
    this.conversations.set(clientId, {
      history: [],
      state: {}
    });
  }

  /**
   * Get conversation for a client
   */
  getConversation(clientId) {
    if (!this.conversations.has(clientId)) {
      this.initConversation(clientId);
    }
    return this.conversations.get(clientId);
  }

  /**
   * Add message to conversation history
   */
  addToHistory(clientId, role, message) {
    const conversation = this.getConversation(clientId);
    conversation.history.push({ role, message, timestamp: new Date() });
    
    // Keep only last 20 messages to avoid token limits
    if (conversation.history.length > 20) {
      conversation.history = conversation.history.slice(-20);
    }
  }

  /**
   * Generate AI response based on conversation context
   * @param {String} clientId - Unique client identifier
   * @param {String} userMessage - What the user just said
   * @param {Object} conversationState - Current state of booking
   * @returns {String} AI agent's response
   */
  async generateResponse(clientId, userMessage, conversationState = {}) {
    try {
      // Add user message to history
      this.addToHistory(clientId, 'user', userMessage);

      // Build context-aware prompt with history
      const systemPrompt = this.buildSystemPrompt(conversationState);
      const conversationHistory = this.buildConversationHistory(clientId);
      
      const fullPrompt = `${systemPrompt}

${conversationHistory}

User: "${userMessage}"

CRITICAL RULES:
- Look at COLLECTED INFO above - NEVER ask for information that's already there
- If customerName exists, DO NOT ask for name again
- If numberOfGuests exists, DO NOT ask for guests again  
- If bookingDate exists, DO NOT ask for date again
- If bookingTime exists, DO NOT ask for time again
- Move to the NEXT missing piece of information
- Be brief (1-2 sentences max)

RestauBot:`;

      // Generate response from Gemini
      const result = await this.model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text().trim();

      // Add bot response to history
      this.addToHistory(clientId, 'assistant', text);

      return text;

    } catch (error) {
      console.error('Gemini AI Error:', error.message);
      return "I apologize, I'm having trouble processing that. Could you please repeat?";
    }
  }

  /**
   * Build system prompt with current state
   */
  buildSystemPrompt(state) {
    const {
      customerName = null,
      numberOfGuests = null,
      bookingDate = null,
      bookingTime = null,
      cuisinePreference = null,
      specialRequests = null,
      weatherInfo = null,
      seatingPreference = null
    } = state;

    // What we've collected so far
    const collected = [];
    if (customerName) collected.push(`✓ Name: ${customerName}`);
    if (numberOfGuests) collected.push(`✓ Guests: ${numberOfGuests}`);
    if (bookingDate) collected.push(`✓ Date: ${bookingDate}`);
    if (bookingTime) collected.push(`✓ Time: ${bookingTime}`);
    if (cuisinePreference) collected.push(`✓ Cuisine: ${cuisinePreference}`);
    if (specialRequests) collected.push(`✓ Special: ${specialRequests}`);
    if (seatingPreference) collected.push(`✓ Seating: ${seatingPreference}`);

    // What's still missing
    const missing = [];
    if (!customerName) missing.push('Name');
    if (!numberOfGuests) missing.push('Number of guests');
    if (!bookingDate) missing.push('Date');
    if (!bookingTime) missing.push('Time');
    if (!cuisinePreference) missing.push('Cuisine preference');
    if (!seatingPreference) missing.push('Seating preference (indoor/outdoor)');

    // Weather context
    let weatherContext = '';
    if (weatherInfo) {
      weatherContext = `\nWEATHER INFO: ${weatherInfo.description}, ${weatherInfo.temperature}°C
SEATING RECOMMENDATION: ${weatherInfo.recommendation.message}`;
    }

    return `You are RestauBot, a friendly restaurant booking assistant.

BOOKING INFORMATION COLLECTED SO FAR:
${collected.length > 0 ? collected.join('\n') : 'Nothing collected yet'}

STILL NEED TO ASK FOR:
${missing.length > 0 ? missing.join(', ') : 'All information collected! Ready to confirm.'}
${weatherContext}

YOUR TASK:
1. If ALL information is collected, summarize the booking and ask for confirmation
2. If information is MISSING, ask for the NEXT missing item in order: Name → Guests → Date → Time → Cuisine → Seating
3. NEVER ask for information that's already collected (marked with ✓ above)
4. Keep responses SHORT and natural (1-2 sentences)
5. If user provides multiple pieces of info at once, acknowledge all and move to next missing item

CONVERSATION HISTORY:`;
  }

  /**
   * Build conversation history for context
   */
  buildConversationHistory(clientId) {
    const conversation = this.getConversation(clientId);
    
    if (conversation.history.length === 0) {
      return '(This is the start of the conversation)';
    }

    // Get last 10 messages for context
    const recentHistory = conversation.history.slice(-10);
    
    return recentHistory
      .map(msg => `${msg.role === 'user' ? 'User' : 'RestauBot'}: ${msg.message}`)
      .join('\n');
  }

  /**
   * Extract booking information from user's natural language input
   * ONLY extracts NEW information, doesn't overwrite existing data
   */
  async extractBookingInfo(userMessage, existingState = {}) {
    try {
      const extractionPrompt = `Extract ONLY NEW booking information from this message: "${userMessage}"

EXISTING INFORMATION (do NOT extract these again):
${JSON.stringify(existingState, null, 2)}

Extract ONLY information that is NOT already in the existing data above.

Return ONLY a JSON object (no markdown, no extra text) with these fields (use null if not mentioned):
{
  "customerName": string or null,
  "numberOfGuests": number or null,
  "bookingDate": "YYYY-MM-DD" or natural date like "tomorrow", "December 5th" or null,
  "bookingTime": "HH:MM" (24-hour format) or natural time like "8 PM", "evening" or null,
  "cuisinePreference": "Italian/Chinese/Indian/Mexican/Japanese/Continental/Any" or null,
  "specialRequests": string or null,
  "seatingPreference": "indoor/outdoor" or null
}

Examples:
User: "My name is John"
Existing: {}
Extract: {"customerName": "John"}

User: "My name is John"  
Existing: {"customerName": "Sarah"}
Extract: {} (name already exists, don't change it)

User: "Table for 4 people"
Existing: {"customerName": "John"}
Extract: {"numberOfGuests": 4}

User: "December 5th at 8 PM"
Existing: {"customerName": "John", "numberOfGuests": 4}
Extract: {"bookingDate": "2024-12-05", "bookingTime": "20:00"}

User: "I prefer outdoor seating"
Extract: {"seatingPreference": "outdoor"}

NOW EXTRACT FROM: "${userMessage}"
`;

      const result = await this.model.generateContent(extractionPrompt);
      const responseText = result.response.text().trim();
      
      // Parse JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        
        // Filter out null values and only return NEW information
        const newInfo = {};
        for (const [key, value] of Object.entries(extracted)) {
          // Only add if value exists AND field is not already filled in existingState
          if (value !== null && value !== undefined && !existingState[key]) {
            newInfo[key] = value;
          }
        }
        
        console.log('🔍 Extracted NEW info:', newInfo);
        return newInfo;
      }

      return {};

    } catch (error) {
      console.error('Extraction Error:', error.message);
      return {};
    }
  }

  /**
   * Determine the next step in the conversation
   */
  determineNextStep(state) {
    const {
      customerName,
      numberOfGuests,
      bookingDate,
      bookingTime,
      cuisinePreference,
      seatingPreference
    } = state;

    // Return the first missing piece of information
    if (!customerName) return 'ask_name';
    if (!numberOfGuests) return 'ask_guests';
    if (!bookingDate) return 'ask_date';
    if (!bookingTime) return 'ask_time';
    if (!cuisinePreference) return 'ask_cuisine';
    if (!seatingPreference) return 'ask_seating';
    
    // Everything collected
    return 'confirm';
  }

  /**
   * Check if booking is complete
   */
  isBookingComplete(state) {
    return !!(
      state.customerName &&
      state.numberOfGuests &&
      state.bookingDate &&
      state.bookingTime &&
      state.seatingPreference
    );
  }

  /**
   * Clear conversation history for a client
   */
  clearConversation(clientId) {
    this.conversations.delete(clientId);
  }
}

module.exports = new GeminiService();