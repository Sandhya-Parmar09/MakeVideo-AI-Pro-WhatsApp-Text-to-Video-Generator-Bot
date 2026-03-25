
import {
  GoogleGenAI,
} from '@google/genai';
import twilio from 'twilio';
import { randomUUID } from 'crypto';
import { db } from '@/config/db';
import { eq,desc } from "drizzle-orm";
import { WhatsAppjobsTable,ConversationHistoryTable } from '@/config/schema';




// Save messages to conversation history
async function saveConversationMessage(userPhone, role, message) {
  try {
    await db.insert(ConversationHistoryTable)
      .values({
        userPhone: userPhone,
        role: role,
        message: message
      });
    console.log(`Saved ${role} message to conversation history for ${userPhone}`);
  } catch (error) {
    console.error("Error saving to conversation history:", error);
  }
}


// Get limited recent conversation history
async function getRecentConversation(userPhone, limit = 5) {
  try {
    const messages = await db
      .select()
      .from(ConversationHistoryTable)
      .where(eq(ConversationHistoryTable.userPhone, userPhone))
      .orderBy(desc(ConversationHistoryTable.timestamp))
      .limit(limit * 2); // Get both user and assistant messages (pairs)
    
    // Return in chronological order (oldest first)
    return messages.reverse();
  } catch (error) {
    console.error("Error retrieving conversation history:", error);
    return [];
  }
}



// Update formatConversationForGemini function to better handle suggested prompts
function formatConversationForGemini(messages) {
  if (!messages || messages.length === 0) {
    return "No previous conversation.";
  }
  
  return messages.map(msg => {
    // Handle special format for suggested prompts if we implement that later
    if (msg.message && msg.message.startsWith("SUGGESTED_PROMPT:")) {
      const suggestion = msg.message.replace("SUGGESTED_PROMPT:", "");
      return `MakeVideo AI: 🤔 Your prompt is a bit short. How about this instead: "${suggestion}"`;
    }
    
    const roleDisplay = msg.role === "user" ? "User" : "MakeVideo AI";
    return `${roleDisplay}: ${msg.message}`;
  }).join("\n");
}


