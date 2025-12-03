const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Gemini AI Service for Restaurant Booking Conversations
 * Handles natural language understanding and response generation
 */
class GeminiService {
  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    // System prompt that defines the AI agent's personality and behavior
    this.systemPrompt = `You are a friendly and professional restaurant booking assistant named "RestauBot". 

Your role is to help customers book tables at our restaurant through natural voice conversation.

CONVERSATION FLOW:
1. Greet the customer warmly
2. Collect booking information in this order:
   - Customer name
   - Number of guests
   - Preferred date (format: YYYY-MM-DD or natural like "tomorrow", "next Friday")
   - Preferred time (format: HH:MM in 24-hour or natural like "7 PM", "evening")
   - Cuisine preference (Italian, Chinese, Indian, Mexican, Japanese, Continental, or Any)
   - Any special requests (birthday, anniversary, dietary restrictions)
3. When you have the date, I will provide you with weather information
4. Suggest seating (indoor/outdoor) based on the weather I provide
5. Confirm all details with the customer
6. Finalize the booking

IMPORTANT RULES:
- Be conversational and natural, not robotic
- Ask ONE question at a time, don't overwhelm the customer
- If customer provides multiple pieces of information at once, acknowledge all of them
- Be patient if customer is unsure or changes their mind
- Handle casual language and variations (e.g., "table for 2" = 2 guests)
- If customer says something unclear, politely ask for clarification
- Always be positive and helpful
- Keep responses concise (2-3 sentences max per response)

CURRENT STATUS: {status}
COLLECTED INFO: {collectedInfo}
WEATHER INFO: {weatherInfo}

Respond naturally based on the conversation context.`;
  }

  /**
   * Generate AI response based on conversation context
   * @param {String} userMessage - What the user just said
   * @param {Object} conversationState - Current state of booking
   * @returns {String} AI agent's response
   */
  async generateResponse(userMessage, conversationState = {}) {
    try {
      // Build context-aware prompt
      const contextPrompt = this.buildContextPrompt(conversationState);
      const fullPrompt = `${contextPrompt}

User just said: "${userMessage}"

Generate a natural, friendly response that moves the conversation forward. Response:`;

      // Generate response from Gemini
      const result = await this.model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      return text.trim();

    } catch (error) {
      console.error('Gemini AI Error:', error.message);
      
      // Fallback response if AI fails
      return "I apologize, I'm having trouble processing that. Could you please repeat?";
    }
  }

  /**
   * Build context-aware prompt based on conversation state
   */
  buildContextPrompt(state) {
    const {
      status = 'greeting',
      customerName = null,
      numberOfGuests = null,
      bookingDate = null,
      bookingTime = null,
      cuisinePreference = null,
      specialRequests = null,
      weatherInfo = null,
      seatingPreference = null
    } = state;

    // Collect what we know so far
    const collectedInfo = [];
    if (customerName) collectedInfo.push(`Name: ${customerName}`);
    if (numberOfGuests) collectedInfo.push(`Guests: ${numberOfGuests}`);
    if (bookingDate) collectedInfo.push(`Date: ${bookingDate}`);
    if (bookingTime) collectedInfo.push(`Time: ${bookingTime}`);
    if (cuisinePreference) collectedInfo.push(`Cuisine: ${cuisinePreference}`);
    if (specialRequests) collectedInfo.push(`Special: ${specialRequests}`);
    if (seatingPreference) collectedInfo.push(`Seating: ${seatingPreference}`);

    // Build weather context if available
    let weatherContext = 'Not yet fetched';
    if (weatherInfo) {
      weatherContext = `${weatherInfo.description}, ${weatherInfo.temperature}°C. 
Recommendation: ${weatherInfo.recommendation.message}`;
    }

    // Replace placeholders in system prompt
    let prompt = this.systemPrompt
      .replace('{status}', status)
      .replace('{collectedInfo}', collectedInfo.length > 0 ? collectedInfo.join(', ') : 'None yet')
      .replace('{weatherInfo}', weatherContext);

    return prompt;
  }

  /**
   * Extract booking information from user's natural language input
   * This helps parse things like "table for 2 tomorrow at 7pm"
   */
  async extractBookingInfo(userMessage) {
    try {
      const extractionPrompt = `Extract booking information from this message: "${userMessage}"

Return ONLY a JSON object (no markdown, no extra text) with these fields:
{
  "numberOfGuests": number or null,
  "date": "YYYY-MM-DD" or null,
  "time": "HH:MM" (24-hour) or null,
  "cuisine": "Italian/Chinese/Indian/Mexican/Japanese/Continental" or null,
  "specialRequest": string or null,
  "customerName": string or null
}

Examples:
"table for 2 tomorrow at 7pm" -> {"numberOfGuests": 2, "date": "tomorrow", "time": "19:00"}
"booking for John, 4 people" -> {"customerName": "John", "numberOfGuests": 4}
"Indian food please" -> {"cuisine": "Indian"}

Extract:`;

      const result = await this.model.generateContent(extractionPrompt);
      const responseText = result.response.text().trim();
      
      // Try to parse JSON from response
      // Remove markdown code blocks if present
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const extracted = JSON.parse(jsonMatch[0]);
        return extracted;
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

    if (!customerName) return 'ask_name';
    if (!numberOfGuests) return 'ask_guests';
    if (!bookingDate) return 'ask_date';
    if (!bookingTime) return 'ask_time';
    if (!cuisinePreference) return 'ask_cuisine';
    if (!seatingPreference) return 'ask_seating';
    
    return 'confirm';
  }
}

module.exports = new GeminiService();