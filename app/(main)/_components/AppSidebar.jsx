"use client"
import React from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Video, Home, Play } from "lucide-react"
import {
  Sidebar, 
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar"
import { usePathname } from "next/navigation";


const SideBarOptions = [
  {
    title: "Home",
    path: "/dashboard",
    icon: Home,
  },
  {
    title: "My Collection",
    path: "/myVideos",
  icon: Video,
  },
  {
    title: "Explore Videos",
    path: "/allVideos",
  icon: Play,
  },
]

export default function AppSidebar() {
  const path = usePathname();
  return (
   <Sidebar>
      <SidebarHeader>
        <div className="flex flex-col justify-center items-center py-3">
          <Image
            src={'/Make_Video_logo.png'}
            alt='CrackVideo AI Logo'
            width={100}
            height={50}
            className="mb-1"
            style={{ objectFit: 'contain', height: 'auto' }}
            priority
          />
          <span className="text-lg font-bold bg-gradient-to-r from-purple-600 via-blue-400 to-pink-400 bg-clip-text text-transparent tracking-wide">
            MakeVideo AI
          </span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {SideBarOptions.map((item, index) => (
                <SidebarMenuItem key={index}>
                  <SidebarMenuButton asChild className="p-5">
                    <Link
                      href={item.path}
                      className={`text-[17px] flex items-center gap-3 ${
     path.startsWith(item.path) && 'text-purple-800 bg-purple-200'
  }`}
                    >
                      <item.icon className="h-7 w-7" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  )
}