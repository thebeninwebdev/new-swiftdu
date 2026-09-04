"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const navLinks = [
  {
    label: "Home",
    href: "/",
  },
  {
    label: "About us",
    href: "/about-us",
  },
  {
    label: "Contact us",
    href: "/contact-us",
  },
];

export const Navbar = () => {
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
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

  // Close mobile nav when route changes
  useEffect(() => {
    const frame = requestAnimationFrame(() => setIsOpen(false));
    return () => cancelAnimationFrame(frame);
  }, [pathname]);

  // Prevent page scrolling while mobile menu is open
  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  return (
   <header
  className={`
    fixed inset-x-0 top-0 z-50
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
          onClick={() => setIsOpen(false)}
          className="
            group relative z-50 shrink-0
            transition-transform duration-500
            ease-[cubic-bezier(0.22,1,0.36,1)]
            hover:-translate-y-[1px]
          "
        >
          <Image
            src="/logo.png?v=20260826"
            alt="SwiftDU"
            width={342}
            height={63}
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
          onClick={() => setIsOpen((current) => !current)}
          aria-expanded={isOpen}
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

      {/* ========================================
          Mobile menu
      ========================================= */}
<div
  aria-hidden={!isOpen}
  inert={!isOpen ? true : undefined}
  className={`
    fixed inset-x-0 bottom-0 top-[84px]
    z-[999]
    bg-white
    lg:hidden

    transition-[opacity,transform] ease-out

    ${
      isOpen
        ? "translate-y-0 opacity-100 pointer-events-auto duration-300"
        : "translate-y-2 opacity-0 pointer-events-none duration-200"
    }
  `}
>
        <div
          className="
            mx-auto flex h-full max-w-7xl
            flex-col
            px-5 pb-8 pt-8
            sm:px-7
          "
        >
          {/* Mobile navigation links */}
          <div className="flex flex-col">
            {navLinks.map((link, index) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  style={{
                    transitionDelay: isOpen
                      ? `${100 + index * 70}ms`
                      : "0ms",
                  }}
                  className={`
                    group
                    flex items-center justify-between
                    border-b border-black/[0.08]
                    py-5

                    text-[clamp(2rem,8vw,3.2rem)]
                    font-medium
                    leading-none
                    tracking-[-0.045em]
                    text-[#171717]

                    transition-all duration-700
                    ease-[cubic-bezier(0.22,1,0.36,1)]

                    ${
                      isOpen
                        ? "translate-y-0 opacity-100"
                        : "translate-y-0 opacity-100"
                    }
                  `}
                >
                  <span>{link.label}</span>

                  <span
                    className={`
                      h-2.5 w-2.5 rounded-full
                      transition-all duration-500

                      ${
                        active
                          ? "scale-100 bg-indigo-600"
                          : "scale-0 bg-indigo-600 group-hover:scale-100"
                      }
                    `}
                  />
                </Link>
              );
            })}
          </div>

          {/* Bottom mobile actions */}
          <div
            className={`
              mt-auto
              transition-all delay-300 duration-700
              ease-[cubic-bezier(0.22,1,0.36,1)]

              ${
                isOpen
                  ? "translate-y-0 opacity-100"
                  : "translate-y-0 opacity-100"
              }
            `}
          >
            <div className="mb-4 flex items-center justify-between">
              <Link
                href="/auth"
                onClick={() => setIsOpen(false)}
                className="
                  text-[16px] font-medium
                  text-[#171717]
                  underline-offset-4
                  hover:underline
                "
              >
                Log in
              </Link>

              <Link
                href="/dry-cleaner-signup/signup"
                onClick={() => setIsOpen(false)}
                className="
                  text-sm text-black/45
                  transition-colors duration-300
                  hover:text-black
                "
              >
                Become a service partner
              </Link>
            </div>

            {/* Mobile CTA */}
            <Link
              href="/auth"
              onClick={() => setIsOpen(false)}
              className="
                group relative
                flex h-[60px] w-full
                items-center justify-center
                overflow-hidden
                rounded-full
                bg-[#151515]

                text-base font-medium
                text-white

                active:scale-[0.98]
              "
            >
              <span
                className="
                  absolute inset-0
                  translate-y-full
                  bg-indigo-600

                  transition-transform duration-500
                  ease-[cubic-bezier(0.22,1,0.36,1)]

                  group-hover:translate-y-0
                "
              />

              <span className="relative z-10">
                Get Started
              </span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
};
