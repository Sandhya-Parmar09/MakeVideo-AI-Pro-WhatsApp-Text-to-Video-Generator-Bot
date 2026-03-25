import { db } from "@/config/db";
import { videosTable, WhatsAppjobsTable } from "@/config/schema";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { v2 as cloudinary } from 'cloudinary';
import twilio from 'twilio';
import fetch from 'node-fetch';

// Cloudinary Setup
cloudinary.config({ 
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
  api_key: process.env.CLOUDINARY_API_KEY, 
  api_secret: process.env.CLOUDINARY_API_SECRET 
});

// Twilio Setup
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// Helper function to send WhatsApp messages via Twilio
async function sendTwilioMessage(toNumber, message, mediaUrls = []) {
  try {
    const messagePayload = {
      from: "whatsapp:+14155238886", // Your Twilio WhatsApp number
      to: toNumber,
      body: message,
    };

    if (mediaUrls && mediaUrls.length > 0) {
      messagePayload.mediaUrl = mediaUrls;
    }

    const response = await twilioClient.messages.create(messagePayload);
    console.log(`Message sent to ${toNumber}: ${response.sid}`);
    return response;
  } catch (error) {
    console.error(`Error sending Twilio message to ${toNumber}:`, error);
    throw error;
  }
}

// Helper function to upload video to Cloudinary
async function uploadToCloudinary(videoUrl) {
  try {
    console.log("Uploading video to Cloudinary:", videoUrl);
    
    const uploadResult = await cloudinary.uploader.upload(videoUrl, {
      resource_type: "video",
      folder: "kling-ai-videos",
      timeout: 120000, // 2 minutes timeout
    });

    console.log("Video uploaded to Cloudinary:", uploadResult.secure_url);
    return uploadResult.secure_url;
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    throw error;
  }
}

export async function POST(req) {
  try {
    const body = await req.json();
    console.log("Kling AI Webhook received:", JSON.stringify(body, null, 2));

    const { task_id, task_status, task_status_msg, task_result } = body;

    if (!task_id) {
      return NextResponse.json({ error: "No task_id provided" }, { status: 400 });
    }

    // Find records with this task_id in videosTable
    const videoRecords = await db
      .select()
      .from(videosTable)
      .where(eq(videosTable.videoUrl, task_id));

    // Find records with this task_id in WhatsAppjobsTable
    const whatsappJobs = await db
      .select()
      .from(WhatsAppjobsTable)
      .where(eq(WhatsAppjobsTable.videoUrl, task_id));

    // Handle different task statuses
    if (task_status === "succeed" && task_result?.videos?.[0]?.url) {
      const klingVideoUrl = task_result.videos[0].url;
      console.log("Video generation succeeded! Kling URL:", klingVideoUrl);

      // Use Kling URL directly to avoid Vercel timeout (10 sec free tier)
      // Kling URLs are valid for 30 days, which is sufficient
      const finalVideoUrl = klingVideoUrl;
      
      // Optional: Try Cloudinary upload in background (will likely timeout but won't block response)
      // uploadToCloudinary(klingVideoUrl).then(url => {
      //   console.log("Background upload to Cloudinary succeeded:", url);
      // }).catch(err => {
      //   console.log("Background upload failed (expected on free tier):", err.message);
      // });

      // Update videosTable records
      if (videoRecords.length > 0) {
        for (const record of videoRecords) {
          await db
            .update(videosTable)
            .set({ videoUrl: finalVideoUrl })
            .where(eq(videosTable.id, record.id));
          
          console.log(`Updated videosTable record ${record.id} with video URL`);
        }
      }

      // Update WhatsAppjobsTable records and notify users
      if (whatsappJobs.length > 0) {
        for (const job of whatsappJobs) {
          // Update job status
          await db
            .update(WhatsAppjobsTable)
            .set({ 
              videoUrl: finalVideoUrl,
              status: "completed",
              updatedAt: new Date()
            })
            .where(eq(WhatsAppjobsTable.id, job.id));

          console.log(`Updated WhatsApp job ${job.id} with video URL`);

          // Send WhatsApp notification to user
          try {
            const successMessage = 
              `🎉 *Your video is ready!*\n\n` +
              `💭 *Prompt:* "${job.userPrompt}"\n` +
              `🎬 *Job ID:* ${job.id}\n\n` +
              `Your video has been generated successfully! Check it out below 👇`;

            // Send text message first
            await sendTwilioMessage(
              job.userPhone,
              successMessage
            );

            // Then send video separately
            await sendTwilioMessage(
              job.userPhone,
              "Here's your video! 🎬",
              [finalVideoUrl]
            );

            console.log(`Sent success notification to ${job.userPhone}`);
          } catch (twilioError) {
            console.error("Error sending WhatsApp notification:", twilioError);
          }
        }
      }

      return NextResponse.json({ 
        success: true, 
        message: "Video processed and saved successfully",
        videoUrl: finalVideoUrl 
      });

    } else if (task_status === "failed") {
      console.error("Video generation failed:", task_status_msg);

      // Use fallback video URL
      const fallbackUrl = "http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

      // Update videosTable records
      if (videoRecords.length > 0) {
        for (const record of videoRecords) {
          await db
            .update(videosTable)
            .set({ videoUrl: fallbackUrl })
            .where(eq(videosTable.id, record.id));
          
          console.log(`Updated videosTable record ${record.id} with fallback URL`);
        }
      }

      // Update WhatsAppjobsTable records and notify users
      if (whatsappJobs.length > 0) {
        for (const job of whatsappJobs) {
          // Update job status
          await db
            .update(WhatsAppjobsTable)
            .set({ 
              videoUrl: fallbackUrl,
              status: "failed",
              updatedAt: new Date()
            })
            .where(eq(WhatsAppjobsTable.id, job.id));

          console.log(`Updated WhatsApp job ${job.id} with failed status`);

          // Send failure notification
          try {
            const failureMessage = 
              `😔 *Video generation failed*\n\n` +
              `💭 *Prompt:* "${job.userPrompt}"\n` +
              `🎬 *Job ID:* ${job.id}\n\n` +
              `Unfortunately, we couldn't generate your video. Reason: ${task_status_msg || "Unknown error"}\n\n` +
              `Please try again with a different prompt or contact support.`;

            await sendTwilioMessage(job.userPhone, failureMessage);

            console.log(`Sent failure notification to ${job.userPhone}`);
          } catch (twilioError) {
            console.error("Error sending WhatsApp notification:", twilioError);
          }
        }
      }

      return NextResponse.json({ 
        success: false, 
        message: "Video generation failed",
        error: task_status_msg 
      });

    } else {
      // Still processing
      console.log(`Task ${task_id} status: ${task_status}`);
      return NextResponse.json({ 
        success: true, 
        message: `Task status: ${task_status}` 
      });
    }

  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ 
      error: error.message || "Internal Server Error" 
    }, { status: 500 });
  }
}