export async function POST(req) {

  // 1. Get credentials and the Twilio client ready
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const client = twilio(accountSid, authToken);

  // 2. Extract the incoming message from Twilio
  const body = await req.formData();
  const incomingMsg = body.get('Body'); // The user's message
  const fromNumber = body.get('From'); // The user's WhatsApp number (e.g., whatsapp:+919876543210)
  
  console.log(`Message received from ${fromNumber}: "${incomingMsg}"`);


    // Save user's message to conversation history
  await saveConversationMessage(fromNumber, "user", incomingMsg);

 // Check if this is a command (starts with /)
  if (incomingMsg && incomingMsg.startsWith('/')) {
    await handleCommand(client, fromNumber, incomingMsg);
    return new Response('<Response></Response>', { 
      headers: { 'Content-Type': 'text/xml' } 
    });
  }


    // Get recent conversation history for context (last 3 exchanges)
  const recentMessages = await getRecentConversation(fromNumber, 3);
  const conversationContext = formatConversationForGemini(recentMessages);

  //prompt for gemini with conversation context
const PROMPT=`You are MakeVideo AI Pro, a WhatsApp bot that generates videos based on text descriptions. Read the recent conversation and decide what to do next.

Based on the user's latest message and conversation context, return a JSON object with these fields:
1. "action": EXACTLY one of these three values:
   - "generate_video": When the user wants a video and has given a clear, descriptive prompt
   - "suggest_improvement": When the user wants a video but their prompt is too vague or short
   - "conversation": For greetings, questions, or any other chat that's not about creating a video

2. "response": What to say to the user

3. "prompt": If action is "generate_video", include an enhanced prompt for the video. If action is "suggest_improvement", include your suggested improved prompt.

IMPORTANT INSTRUCTIONS:

1. If you previously suggested an improved prompt and the user accepts it (by saying "yes", "ok", "sure", etc.), set action to "generate_video" and use your previous suggestion as the prompt.

2. If the user asks to see past conversations or chat history, respond by actually summarizing the visible conversation in a friendly, detailed way. Include specific details from previous messages that you can see in the conversation context.

3. When discussing the conversation history, be specific about what was said - mention actual prompts, suggestions, or topics discussed in the visible messages.

4. If the user asks about their video history or past videos, kindly direct them to use the "/history" command to see their past video requests.

Recent conversation:
${conversationContext}

User's latest message: "${incomingMsg}"`;




// user message ko gemini se pass karna 
const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

    try{
  const config = {
    responseMimeType: 'text/plain',
  };
  // const model = 'gemini-2.0-flash';
  const model = 'gemma-3-27b-it';
  const contents = [
    {
      role: 'user',
      parts: [
        {
          text: PROMPT + JSON.stringify(incomingMsg),
        },
      ],
    },
  ];

  const response = await ai.models.generateContent({
    model,
    config,
    contents,
  });
 

const RawResp = response.candidates[0].content.parts[0].text;
const RawJson = RawResp.replace('```json','').replace('```', '');
const JSONResp = JSON.parse(RawJson);

  // Extract fields from Gemini response
  const action = JSONResp.action;
  const responseText = JSONResp.response;
  const videoPrompt = JSONResp.prompt || incomingMsg;

  // Simplified switch with just 3 cases
  switch (action) {
    case "generate_video":
      // Start video generation with the enhanced prompt
      await sendTwilioMessage(client, fromNumber, responseText);
      generateVideoInBackground(client, fromNumber, incomingMsg, videoPrompt);
      break;

    case "suggest_improvement":
      // Store the suggestion in conversation history for future reference
      await saveConversationMessage(fromNumber, "system", `SUGGESTED_PROMPT:${videoPrompt}`);
      await sendTwilioMessage(client, fromNumber, responseText);
      break;
      
    case "conversation":
    default:
      // Just chat normally
      await sendTwilioMessage(client, fromNumber, responseText);
      break;
  }
}
catch (geminiError){
    console.error("Gemini error:", geminiError);
      await sendTwilioMessage(
    client,
    fromNumber, 
    "I'm sorry, I had trouble understanding your message. Could you please try rephrasing it?"
  );
}


     
  // 4. Send an empty response to Twilio to acknowledge receipt
  return new Response('<Response></Response>', { 
    headers: { 'Content-Type': 'text/xml' } 
  });
}



// Function to handle all commands
async function handleCommand(client, fromNumber, message) {
  const parts = message.trim().split(' ');
  const command = parts[0].toLowerCase();
  const parameters = parts.slice(1).join(' ');
  
  switch (command) {
    case '/status':
      // If no job ID provided, show the latest job status
      if (!parameters) {
        await showLastJobStatus(client, fromNumber);
      } else {
        await checkJobStatus(client, fromNumber, parameters);
      }
      break;
      
    case '/help':
      // Show help message with all available commands
      await showHelpMenu(client, fromNumber);
      break;
      
    case '/history':
      // Show user's request history
      await showUserHistory(client, fromNumber);
      break;

        case '/cancel':
      // Cancel a job
      const cancelJobId = parameters;
      if (!cancelJobId) {
        await sendTwilioMessage(client, fromNumber, "Please provide a job ID to cancel. For example: /cancel abc123");
        return;
      }
      await cancelJob(client, fromNumber, cancelJobId);
      break;
      
    case '/delete-history-all':
      // Delete all user history
      await deleteAllUserHistory(client, fromNumber);
      break;
      
    case '/forget-me':
      // Delete all user data (videos and conversation)
      await forgetUserData(client, fromNumber);
      break;
      

          case '/clear-chat':
      // Delete only conversation history
      await clearChatHistory(client, fromNumber);
      break;
      
    case '/privacy':
      // Show privacy policy
      await showPrivacyPolicy(client, fromNumber);
      break;
      


    case '/delete-history-videoid':
      // Delete specific video history
      const deleteJobId = parameters;
      if (!deleteJobId) {
        await sendTwilioMessage(client, fromNumber, "Please provide a job ID to delete. For example: /delete-history-videoid abc123");
        return;
      }
      await deleteSpecificJob(client, fromNumber, deleteJobId);
      break;

       default:
      await sendTwilioMessage(client, fromNumber, "Unknown command. Type /help to see available commands.");
  }
}



