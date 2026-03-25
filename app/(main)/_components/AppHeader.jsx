import { SidebarTrigger } from "@/components/ui/sidebar";
import React from 'react';
import Image from "next/image";

function AppHeader({hideSidebar=false}) {
  return (
    <div className="p-4 flex justify-between items-center shadow-sm">
     {!hideSidebar && <SidebarTrigger />}

       <span className="text-5xl font-bold bg-gradient-to-r from-purple-600 via-blue-400 to-pink-400 bg-clip-text text-transparent tracking-wide">
          MakeVideo AI
        </span>
    <Image
          src={'/Make_Video_logo.png'}
          alt='AI'
          width={50}
          height={25}
          className="mb-1"
          style={{ objectFit: 'contain', height: 'auto' }}
          priority
        />
    </div>
  );
}

export default AppHeader;


