'use client'

import { useEffect, useState } from "react";
import { Menus } from "@/lib/utils";
import { DesktopMenu } from "./DesktopMenu";
import { authClient } from "@/lib/auth-client";
import { MobMenu } from "./MobileMenu";
import Image from "next/image";
import Link from "next/link";
import { LogOut, LogIn, Search, Clock, Mail, Phone } from "lucide-react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useRouter } from "next/navigation";

export default function Header() {
  const [userData, setUserData] = useState<
  {user:{
    id: string;
    createdAt: Date;
    updatedAt: Date;
    email: string;
    emailVerified: boolean;
    name: string;
    image?: string | null | undefined;
}}>()
  const router = useRouter()
  const isMobile = useMediaQuery("(max-width: 768px)")
  const isTablet = useMediaQuery("(max-width: 1024px)")

  useEffect(() => {
    const fetchUserData = async () => {
        const {data} =  authClient.useSession();
        if(data?.user){
          setUserData(data)
        }
    }
    fetchUserData()
  },[])

    const signOut = async () => {
      await authClient.signOut({
        fetchOptions: { onSuccess: () => router.push('/login') }
      })
    }

  return (
    <div>

      <header className="h-24 text-[15px] fixed inset-0 flex-center bg-background dark:bg-background-dark bg- z-20 shadow-lg flex-col">
                        <div className="bg-red-500 w-full h-8 flex flex-col sm:flex-row items-center px-2 text-white space-x-2 justify-center">
                          <p className="text-xs flex gap-1 items-center">
                            <Clock className="w-3 h-3"/>
                            Mon - Sun / 9 am - 9 pm
                          </p>
                          <div className="flex gap-3">
                          <p className="text-xs flex gap-1 items-center">
                            <Mail className="w-3 h-3"/>
                            info@swifdu.org
                          </p>
                          <p className="text-xs flex gap-1 items-center">
                            <Phone className="w-3 h-3"/>
                            09014116505
                          </p>
                          </div>

                  
                </div>
        <nav className="h-16 px-3.5 flex-center items-center justify-between w-full max-w-7xl mx-auto">
          <div className="flex-center gap-x-3 z-999 relative">
            <Link href="/">
            <Image src={"/logo.png"} alt="logo" width={342} height={63} className="object-contain w-28"/>
            </Link>
          </div>

          <ul className="gap-x-1 lg:flex-center hidden">
            {Menus.map((menu) => (
              <DesktopMenu key={menu.name} name={menu.name}/>
            ))}
          </ul>
          <div className="flex-center gap-x-3">
            {userData?.user ? 
            <button className="p-0" onClick={() => {signOut()}}><LogOut className="w-4 h-4"/></button>
            :
            <Link href="/auth/login"><LogIn className="w-4 h-4"/></Link>
            }
            {!isMobile && !isTablet &&<Link
              href="/search"
              aria-label="Search"
              className="bg-white/5 relative p-[.2rem] shadow rounded-full flex-center hidden lg:visible"
            >
              <Search/>
            </Link>}
            
            <div className="lg:hidden">
              <MobMenu />
            </div>
          </div>
        </nav>
      </header>
    </div>
  );
}