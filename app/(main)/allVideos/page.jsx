"use client"
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import VideoCard from '../_components/VideoCard';
import { Skeleton } from "@/components/ui/skeleton"

function allVideos() {

     const [videoList, setVideoList] = useState([]);
    
      useEffect(() => {
        GetVideoList();
      });
    
      const GetVideoList = async () => {
        const result = await axios.get('/api/get-videos');
        console.log(result.data);
        setVideoList(result.data); 
      };


  return (
   <div>
      <h2 className='font-bold text-3xl mb-6 text-balck'>Explore All Videos</h2>
        <div className='grid mt-5 grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5'>
          {videoList.length>0?videoList?.map((video, index) => (
            <VideoCard video={video} key={index} />
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

export default allVideos




