"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, House, Info, Mail } from "lucide-react";

const navLinks = [
  {
    label: "Home",
    href: "/",
    icon: House,
  },
  {
    label: "About us",
    href: "/about-us",
    icon: Info,
  },
  {
    label: "Contact us",
    href: "/contact-us",
    icon: Mail,
  },
];

export const Navbar = ({ isOpen, onToggle, onClose }: { isOpen: boolean; onToggle: () => void; onClose: () => void }) => {
  const pathname = usePathname();

  const [mounted, setMounted] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Navbar entrance animation
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setMounted(true);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  // Subtle navbar state after scrolling
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 12);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
   <header
  className={`
    sticky inset-x-0 top-0 z-50 -mb-[84px] lg:fixed lg:mb-0
    ${
      scrolled
        ? "bg-white/95 shadow-[0_1px_20px_rgba(0,0,0,0.04)] backdrop-blur-xl"
        : "bg-white"
    }
  `}
>
<nav
  className={`
    mx-auto flex h-[84px] max-w-[1440px]
    items-center justify-between
    px-5 sm:px-7 lg:px-10 xl:px-14

    transition-all duration-700
    ease-[cubic-bezier(0.22,1,0.36,1)]

    ${
      mounted
        ? "translate-y-0 opacity-100"
        : "-translate-y-5 opacity-0"
    }
  `}