// Show the latest job status when user sends just "/status"
async function showLastJobStatus(client, fromNumber) {
  try {
    // Get the most recent job for this user
    const jobs = await db
      .select()
      .from(WhatsAppjobsTable)
      .where(eq(WhatsAppjobsTable.userPhone, fromNumber))
      .orderBy(desc(WhatsAppjobsTable.createdAt))
      .limit(1);
    
    if (!jobs || jobs.length === 0) {
      await sendTwilioMessage(client, fromNumber, "You haven't created any videos yet. Send me a description to get started!");
      return;
    }
    
    // Use the checkJobStatus function to show details for the most recent job
    await checkJobStatus(client, fromNumber, jobs[0].id);
    
  } catch (error) {
    console.error("Error retrieving last job status:", error);
    await sendTwilioMessage(client, fromNumber, "Sorry, I couldn't retrieve your latest job status. Please try again.");
  }
}


// Function to check job status (enhanced with timing information)
async function checkJobStatus(client, fromNumber, jobId) {
  try {
    // Query the database for this job
    const job = await db.select().from(WhatsAppjobsTable).where(eq(WhatsAppjobsTable.id, jobId)).limit(1);
    
    if (!job || job.length === 0) {
      await sendTwilioMessage(client, fromNumber, `❌ No job found with ID: ${jobId}`);
      return;
    }
    
    const jobData = job[0];
    
    // Only show details if this is the user who created the job
    if (jobData.userPhone !== fromNumber) {
      await sendTwilioMessage(client, fromNumber, `⚠️ You don't have permission to view this job.`);
      return;
    }
    
    const creationTime = jobData.createdAt ? new Date(jobData.createdAt) : null;
    const completionTime = jobData.updatedAt ? new Date(jobData.updatedAt) : null;
    
    // let timeInfo = "";
    // if (creationTime) {
    //   timeInfo = `\n📅 Created: ${formatDate(creationTime)}`;
      
    //   if (completionTime && jobData.status === "completed") {
    //     const processingTime = Math.round((completionTime - creationTime) / 1000);
    //     timeInfo += `\n⏱️ Processing time: ${processingTime} seconds`;
    //   }
    // }

     let statusMessage = `*Job Status: ${jobId}*\n`;
      statusMessage += `💭 Prompt: "${jobData.userPrompt}"\n`;
    statusMessage += `💭 enhancedPrompt: "${jobData.enhancedPrompt}"\n`;
    // statusMessage += timeInfo + "\n\n";
    
    switch (jobData.status) {
      case 'processing':
        statusMessage += "🔄 Your video is currently being generated. This typically takes 2-5 minutes.\n\n⏳ Please wait, I'll notify you when it's ready!";
        break;
      case 'completed':
        statusMessage += "✅ Your video has been completed!";
        // Check if videoUrl is an actual URL or just a task_id
        if (jobData.videoUrl && (jobData.videoUrl.startsWith('http://') || jobData.videoUrl.startsWith('https://'))) {
          // Send status message first
          await sendTwilioMessage(client, fromNumber, statusMessage);
          // Then send video separately
          await sendTwilioMessage(client, fromNumber, "Here's your video! 🎬", [jobData.videoUrl]);
          return;
        } else {
          statusMessage += "\n\n⏳ Video is still being processed. You'll receive it shortly!";
        }
        break;
      case 'failed':
        // For failed jobs, let's ask AI to apologize
        await apologizeForFailedJob(client, fromNumber, jobData);
        return;
      case 'cancelled':
        statusMessage += "🚫 This job was cancelled.";
        break;
      default:
        statusMessage += `Current status: ${jobData.status}`;
    }
     await sendTwilioMessage(client, fromNumber, statusMessage);
    
  } catch (error) {
    console.error("Error checking job status:", error);
    await sendTwilioMessage(client, fromNumber, "Sorry, there was an error checking the job status.");
  }
}


