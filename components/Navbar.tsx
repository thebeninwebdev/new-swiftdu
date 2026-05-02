"use client";

import { Menu, X } from "lucide-react";

import Image from "next/image";
import Link from "next/link";
import React from "react"


export const Navbar = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 md:py-2 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link href="/" className="shrink-0 cursor-pointer">
            <Image
              src="/logo.png"
              alt="Swiftdu"
              width={342}
              height={63}
              className="h-10 w-auto object-contain"
              priority
            />
          </Link>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className="text-gray-600 hover:text-indigo-600 font-medium transition-colors">Home</Link>
            <Link href="/about-us" className="text-gray-600 hover:text-indigo-600 font-medium transition-colors">About us</Link>
            <Link href="/contact-us" className="text-gray-600 hover:text-indigo-600 font-medium transition-colors">Contact us</Link>
            <Link 
              href="/login" 
              className="bg-gray-900 text-white px-8 py-2 rounded-full font-medium hover:bg-gray-800 transition-all transform hover:scale-105"
            >
              Log in
            </Link>
            <Link 
              href="/signup" 
              className="bg-gray-900 text-white px-5 py-2 rounded-full font-medium hover:bg-gray-800 transition-all transform hover:scale-105"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button onClick={() => setIsOpen(!isOpen)} className="text-gray-600 hover:text-gray-900">
              {isOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden overflow-hidden bg-white border-b border-gray-100 transition-[max-height,opacity] duration-200 ease-out ${
          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="px-4 pt-2 pb-6 space-y-2">
          <Link href="/" className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md">Home</Link>
          <Link href="/about-us" className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md">About us</Link>
          <Link href="/contact-us" className="block px-3 py-2 text-base font-medium text-gray-700 hover:bg-gray-50 rounded-md">Contact us</Link>
          <Link 
            href="/login" 
            className="block w-full mt-4 text-indigo-600 border-2 border-indigo-600 px-5 py-3 rounded-lg font-medium text-center"
          >
            Log in
          </Link>
          <Link 
            href="/signup" 
            className="block w-full mt-4 bg-indigo-600 text-white px-5 py-3 rounded-lg font-medium text-center"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
};
