"use client"
import React, { useState } from 'react'
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Sparkle, Loader2Icon } from "lucide-react"
import axios from "axios"

export default function ReqForm() {
  const [loading, setLoading] = useState(false);
      const [formPrompt, setFormPrompt] = useState('');

  const onHandleInputChange = (value) => {
    setFormPrompt(value);
    console.log(formPrompt);
  };


  const onGenerate = async () => {
    console.log(formPrompt);
    
    try{
    setLoading(true);
    let result;
     if(formPrompt===""){
  result = await axios.post('/api/generate-video', {
     formPrompt:"Clown fish swimming in a coral reef, beautiful, 8k, perfect, award winning, national geographic" 
    });
        }
        else{
    result = await axios.post('/api/generate-video', {
     formPrompt:formPrompt 
    });
}
    setLoading(false);
    // console.log("Done")
    toast.success(result.data.message || "Video Created!");
  }
  catch (e){
    setLoading(false);
    console.log(e);
    toast.error('Video generation failed, Try Again!');
  }
  }


  return (
    <div className="w-full max-w-4xl mx-auto mt-8 flex flex-col gap-6">
        <h2 className="text-2xl font-bold bg-gradient-to-r text-black bg-clip-text  tracking-wide">Enter your Prompt here</h2>
      <Textarea placeholder="Type your video prompt here. (e.g. Clown fish swimming in a coral reef, beautiful, 8k, perfect, award winning, national geographic)"
        className="w-full border-0 rounded-xl p-4 shadow focus:ring-2 focus:ring-purple-400 bg-gradient-to-r from-purple-100 via-blue-100 to-pink-100 text-gray-800 
        text-base resize-none transition-all duration-300 placeholder:text-purple-500 placeholder:font-medium min-h-[150px] sm:min-h-[200px] md:min-h-[220px] lg:min-h-[250px]"

                  onChange={event => onHandleInputChange(event?.target.value)} />
        <Button className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 via-blue-500 to-pink-400 text-white font-semibold text-lg flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] transition-all duration-200"
         onClick={onGenerate} disabled={loading}>
                  {loading ? <Loader2Icon className="animate-spin" /> : <Sparkle />}
                   Generate Video
                </Button>
    </div>
  )
}