// Function to handle user history
async function showUserHistory(client, fromNumber) {
  try {
    // Get up to 10 most recent jobs for this user
    const jobs = await db
      .select()
      .from(WhatsAppjobsTable)
      .where(eq(WhatsAppjobsTable.userPhone, fromNumber))
      .orderBy(desc(WhatsAppjobsTable.createdAt))
      .limit(3);
    
    if (!jobs || jobs.length === 0) {
      await sendTwilioMessage(client, fromNumber, "You haven't created any videos yet. Send me a description to get started!");
      return;
    }
    
    let historyMessage = "*Your Video History*\n\n";
    
    for (const job of jobs) {
      const statusEmoji = getStatusEmoji(job.status);
      const date = job.createdAt ? formatDate(new Date(job.createdAt)) : "Unknown date";
      
      historyMessage += `${statusEmoji} *${job.id}*\n`;
        historyMessage += `📝UserPrompt: "${job.userPrompt.substring(0, 30)}${job.userPrompt.length > 30 ? '...' : ''}"\n`;
       historyMessage += `📝EnhancedPrompt: "${job.enhancedPrompt.substring(0, 30)}${job.enhancedPrompt.length > 30 ? '...' : ''}"\n`;
      // Only show video URL if it's an actual URL, not a task_id
      if(job.status==='completed' && job.videoUrl && (job.videoUrl.startsWith('http://') || job.videoUrl.startsWith('https://'))){
         historyMessage += `🔗 VideoUrl: ${job.videoUrl}\n\n`;
      } else if (job.status === 'processing') {
         historyMessage += `⏳ Still processing...\n\n`;
      } else {
         historyMessage += `\n`;
      }
      // historyMessage += `📅 ${date}\n\n`;
    }
    
    historyMessage += "To see details for a specific video, send:\n/status [video-id]";
    
 await sendTwilioMessage(client, fromNumber, historyMessage);
 
  } catch (error) {
    console.error("Error retrieving user history:", error);
    await sendTwilioMessage(client, fromNumber, "Sorry, I couldn't retrieve your history. Please try again.");
  }
}



// Function to handle job cancellation
async function cancelJob(client, fromNumber, jobId) {
  try {
    // Query the database for this job
    const job = await db.select().from(WhatsAppjobsTable).where(eq(WhatsAppjobsTable.id, jobId)).limit(1);
    
    if (!job || job.length === 0) {
      await sendTwilioMessage(client, fromNumber, `❌ No job found with ID: ${jobId}`);
      return;
    }
    
    const jobData = job[0];
    
    // Only allow cancellation if this is the user who created the job
    if (jobData.userPhone !== fromNumber) {
      await sendTwilioMessage(client, fromNumber, `⚠️ You don't have permission to cancel this job.`);
      return;
    }
    
    // Only allow cancellation if the job is still processing
    if (jobData.status !== 'processing') {
      await sendTwilioMessage(client, fromNumber, `⚠️ Cannot cancel job with status: ${jobData.status}`);
      return;
    }
      // Update the job status to cancelled
    await db.update(WhatsAppjobsTable)
      .set({ status: "cancelled" ,
        updatedAt: new Date()  })
      .where(eq(WhatsAppjobsTable.id, jobId));
    
    await sendTwilioMessage(client, fromNumber, `✅ Job ${jobId} has been cancelled.`);
    
  } catch (error) {
    console.error("Error cancelling job:", error);
    await sendTwilioMessage(client, fromNumber, "Sorry, there was an error cancelling the job.");
  }
}


