# MakeVideo AI Pro — WhatsApp Text-to-Video Generator Bot

## 📱 Overview

**MakeVideo AI Pro** is a WhatsApp-based AI service that transforms text descriptions into cinematic videos — all through simple chat messages. Built as an extension of the original MakeVideo AI web platform, this integration brings AI video generation directly to WhatsApp, making creative video production accessible to everyone with a smartphone.

Simply send a text description to our WhatsApp number, and the AI will process your request, generate a high-quality video, and send it back within minutes — all in a natural, conversational interface.

---

## 🚀 Live Demo & Walkthrough

You can test the live applications and watch a complete video walkthrough of the projects at the links below.

### MakeVideo AI Pro
* **Live Deployed App:** **[https://make-video-ai-pro.vercel.app](https://make-video-ai-pro.vercel.app)**
* **Video Walkthrough:** **[https://drive.google.com/file/d/104IrRDsPsj8gaZqff4_e51OUp05FfBUh/view](https://drive.google.com/file/d/104IrRDsPsj8gaZqff4_e51OUp05FfBUh/view)**

### MakeVideo AI
* **Live Deployed App:** **[https://make-video-ai.vercel.app](https://make-video-ai.vercel.app)**
* **Video Walkthrough:** **[https://drive.google.com/file/d/1oTs8tVeXIiZdzsVV8GQQrclj8kM3Rh2K/view](https://drive.google.com/file/d/1oTs8tVeXIiZdzsVV8GQQrclj8kM3Rh2K/view)**
  
---

## ✨ Key Features

### 💬 Conversational Interface
- **Natural Language:** Describe any video concept in plain language
- **Conversational Memory:** Bot remembers previous interactions for better context
- **Smart Suggestions:** Automatically suggests improvements for vague prompts
- **Command System:** Comprehensive set of commands for managing your videos

### 🎬 Advanced Video Generation
- **Triple-Provider Pipeline:** Uses Minimax, Replicate, and ModelsLab for reliable generation
- **High Fault Tolerance:** Multiple fallback mechanisms ensure you always get a response
- **Prompt Enhancement:** AI-powered improvements to your video descriptions
- **Asynchronous Processing:** Background generation with real-time status updates

### 🧠 Intelligent Experience
- **Request Management:** Track, cancel, and review all your video requests
- **Privacy Controls:** Clear your chat history or delete all your data
- **Detailed Status Updates:** Follow your video's progress from start to finish
- **Personal Video Library:** Build and manage your collection of AI-generated videos

---

## 🤖 Command Reference

| Command                | Description                                      |
|------------------------|--------------------------------------------------|
| `/status`              | Check your most recent video request             |
| `/status [job-id]`     | Check a specific video request                   |
| `/history`             | View your past video requests                    |
| `/cancel [job-id]`     | Cancel a processing video                        |
| `/delete-history-videoid [job-id]` | Delete a specific video              |
| `/delete-history-all`  | Clear your entire video history                  |
| `/forget-me`           | Remove all your data from our system             |
| `/clear-chat`          | Delete only chat history, keep videos            |
| `/privacy`             | View our privacy policy                          |
| `/help`                | Show all available commands                      |

---

## 🛠️ Technical Architecture
<img width="3037" height="1551" alt="Make" src="https://github.com/user-attachments/assets/6adf9de4-bf72-4a49-9ba8-ddaa66973f24" />

MakeVideo AI Pro integrates Twilio's WhatsApp API with a sophisticated AI pipeline:

1. **Message Reception:** User messages arrive via Twilio webhook
2. **Intent Analysis:** Google Gemini 2.0 analyzes and classifies user intent
3. **Context Retrieval:** Previous conversation history provides context
4. **Video Generation:** Multi-provider approach with cascading fallbacks:
    - Minimax → Replicate → ModelsLab → Fallback video
5. **Response Delivery:** Generated videos and messages sent via Twilio
6. **Data Persistence:** PostgreSQL database stores conversations and videos

---

### Data Schema

```js
// Jobs tracking table
export const WhatsAppjobsTable = pgTable("jobs", {
  id: text().primaryKey(),                      // UUID as primary key
  userPhone: text().notNull(),                  // User's WhatsApp number
  userPrompt: text().notNull(),                 // Original prompt
  enhancedPrompt: text(),                       // AI-enhanced prompt
  status: text().notNull().default("pending"),  // pending → processing → completed/failed
  videoUrl: text(),                             // Generated video URL
  createdAt: timestamp().defaultNow().notNull(),// Creation timestamp
  updatedAt: timestamp().defaultNow().notNull(),// Last update timestamp
});

// Conversation history table
export const ConversationHistoryTable = pgTable("conversation_history", {
  id: integer().primaryKey().generatedAlwaysAsIdentity(),
  userPhone: text().notNull(),                  // User's WhatsApp number
  role: text().notNull(),                       // "user" or "assistant"
  message: text().notNull(),                    // Message content
  timestamp: timestamp().defaultNow().notNull(),// Message timestamp
});
```

---

## 💻 Technology Stack

- **Frontend:** WhatsApp messaging interface
- **Backend:** Next.js, Node.js API routes
- **Database:** PostgreSQL with Drizzle ORM
- **AI Services:**
    - Google Gemini 2.0 (conversation understanding)
    - Minimax (primary video generation)
    - Replicate (secondary video generation)
    - ModelsLab (tertiary video generation)
- **Messaging:** Twilio WhatsApp API
- **Deployment:** Vercel

---

## ⚡ Getting Started

### Prerequisites

- Node.js v18+
- PostgreSQL database
- Twilio account with WhatsApp sandbox
- API keys (Google Gemini, Minimax, Replicate, ModelsLab)

### Environment Setup

Create a `.env` file with:

```
DATABASE_URL=your_postgres_connection_url
REPLICATE_API_TOKEN=your_replicate_api_key
GEMINI_API_KEY=your_google_gemini_api_key
MODELSLAB_API=your_modelslab_api_key
MINIMAX_API_KEY=your_minimax_api_key
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
BASE_URL=your_base_url_for_webhook
```

### Installation & Setup

```bash
# Clone the repository
git clone https://github.com/Shubhraj-Shubh/makevideo-ai-pro.git
cd makevideo-ai-pro

# Install dependencies
npm install

# Set up database schema
npx drizzle-kit push

# Start development server
npm run dev

# Set Twilio webhook URL to:
# https://your-domain.com/api/whatsapp
```

---

## 🔍 Implementation Highlights

### RAG-Based Conversation Memory

The bot implements Retrieval-Augmented Generation to maintain context:

```js
// Retrieve recent conversation history
const recentMessages = await getRecentConversation(fromNumber, 5);
const conversationContext = formatConversationForGemini(recentMessages);

// Add context to prompt for Gemini
const PROMPT = `
  ...
  Recent conversation:
  ${conversationContext}

  User's latest message: "${incomingMsg}"
`;
```

### Multi-Provider Video Pipeline

```js
try {
  // Try Minimax first
  const taskId = await invokeVideoGeneration(enhancedPrompt);
  // Polling logic...
  videoUrl = await fetchVideoResult(fileId);
} catch(MinimaxError) {
  try {
    // Try Replicate second
    videoUrl = await generateVideoWithReplicate(enhancedPrompt);
  } catch(ReplicateError) {
    try {
      // Try ModelsLab third
      videoUrl = await generateVideoWithModelsLab(enhancedPrompt);
    } catch(ModelsLabError) {
      // Fallback video as last resort
      videoUrl = "https://fallback-video-url.mp4";
    }
  }
}
```

---

## ❓ FAQ

**Q: What phone number do I use to access the bot?**  
A: Contact the developer for the current WhatsApp sandbox number and join code.

**Q: How long does video generation take?**  
A: Typically 30–90 seconds, depending on system load and which provider is used.

**Q: Is there a limit to how many videos I can generate?**  
A: Currently no user-facing limit, but API rate limits may apply.

**Q: Is my conversation data private?**  
A: Yes. Your data is stored only for functionality purposes. Use `/privacy` for details or `/forget-me` to delete all your data.

**Q: What if the video generation fails?**  
A: The system tries multiple providers in sequence. If all fail, you'll receive a fallback video.

**Q: Can I use this in WhatsApp groups?**  
A: Currently the bot only supports 1-on-1 conversations.

---

## 🔗 Related Projects

- [Previous MakeVideo AI Web Platform](https://github.com/Shubhraj-Shubh/MakeVideo-AI)

---

## 👤 Credits

Developed by Shubhraj Singh Dodiya  
Built with Next.js, Twilio, Google Gemini, Minimax, Replicate, and ModelsLab

---

## 📧 Contact

For support or inquiries: shubhrajput19194@gmail.com