>
        {/* ========================================
            Logo
        ========================================= */}
        <Link
          href="/"
          onClick={onClose}
          className="
            group relative z-50 shrink-0
            transition-transform duration-500
            ease-[cubic-bezier(0.22,1,0.36,1)]
            hover:-translate-y-[1px]
          "
        >
          <Image
            src="/logo.png?v=swiftdu-symbol-v1"
            alt="SwiftDU"
            width={512}
            height={512}
            priority
            className="
              h-9 w-auto object-contain
              transition-transform duration-500
              ease-[cubic-bezier(0.22,1,0.36,1)]
              group-hover:scale-[1.025]
              md:h-10
            "
          />
        </Link>

        {/* ========================================
            Desktop navigation
        ========================================= */}
        <div
          className="
            absolute left-1/2 hidden
            -translate-x-1/2
            items-center gap-9
            lg:flex xl:gap-11
          "
        >
          {navLinks.map((link) => {
            const active =
              link.href === "/"
                ? pathname === "/"
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className="
                  group relative
                  py-3
                  text-[15px] font-medium
                  tracking-[-0.01em]
                  text-[#171717]
                "
              >
                {/* Visible text */}
                <span
                  className="
                    relative z-10 inline-block
                    transition-all duration-300
                    ease-[cubic-bezier(0.22,1,0.36,1)]
                    group-hover:-translate-y-[1px]
                    group-hover:text-black
                  "
                >
                  {link.label}
                </span>

                {/* Skillex-style subtle line movement */}
                <span
                  className={`
                    absolute bottom-[7px] left-0
                    h-[1px] w-full
                    origin-left bg-[#171717]

                    transition-transform duration-500
                    ease-[cubic-bezier(0.22,1,0.36,1)]

                    ${
                      active
                        ? "scale-x-100"
                        : "scale-x-0 group-hover:scale-x-100"
                    }
                  `}
                />
              </Link>
            );
          })}
        </div>

        {/* ========================================
            Desktop actions
        ========================================= */}
        <div className="hidden items-center gap-7 lg:flex">
          {/* Login */}
          <Link
            href="/auth"
            className="
              group relative
              py-3
              text-[15px] font-medium
              tracking-[-0.01em]
              text-[#171717]
            "
          >
            <span
              className="
                relative z-10 inline-block
                transition-transform duration-300
                ease-[cubic-bezier(0.22,1,0.36,1)]
                group-hover:-translate-y-[1px]
              "
            >
              Log in
            </span>

            <span
              className="
                absolute bottom-[7px] left-0
                h-[1px] w-full
                origin-left scale-x-0
                bg-[#171717]

                transition-transform duration-500
                ease-[cubic-bezier(0.22,1,0.36,1)]

                group-hover:scale-x-100
              "
            />
          </Link>

          {/* ========================================
              Animated primary CTA

              Black -> SwiftDU blue
              Text moves out / new text moves in
          ========================================= */}
          <Link
            href="/auth"
            className="
              group relative
              isolate
              flex h-[48px]
              min-w-[132px]
              items-center justify-center
              overflow-hidden
              rounded-full
              bg-[#151515]
              px-7

              text-[15px] font-medium
              text-white

              transition-transform duration-500
              ease-[cubic-bezier(0.22,1,0.36,1)]

              hover:-translate-y-[2px]
              active:translate-y-0
            "
          >
            {/* Animated background */}
            <span
              className="
                absolute inset-0 -z-10
                translate-y-[105%]
                rounded-[inherit]
                bg-indigo-600

                transition-transform duration-[550ms]
                ease-[cubic-bezier(0.22,1,0.36,1)]

                group-hover:translate-y-0
              "
            />

            {/* Text window */}
            <span className="relative h-[21px] overflow-hidden">
              {/* Original */}
              <span
                className="
                  block
                  transition-transform duration-[500ms]
                  ease-[cubic-bezier(0.22,1,0.36,1)]

                  group-hover:-translate-y-full
                "
              >
                Get Started
              </span>

              {/* Incoming duplicate */}
              <span
                className="
                  absolute left-0 top-full
                  whitespace-nowrap

                  transition-transform duration-[500ms]
                  ease-[cubic-bezier(0.22,1,0.36,1)]

                  group-hover:-translate-y-full
                "
              >
                Get Started
              </span>
            </span>
          </Link>
        </div>

        {/* ========================================
            Animated mobile hamburger
        ========================================= */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          aria-controls="public-mobile-menu"
          aria-label={isOpen ? "Close navigation" : "Open navigation"}
          className="
            relative z-50
            flex h-11 w-11
            items-center justify-center
            rounded-full
            lg:hidden
          "
        >
          <span className="relative block h-5 w-6">
            {/* top line */}
            <span
              className={`
                absolute left-0 top-[5px]
                h-[1.5px] w-6
                rounded-full bg-[#171717]

                transition-all duration-500
                ease-[cubic-bezier(0.22,1,0.36,1)]

                ${
                  isOpen
                    ? "translate-y-[4.5px] rotate-45"
                    : "translate-y-0 rotate-0"
                }
              `}
            />

            {/* bottom line */}
            <span
              className={`
                absolute left-0 top-[14px]
                h-[1.5px] w-6
                rounded-full bg-[#171717]

                transition-all duration-500
                ease-[cubic-bezier(0.22,1,0.36,1)]

                ${
                  isOpen
                    ? "-translate-y-[4.5px] -rotate-45"
                    : "translate-y-0 rotate-0"
                }
              `}
            />
          </span>
        </button>
      </nav>

    </header>
  );
};

export function PublicMobileMenu({ onClose }: { onClose: () => void }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Mobile navigation" className="flex min-h-full flex-col px-4 pb-6 pt-7 text-slate-900 dark:text-white">
      <div className="mb-7 px-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-300">SwiftDU</p>
        <p className="mt-2 text-xl font-bold leading-tight tracking-tight">Where to?</p>
      </div>

      <div className="space-y-2">
        {navLinks.map((link) => {
          const active = link.href === "/" ? pathname === "/" : pathname.startsWith(link.href);
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-12 items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition-colors ${active ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" : "text-slate-700 hover:bg-white/70 dark:text-slate-200 dark:hover:bg-white/10"}`}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="min-w-0">{link.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-auto space-y-3 pt-8">
        <Link href="/auth" onClick={onClose} className="flex min-h-11 items-center justify-between rounded-xl px-3 text-sm font-semibold text-slate-700 hover:bg-white/70 dark:text-slate-200 dark:hover:bg-white/10">
          Log in <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link href="/auth" onClick={onClose} className="flex min-h-12 items-center justify-center rounded-2xl bg-slate-950 px-3 text-center text-sm font-bold text-white shadow-lg shadow-slate-950/15 hover:bg-indigo-700 dark:bg-indigo-600 dark:hover:bg-indigo-500">
          Get Started
        </Link>
        <Link href="/dry-cleaner-signup/signup" onClick={onClose} className="block px-3 py-2 text-center text-xs leading-5 text-slate-500 underline-offset-4 hover:underline dark:text-slate-400">
          Become a service partner
        </Link>
      </div>
    </nav>
  );
}