// Function to delete all user history
async function deleteAllUserHistory(client, fromNumber) {
  try {
    // Delete all records for this user
    const result = await db.delete(WhatsAppjobsTable)
      .where(eq(WhatsAppjobsTable.userPhone, fromNumber));
    
    await sendTwilioMessage(client, fromNumber, "✅ Your entire video history has been deleted. All your past requests have been removed from our system.");
    
  } catch (error) {
    console.error("Error deleting user history:", error);
    await sendTwilioMessage(client, fromNumber, "Sorry, there was an error deleting your history. Please try again.");
  }
}


// Function to forget user data
async function forgetUserData(client, fromNumber) {
  try {
    // Delete all records for this user
    await db.delete(WhatsAppjobsTable)
      .where(eq(WhatsAppjobsTable.userPhone, fromNumber));
    
    // Note: We will make conversation history database later ,we will remove from that also after making that database
 // Delete conversation history
    await deleteConversationHistory(fromNumber);

    
    await sendTwilioMessage(client, fromNumber, "✅ All your data has been deleted from our system. Your chat history and video requests have been removed.");
    
  } catch (error) {
    console.error("Error forgetting user data:", error);
    await sendTwilioMessage(client, fromNumber, "Sorry, there was an error processing your request. Please try again.");
  }
}


// Function to delete a specific job
async function deleteSpecificJob(client, fromNumber, jobId) {
  try {
    // Query the database for this job
    const job = await db.select().from(WhatsAppjobsTable).where(eq(WhatsAppjobsTable.id, jobId)).limit(1);
    
    if (!job || job.length === 0) {
      await sendTwilioMessage(client, fromNumber, `❌ No job found with ID: ${jobId}`);
      return;
    }
    
    const jobData = job[0];
    
    // Only allow deletion if this is the user who created the job
    if (jobData.userPhone !== fromNumber) {
      await sendTwilioMessage(client, fromNumber, `⚠️ You don't have permission to delete this job.`);
      return;
    }
    
    // Delete the job
    await db.delete(WhatsAppjobsTable)
      .where(eq(WhatsAppjobsTable.id, jobId));
    
    await sendTwilioMessage(client, fromNumber, `✅ Job ${jobId} has been deleted from your history.`);
    
  } catch (error) {
    console.error("Error deleting job:", error);
    await sendTwilioMessage(client, fromNumber, "Sorry, there was an error deleting the job. Please try again.");
  }
}


// New command for clearing chat history
async function clearChatHistory(client, fromNumber) {
  try {
    try {
    await db.delete(ConversationHistoryTable)
      .where(eq(ConversationHistoryTable.userPhone, fromNumber));
    console.log(`Deleted conversation history for ${fromNumber}`);
  } catch (error) {
    console.error("Error deleting conversation history:", error);
  }
    await sendTwilioMessage(client, fromNumber, "✅ Your chat history has been cleared while keeping your video requests intact.");
  } catch (error) {
    console.error("Error clearing chat history:", error);
    await sendTwilioMessage(client, fromNumber, "Sorry, there was an error clearing your chat history. Please try again.");
  }
}



// Show privacy policy to user
async function showPrivacyPolicy(client, fromNumber) {
  const privacyPolicy = 
    "*MakeVideo AI Privacy Policy*\n\n" +
    "We store the following data:\n" +
    "- Your WhatsApp number\n" +
    "- Messages you send to us\n" +
    "- Our responses to you\n" +
    "- Videos we generate for you\n\n" +
    "We use your recent conversation history to provide better responses. " +
    "This means we may send your recent messages to our AI service providers.\n\n" +
    "You can delete your data at any time using:\n" +
    "- /clear-chat - Remove conversation history\n" +
    "- /delete-history-all - Remove video history\n" +
    "- /forget-me - Remove all your data\n\n" +
    "We do not share your data with third parties except as required to provide our service.";
    
  await sendTwilioMessage(client, fromNumber, privacyPolicy);
}



