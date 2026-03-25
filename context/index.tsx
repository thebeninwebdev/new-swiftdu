"use client"

import React, {createContext, useContext, useState} from 'react'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AppContext = createContext<any>(undefined)

export function AppWrapper({children}:{
    children: React.ReactNode
}){
    const [isOpen, setIsOpen] = useState(false)
    return(
        <AppContext.Provider value={{ isOpen, setIsOpen }}>{children}</AppContext.Provider>
    )
}

export function useAppContext(){
    return useContext(AppContext)  
}