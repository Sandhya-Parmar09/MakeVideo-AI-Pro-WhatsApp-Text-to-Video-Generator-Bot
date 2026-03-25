import { db } from "@/config/db";
import { videosTable } from "@/config/schema";
import { NextResponse } from "next/server";

export async function GET() {

  try {
    const allVideos = await db.select().from(videosTable); // saare rows fetch
    
    // Filter out videos that still have task_id instead of actual URL
    // Task IDs are typically alphanumeric strings without http/https
    const readyVideos = allVideos.filter(video => {
      const url = video.videoUrl;
      // Only include videos with actual URLs (starting with http/https)
      return url && (url.startsWith('http://') || url.startsWith('https://'));
    });
    
    return NextResponse.json(readyVideos);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch videos" }, { status: 500 });
  }

    }