// Function to show help menu
async function showHelpMenu(client, fromNumber) {
  const helpMessage = 
    "*MakeVideo AI Pro Help Menu*\n\n" +
    "📝 *Basic Commands:*\n" +
    "- Just send a text description to generate a video\n" +
    "- /status - Check your most recent video request\n" +
    "- /status [job-id] - Check a specific video request\n" +
    "- /history - See your past video requests\n" +
    "- /cancel [job-id] - Cancel a video that's being processed\n\n" +
    "🔧 *Advanced Commands:*\n" +
    "- /delete-history-videoid [job-id] - Delete a specific video from your history\n" +
    "- /delete-history-all - Delete your entire video history\n" +
    "- /forget-me - Remove all your data (videos & chat) from our system\n" +
    "- /clear-chat - Delete only your chat history, keep your videos\n" +
    "- /privacy - View our privacy policy\n" +
    "- /help - Show this help menu\n\n" +
    "Need more help? Contact support ";
  
  await sendTwilioMessage(client, fromNumber, helpMessage);
}


// Function for AI to apologize for failed jobs
async function apologizeForFailedJob(client, fromNumber, jobData) {
  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });
  
  try {
    const prompt = `You are MakeVideo AI's customer service representative. A user's video generation has failed. 
    
    Their prompt was: "${jobData.userPrompt}"
    Job ID: ${jobData.id}
    
    Write a short, apologetic message (max 3 sentences) explaining that their video couldn't be generated. 
    Be empathetic but professional. Suggest they try again with a slightly different description. 
    Do NOT mention any technical details or errors.`;
    
    const model = 'gemini-2.0-flash';
    const contents = [{ role: 'user', parts: [{ text: prompt }] }];
    
    const response = await ai.models.generateContent({
      model,
      contents,
      generationConfig: { maxOutputTokens: 200 }
    });
    
    const apologyMessage = response.candidates[0].content.parts[0].text;

 // Send the apology with the job status info
    let statusMessage = `*Job Status: ${jobData.id}*\n`;
    statusMessage += `💭 Prompt: "${jobData.userPrompt}"\n\n`;
    statusMessage += `❌ ${apologyMessage}`;
    
    await sendTwilioMessage(client, fromNumber, statusMessage);
    
  } catch (error) {
    console.error("Error generating apology:", error);
    await sendTwilioMessage(
      client, 
      fromNumber, 
      `❌ Sorry, we couldn't generate your video for prompt: "${jobData.userPrompt}". Please try again with a different description.`
    );
  }
}


