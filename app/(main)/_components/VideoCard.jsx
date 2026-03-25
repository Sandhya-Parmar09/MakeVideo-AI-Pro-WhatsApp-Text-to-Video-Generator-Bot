import React, { useState ,useEffect} from 'react'
import { BookmarkMinus,LoaderCircle,Bookmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"


function VideoCard({ video ,onUnsave}) {
  const [loading, setLoading] = useState(false);
    const [isSaved, setIsSaved] = useState(false);



    //Check whether it is in localStorage or not for every unique video_id
  useEffect(() => {
    const savedVideos = JSON.parse(localStorage.getItem("myVideos") || "[]");
    setIsSaved(savedVideos.includes(video.id));
  },[video.id]);


    // Save video to localStorage
  const saveVideo = async () => {
    setLoading(true);
    const savedVideos = JSON.parse(localStorage.getItem("myVideos") || "[]");
    if (!savedVideos.includes(video.id)) {
      savedVideos.push(video.id);
      localStorage.setItem("myVideos", JSON.stringify(savedVideos));
      setIsSaved(true);
      toast.success('Saved in your Collection!');
    }
    setLoading(false);
  };


  // Unsave video from localStorage
  const unsaveVideo = async () => {
    setLoading(true);
    let savedVideos = JSON.parse(localStorage.getItem("myVideos") || "[]");
    savedVideos = savedVideos.filter(id => id !== video.id);
    localStorage.setItem("myVideos", JSON.stringify(savedVideos));
    setIsSaved(false);
    toast.success('Removed from your Collection!');
    setLoading(false);
       if (typeof onUnsave === "function") {
        onUnsave(video.id); //  PASS THE ID BACK TO THE PARENT
    }
  };

  return (
  <div className='shadow rounded-xl'>
      {video?.videoUrl && (
        <video
          src={video.videoUrl}
          controls        
          autoPlay={false} 
          loop={false}    
          muted={false}   
          className="w-full aspect-video rounded-xl object-cover"
        >
          Your browser does not support the video tag.
        </video>
      )}
      <div className='p-3 flex flex-col gap-3'>
        <p className='line-clamp-3 text-gray-400 text-sm'>{video?.prompt}</p>
        <div className="flex justify-between items-center">
          {isSaved ? (
              <Button
              size={'sm'}
              variant="outline"
              onClick={unsaveVideo}
              disabled={loading}
            >
              {loading ? <LoaderCircle className='animate-spin'/> : <BookmarkMinus />}
              Unsave Video
            </Button>
          ) : (
            <Button
              size={'sm'}
              onClick={saveVideo}
              disabled={loading}
            >
              {loading ? <LoaderCircle className='animate-spin'/> : <Bookmark />}
              Save Video
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default VideoCard