/**
 * Aura Chatbot - Application Engine
 * Responsive rule-based pattern matching and UI interactions.
 */
// State Management
const state = {
  userMessageCount: 0,
  botMessageCount: 1, // Started with 1 greeting message
  successfulMatches: 1,
  sessionStartTime: Date.now(),
  activeRiddle: null, // Tracks if user is currently solving a riddle
  activeRiddleIndex: -1
};
// Developer Joke List
const JOKES = [
  "Why do programmers wear glasses? Because they can't C#! 👓",
  "How many programmers does it take to change a light bulb? None, that's a hardware problem! 💡",
  "There are 10 types of people in the world: those who understand binary, and those who don't! 🔢",
  "Why did the programmer quit his job? Because he didn't get arrays (a raise)! 💸",
  "What is a programmer's favorite hangout place? The Foo Bar! 🍻",
  "A SQL query walks into a bar, walks up to two tables and asks, 'Can I join you?' 📊",
  "Why did the database administrator leave his wife? She had one-to-many relationships! 💔",
  "Why do bugs love computers? Because of the screens! 🦟"
];
// Interactive Riddle List
const RIDDLES = [
  {
    question: "I speak without a mouth and hear without ears. I have no body, but I come alive with wind. What am I?",
    answers: ["echo", "an echo"],
    hint: "Think about sound reflections."
  },
  {
    question: "What has keys but can't open locks, and has space but no room to enter?",
    answers: ["keyboard", "computer keyboard", "a keyboard"],
    hint: "You are likely typing on one right now!"
  },
  {
    question: "The more of them you take, the more you leave behind. What are they?",
    answers: ["footsteps", "footstep", "steps", "footprints"],
    hint: "You make them while walking."
  },
  {
    question: "What is full of holes but still holds water?",
    answers: ["sponge", "a sponge"],
    hint: "Usually found in kitchen sinks or bathrooms."
  },
  {
    question: "I am light as a feather, yet the strongest person cannot hold me for much longer than a minute. What am I?",
    answers: ["breath", "my breath", "holding breath"],
    hint: "It keeps you alive!"
  }
];
// Web Audio API Synthesizer (No external assets required!)
function playSynthesizedSound(type) {
  const soundToggle = document.getElementById('sound-toggle');
  if (!soundToggle || !soundToggle.checked) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (type === 'send') {
      // Soft high pitch chirp
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(580, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(750, ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } else if (type === 'receive') {
      // Double pop bubble sound
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(280, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(420, ctx.currentTime + 0.06);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(420, ctx.currentTime + 0.06);
      osc2.frequency.exponentialRampToValueAtTime(560, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc1.stop(ctx.currentTime + 0.06);
      osc2.start(ctx.currentTime + 0.06);
      osc2.stop(ctx.currentTime + 0.12);
    }
  } catch (err) {
    console.warn("Audio context not allowed or initialized by browser rules:", err);
  }
}
// Generate Time-of-Day Greeting
function getTimeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}
// Simple Math Evaluator
function evaluateMath(expression) {
  // Sanitize: allow only numbers, spaces, operators + - * / and parentheses () or decimals .
  const cleaned = expression.replace(/[^0-9\s\+\-\*\/\(\)\.]/g, '');
  if (!cleaned || cleaned.trim() === '') return null;

  try {
    // Evaluating mathematical strings safely using Function constructor rather than eval
    const evaluator = new Function(`"use strict"; return (${cleaned})`);
    const result = evaluator();
    if (result === undefined || isNaN(result) || !isFinite(result)) return null;
    return result;
  } catch (e) {
    return null;
  }
}
// Rule-Based Responses Engine
function generateBotResponse(userInput) {
  const cleanInput = userInput.trim().toLowerCase();
  // 1. If currently answering a riddle
  if (state.activeRiddle !== null) {
    const currentRiddle = RIDDLES[state.activeRiddleIndex];

    if (cleanInput.includes("give up") || cleanInput.includes("pass") || cleanInput.includes("solution") || cleanInput.includes("answer")) {
      const correctAnswer = currentRiddle.answers[0];
      state.activeRiddle = null;
      state.activeRiddleIndex = -1;
      return `No problem! The answer was **"${correctAnswer}"**. Let me know if you want another "riddle" or need something else! 🧩`;
    }
    if (cleanInput.includes("hint") || cleanInput.includes("clue")) {
      return `💡 **Hint:** ${currentRiddle.hint}`;
    }
    // Match answers
    const isCorrect = currentRiddle.answers.some(ans => cleanInput.includes(ans));
    if (isCorrect) {
      state.activeRiddle = null;
      state.activeRiddleIndex = -1;
      state.successfulMatches++;
      return `🎉 **Correct!** Excellent job. You solved the puzzle! Need another "riddle", or should we try some "math"?`;
    } else {
      return `❌ That's not it! Try again, type **"hint"** for a clue, or type **"give up"** to see the answer.`;
    }
  }
  // 2. Regular rule pattern matching

  // HELP COMMAND
  if (/\b(help|commands|what can you do|features|info|menu|capabilities)\b/i.test(cleanInput)) {
    state.successfulMatches++;
    return `Here is a list of commands I respond to:
    <ul>
      <li>👋 <strong>Greeting</strong>: Try saying "hello" or "good morning"</li>
      <li>🕒 <strong>Time</strong>: Ask "what time is it?"</li>
      <li>📅 <strong>Date</strong>: Ask "what is today's date?"</li>
      <li>⚡ <strong>Math</strong>: Type "calculate 15 * 8" or "100 / 4"</li>
      <li>⛅ <strong>Weather</strong>: Ask "how is the weather?"</li>
      <li>😂 <strong>Jokes</strong>: Say "tell me a joke"</li>
      <li>🧩 <strong>Riddles</strong>: Say "give me a riddle" to start a puzzle game</li>
      <li>👤 <strong>Bot Info</strong>: Ask "who are you?"</li>
    </ul>`;
  }
  // GREETINGS
  if (/\b(hi|hello|hey|greetings|yo|howdy|hola|good\s*(morning|afternoon|evening))\b/i.test(cleanInput)) {
    state.successfulMatches++;
    const dayGreet = getTimeGreeting();
    return `${dayGreet}! I am Aura, your virtual assistant. How can I make your day easier? 😊`;
  }
  // FAREWELLS
  if (/\b(bye|goodbye|see you|farewell|exit|quit|goodnight|night)\b/i.test(cleanInput)) {
    state.successfulMatches++;
    return `Goodbye! Have an amazing day ahead. Feel free to come back and chat anytime! 👋`;
  }
  // WELL-BEING
  if (/\b(how are you|how is it going|how's it going|how are you doing|doing well|how's life)\b/i.test(cleanInput)) {
    state.successfulMatches++;
    return `I'm humming along perfectly at 100% capacity! Thank you for asking. How are you doing today?`;
  }
  // IDENTITY
  if (/\b(your name|who are you|what is your name|identify yourself|aura)\b/i.test(cleanInput)) {
    state.successfulMatches++;
    return `I am **Aura**, a state-of-the-art chatbot operating on a deterministically mapped pattern-matching ruleset. I respond instantly without needing large AI clusters! ⚡`;
  }
  // MATH CALCULATOR
  if (/\b(calculate|math|eval|compute)\b/i.test(cleanInput) || /[\d\s]+[\+\-\*\/]+[\d\s]+/i.test(cleanInput)) {
    // Extract expression
    let expression = cleanInput.replace(/calculate|math|eval|compute/gi, '').trim();
    const result = evaluateMath(expression);
    if (result !== null) {
      state.successfulMatches++;
      return `📊 My calculator core processed: \`${expression}\` and obtained:\n\n**${result}**`;
    }
  }
  // WEATHER
  if (/\b(weather|rain|sunny|temperature|forecast|outside|windy|climate)\b/i.test(cleanInput)) {
    state.successfulMatches++;
    return `⛅ **Virtual Weather Report:** Currently 22°C (71.6°F) inside the host system, with 0% risk of hardware precipitation and a refreshing breeze of incoming data packets!`;
  }
  // TIME
  if (/\b(time|what time|current time|clock)\b/i.test(cleanInput)) {
    state.successfulMatches++;
    const timeStr = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    return `🕒 The current local system time is **${timeStr}**.`;
  }
  // DATE
  if (/\b(date|what day|today|what is the date)\b/i.test(cleanInput)) {
    state.successfulMatches++;
    const dateStr = new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    return `📅 Today's date is **${dateStr}**.`;
  }
  // JOKES
  if (/\b(joke|jokes|make me laugh|humor|funny)\b/i.test(cleanInput)) {
    state.successfulMatches++;
    const idx = Math.floor(Math.random() * JOKES.length);
    return JOKES[idx];
  }
  // RIDDLES
  if (/\b(riddle|riddles|brainteaser|puzzle)\b/i.test(cleanInput)) {
    state.successfulMatches++;
    const idx = Math.floor(Math.random() * RIDDLES.length);
    state.activeRiddle = RIDDLES[idx];
    state.activeRiddleIndex = idx;
    return `🧩 **Riddle Time!** Here is your challenge:\n\n*"${state.activeRiddle.question}"*\n\nType your answer below! You can also type **"hint"** or **"give up"**.`;
  }
  // GRATITUDE
  if (/\b(thanks|thank you|thanks a lot|awesome|great|cool|perfect|nice)\b/i.test(cleanInput)) {
    state.successfulMatches++;
    return `You're very welcome! Helping you is what I do best. Anything else I can solve for you? 🌟`;
  }
  // HUMAN OR BOT
  if (/\b(are you human|robot|bot|ai|real person)\b/i.test(cleanInput)) {
    state.successfulMatches++;
    return `I am a computer program, specifically a rule-based chatbot. I match your queries against regular expressions to give immediate, predictable answers! 💻`;
  }
  // DEFAULT FALLBACK
  return `I'm not quite sure how to process that. Let's try something else!\n\n💡 Try asking me **"tell me a joke"**, **"give me a riddle"**, **"calculate 12 * 12"**, or type **"help"** to see my full commands list.`;
}
// UI Rendering Functions
function appendMessage(text, sender) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${sender}-message transition-in`;
  // Avatar initial
  const avatarDiv = document.createElement('div');
  avatarDiv.className = 'message-avatar';
  avatarDiv.textContent = sender === 'user' ? 'U' : 'A';
  // Wrapper
  const wrapperDiv = document.createElement('div');
  wrapperDiv.className = 'message-wrapper';
  // Message content
  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';

  // Format line breaks or bold styling simple converter
  let formattedText = text
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\`(.*?)\`/g, '<code>$1</code>');
  contentDiv.innerHTML = formattedText;
  // Time
  const timeSpan = document.createElement('span');
  timeSpan.className = 'message-time';
  timeSpan.textContent = new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  wrapperDiv.appendChild(contentDiv);
  wrapperDiv.appendChild(timeSpan);
  msgDiv.appendChild(avatarDiv);
  msgDiv.appendChild(wrapperDiv);
  chatMessages.appendChild(msgDiv);

  // Scroll to bottom
  chatMessages.scrollTop = chatMessages.scrollHeight;
}
// Display Typing Indicator
function showTypingIndicator(show) {
  const indicator = document.getElementById('typing-indicator');
  const chatMessages = document.getElementById('chat-messages');
  if (!indicator) return;
  if (show) {
    indicator.style.display = 'flex';
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  } else {
    indicator.style.display = 'none';
  }
}
// Update Dashboard Statistics
function updateStats() {
  const userMsgEl = document.getElementById('stat-user-msg');
  const botMsgEl = document.getElementById('stat-bot-msg');
  const matchRateEl = document.getElementById('stat-match-rate');
  if (userMsgEl) userMsgEl.textContent = state.userMessageCount;
  if (botMsgEl) botMsgEl.textContent = state.botMessageCount;

  if (matchRateEl && state.userMessageCount > 0) {
    const rate = Math.round((state.successfulMatches / state.userMessageCount) * 100);
    matchRateEl.textContent = `${Math.min(100, Math.max(0, rate))}%`;
  }
}
// Session Duration Counter
function startSessionTimer() {
  const timerEl = document.getElementById('stat-session-time');
  if (!timerEl) return;
  setInterval(() => {
    const durationSec = Math.floor((Date.now() - state.sessionStartTime) / 1000);
    const mins = Math.floor(durationSec / 60).toString().padStart(2, '0');
    const secs = (durationSec % 60).toString().padStart(2, '0');
    timerEl.textContent = `${mins}:${secs}`;
  }, 1000);
}
// Handle User Input Submission
function handleUserMsg(messageText) {
  if (!messageText || messageText.trim() === '') return;
  // Add User Message to UI
  appendMessage(messageText, 'user');
  playSynthesizedSound('send');
  // Update State Stats
  state.userMessageCount++;
  updateStats();
  // Clear Input
  const chatInput = document.getElementById('chat-input');
  if (chatInput) chatInput.value = '';
  // Show Typing Indicator
  showTypingIndicator(true);
  // Compute Response Time Delay (simulating realistic response generation)
  const typingDelay = Math.min(1600, Math.max(500, messageText.length * 15));
  setTimeout(() => {
    // Generate and Add Bot Response
    const botResponse = generateBotResponse(messageText);
    showTypingIndicator(false);
    appendMessage(botResponse, 'bot');
    playSynthesizedSound('receive');
    // Update Bot Stats
    state.botMessageCount++;
    updateStats();
  }, typingDelay);
}
// Setup Event Handlers
document.addEventListener('DOMContentLoaded', () => {
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const themeToggleBtn = document.getElementById('theme-toggle');
  const suggestionChips = document.getElementById('suggestion-chips');
  // Form Submit Handler
  if (chatForm && chatInput) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      handleUserMsg(chatInput.value);
    });
  }
  // Suggestion Chips Click Handler
  if (suggestionChips) {
    suggestionChips.addEventListener('click', (e) => {
      const chip = e.target.closest('.suggestion-chip');
      if (chip) {
        const query = chip.getAttribute('data-query');
        handleUserMsg(query);
      }
    });
  }
  // Theme Toggle Handler
  if (themeToggleBtn) {
    // Load persisted theme
    const savedTheme = localStorage.getItem('aura-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggleBtn.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme');
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('aura-theme', newTheme);
      playSynthesizedSound('send');
    });
  }
  // Initialize Session Timer
  startSessionTimer();
});