// Helper function to format dates in a user-friendly way
function formatDate(date) {
  if (!date) return "Unknown";
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const isToday = date.getDate() === today.getDate() && 
                  date.getMonth() === today.getMonth() && 
                  date.getFullYear() === today.getFullYear();
  
  const isYesterday = date.getDate() === yesterday.getDate() && 
                      date.getMonth() === yesterday.getMonth() && 
                      date.getFullYear() === yesterday.getFullYear();
  
  if (isToday) {
    return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else if (isYesterday) {
    return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  } else {
    return date.toLocaleString([], { 
      day: '2-digit', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

// Helper function to get emoji for status
function getStatusEmoji(status) {
  switch (status) {
    case 'processing': return '🔄';
    case 'completed': return '✅';
    case 'failed': return '❌';
    case 'cancelled': return '🚫';
    default: return '❓';
  }
}



// Helper function to send WhatsApp messages via Twilio
async function sendTwilioMessage(client,toNumber, message, mediaUrls = []) {

  try {
    const messageOptions = {
      body: message,
      from: 'whatsapp:+14155238886', 
      to: toNumber
    };
    
    // Add media if provided
    if (mediaUrls.length > 0) {
      messageOptions.mediaUrl = mediaUrls;
    }
    

     // Save assistant's message to conversation history (exclude media URLs from history)
    await saveConversationMessage(toNumber, "assistant", message);


    // Send the message
    const result = await client.messages.create(messageOptions);
    console.log(`Message sent successfully. SID: ${result.sid}`);
    console.log(`Message sent successfully for testing. ${messageOptions?.body} and ${messageOptions.mediaUrl}`);
  
  } catch (error) {
    console.error("Failed to send Twilio message:", error);
  }
}


async function generateVideoInBackground(client, fromNumber, incomingMsg, ResponseForUser) {
   
    // Step 1: Generate a unique Job ID using UUID
    const jobId = randomUUID();

    // Step 2: Prepare the data to be saved in the database
    const newJob = {
        id: jobId,
        userPhone: fromNumber,
        userPrompt: incomingMsg,
        enhancedPrompt: ResponseForUser,
        status: "processing", // Set initial status to processing
    };

    console.log(`Job created with ID: ${jobId}`);

    // Step 3: Insert the new job record into the database
   await db.insert(WhatsAppjobsTable).values(newJob).catch(error => {
        console.error("Failed to insert job into database:", error);
    });

const confirmationMessage = `✅ Your request has been received! I've started working on your video.\n\n*Your Job ID is:* ${jobId}\n\n⏳ Video generation usually takes 2-5 minutes. I'll send you the video as soon as it's ready!\n\nYou can check the progress at any time by sending:\n/status ${jobId}`;
await sendTwilioMessage(client,fromNumber, confirmationMessage);

    
    // Step 4: Call the existing video generation API endpoint
try {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/generate-video`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            formPrompt: ResponseForUser,
            jobId: jobId,
            source: 'whatsapp'
        })
    });

    const result = await response.json();
    
    if (result.success && result.videoUrl) {
        // Check if it's a fallback URL
        const FALLBACK_URL = "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";
        const isFallbackVideo = result.videoUrl === FALLBACK_URL;
        
        if (isFallbackVideo) {
            // Kling AI failed, send fallback video immediately
            await db.update(WhatsAppjobsTable)
                .set({ 
                    status: "completed", 
                    videoUrl: result.videoUrl,
                    updatedAt: new Date()
                })
                .where(eq(WhatsAppjobsTable.id, jobId))
                .catch(error => {
                    console.error("Failed to update job status:", error);
                });
            
            console.log(`Job ${jobId} completed with fallback video`);
            
            // Send fallback video to user - separate messages
            await sendTwilioMessage(
                client, 
                fromNumber, 
                `⚠️ I encountered an issue with video generation.\n\n*Job ID:* ${jobId}\n\nHere's a sample video for you! Please try again with a different prompt for better results.`
            );
            
            await sendTwilioMessage(
                client,
                fromNumber,
                "Sample video 🎬",
                [FALLBACK_URL]
            );
        } else {
            // Task ID received, wait for webhook
            await db.update(WhatsAppjobsTable)
                .set({ 
                    status: "processing", 
                    videoUrl: result.videoUrl, // This will be task_id initially
                    updatedAt: new Date()
                })
                .where(eq(WhatsAppjobsTable.id, jobId))
                .catch(error => {
                    console.error("Failed to update job status:", error);
                });
            
            console.log(`Job ${jobId} updated with task_id: ${result.videoUrl}`);
            console.log("User will be notified via webhook when video is ready");
        }
         
    } else {
       // Update job status to failed 
    await db.update(WhatsAppjobsTable)
        .set({ 
            status: "failed",
            updatedAt: new Date() 
        })
        .where(eq(WhatsAppjobsTable.id, jobId))
        .catch(err => console.error("Failed to update job status:", err));
        
        // Notify user of failure
        await sendTwilioMessage(
            client, 
            fromNumber, 
            `❌ Sorry, there was an issue starting your video generation.\n\nJob ID: ${jobId}\n\nPlease try again with a different prompt.`
        );
    }
} catch (error) {
    console.error("Error calling video generation API:", error);
     // Update job status to failed 
    await db.update(WhatsAppjobsTable)
        .set({ 
            status: "failed",
            updatedAt: new Date() 
        })
        .where(eq(WhatsAppjobsTable.id, jobId))
        .catch(err => console.error("Failed to update job status:", err));
    
    await sendTwilioMessage(
        client, 
        fromNumber, 
        `❌ Sorry, there was an error processing your request.\n\nJob ID: ${jobId}\n\nPlease try again later.`
    );
}

}
