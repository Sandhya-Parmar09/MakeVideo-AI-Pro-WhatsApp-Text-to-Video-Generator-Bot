import React from 'react';
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import AppSidebar  from "./_components/AppSidebar"
import AppHeader  from "./_components/AppHeader"
import { Toaster } from "@/components/ui/sonner"

function UserLayout({ children }) {
  return (
  
         <SidebarProvider>
            
            <AppSidebar />
        <div className="w-full">
        <AppHeader />
        <div className="p-5">
          {children}
          <Toaster />
        </div>
      </div>
   
      </SidebarProvider>
    
    
  );
}

export default UserLayout;