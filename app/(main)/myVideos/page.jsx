"use client"
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import VideoCard from '../_components/VideoCard';
import { Skeleton } from "@/components/ui/skeleton"

function MyVideos() {

     const [videoList, setVideoList] = useState([]);
      const [mySavedVideos, setMySavedVideos] = useState([]);


    const handleUnsave = (unsavedVideoId) => {
        // Filter the existing state array to create a new one by removing the unsaved ID
        const updatedSavedVideos = mySavedVideos.filter(id => id !== unsavedVideoId);
        // Update the state for mySavedvideos regardless of localStorage but same as localStorage
        setMySavedVideos(updatedSavedVideos);
    };
      
      const GetVideoList = async () => {
        const result = await axios.get('/api/get-videos');
        console.log(result.data);
        setVideoList(result.data); 
      };

        useEffect(() => {
    GetVideoList();

    // Read saved videos from localStorage first time
    const savedVideos = JSON.parse(localStorage.getItem("myVideos") || "[]");
    setMySavedVideos(savedVideos);
  }, []);


  return (
   <div >
      <h2 className='font-bold text-3xl mb-6 text-black'>My Videos</h2>
        <div className='grid mt-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5'>
          {videoList.length>0?videoList?.filter(video => mySavedVideos.includes(video?.id))?.map((video, index) => (
         <VideoCard video={video} key={index} onUnsave={handleUnsave} />
          ))
        :
        [0,1,2,3,4,5].map((item,index)=>(
           <Skeleton key={index} className="w-full h-[240px]" />
        ))
        }
        </div>
    </div>
  )
}

export default MyVideos
