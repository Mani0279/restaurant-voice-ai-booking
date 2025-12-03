/**
 * Speech Synthesis Utility
 * Handles Text-to-Speech using Web Speech API
 */

class SpeechSynthesisService {
  constructor() {
    this.synth = window.speechSynthesis;
    this.voice = null;
    this.rate = 1.0; // Speech rate (0.1 to 10)
    this.pitch = 1.0; // Speech pitch (0 to 2)
    this.volume = 1.0; // Volume (0 to 1)
    
    // Initialize voices
    this.initVoices();
  }

  /**
   * Initialize and load available voices
   */
  initVoices() {
    // Load voices
    const loadVoices = () => {
      const voices = this.synth.getVoices();
      
      // Prefer English voices
      this.voice = voices.find(voice => 
        voice.lang.startsWith('en') && voice.name.includes('Female')
      ) || voices.find(voice => 
        voice.lang.startsWith('en')
      ) || voices[0];

      console.log('🔊 Speech Synthesis initialized');
      console.log('Selected voice:', this.voice?.name);
    };

    // Voices might load asynchronously
    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  /**
   * Speak text using Text-to-Speech
   * @param {string} text - Text to speak
   * @param {Function} onEnd - Callback when speech ends
   * @param {Function} onError - Callback on error
   */
  speak(text, onEnd = null, onError = null) {
    // Cancel any ongoing speech
    this.cancel();

    if (!text || text.trim() === '') {
      console.warn('No text to speak');
      return;
    }

    // Create utterance
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Set voice properties
    utterance.voice = this.voice;
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    utterance.volume = this.volume;

    // Event handlers
    utterance.onend = () => {
      console.log('✅ Speech ended');
      if (onEnd) onEnd();
    };

    utterance.onerror = (event) => {
      console.error('❌ Speech error:', event.error);
      if (onError) onError(event.error);
    };

    utterance.onstart = () => {
      console.log('🔊 Started speaking:', text.substring(0, 50) + '...');
    };

    // Speak!
    this.synth.speak(utterance);
  }

  /**
   * Stop current speech
   */
  cancel() {
    if (this.synth.speaking) {
      this.synth.cancel();
    }
  }

  /**
   * Pause current speech
   */
  pause() {
    if (this.synth.speaking) {
      this.synth.pause();
    }
  }

  /**
   * Resume paused speech
   */
  resume() {
    if (this.synth.paused) {
      this.synth.resume();
    }
  }

  /**
   * Check if currently speaking
   */
  isSpeaking() {
    return this.synth.speaking;
  }

  /**
   * Get available voices
   */
  getVoices() {
    return this.synth.getVoices();
  }

  /**
   * Set voice by name
   */
  setVoice(voiceName) {
    const voices = this.getVoices();
    const selectedVoice = voices.find(v => v.name === voiceName);
    if (selectedVoice) {
      this.voice = selectedVoice;
      console.log('Voice changed to:', voiceName);
    }
  }

  /**
   * Set speech rate (0.1 to 10)
   */
  setRate(rate) {
    this.rate = Math.max(0.1, Math.min(10, rate));
  }

  /**
   * Set speech pitch (0 to 2)
   */
  setPitch(pitch) {
    this.pitch = Math.max(0, Math.min(2, pitch));
  }

  /**
   * Set volume (0 to 1)
   */
  setVolume(volume) {
    this.volume = Math.max(0, Math.min(1, volume));
  }
}

// Export singleton instance
const speechService = new SpeechSynthesisService();
export default speechService;