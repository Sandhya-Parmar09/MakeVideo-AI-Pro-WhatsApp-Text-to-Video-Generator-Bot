"use client"
import React, { useEffect, useState } from 'react'

function WelcomeBanner() {

    const taglines = [
  "Transform your ideas into stunning videos instantly.",
  "Let AI bring your imagination to life, frame by frame.",
  "Create cinematic stories from simple text prompts.",
  "Experience next-gen video generation powered by AI.",
  "Unleash creativity—no editing skills required!"
];
  const [currentTagline, setCurrentTagline] = useState(0);
  
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTagline((prev) => (prev + 1) % taglines.length);
    }, 3000); // Change tagline every 3 seconds
    return () => clearInterval(interval);
  }, []);


  return (
    <div className="p-5 m-2 bg-gradient-to-br from-blue-600 via-indigo-600 to-pink-500 rounded-2xl">
      <h2 className="font-bold text-2xl text-white">
        Welcome to AI-powered Text-to-Video Generating Platform
      </h2>
      <p className="text-white">
  {taglines[currentTagline]}
      </p>
    </div>
  )
}

export default WelcomeBanner

