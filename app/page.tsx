"use client"

import Link from 'next/link';
import {useEffect, useRef, useState} from "react"
import {
  Wallet,
  ArrowRight,
  ShoppingBag,
  UtensilsCrossed
} from 'lucide-react';
import HomepageSections from "@/components/HomepageSections";
import { motion } from "framer-motion";
// --- Components ---

type ServiceCard = {
  id: number;
  title: string;
  shortTitle: string;
  description: string;
  image: string;
  icon: typeof UtensilsCrossed;
  buttonText: string;
  link: string;
};

const services: ServiceCard[] = [
  {
    id: 0,
    title: "Support Someone",
    shortTitle: "Support",
    description: "Get things done easily - food, printing, shopping, and more.",
    image: "/support.png",
    icon: ShoppingBag,
    buttonText: "Post a task",
    link: "/signup",
  },
  {
    id: 1,
    title: "Earn on Campus",
    shortTitle: "Earn",
    description: "Turn your free time into income. Complete tasks and get paid securely.",
    image: "/earn.png",
    icon: Wallet,
    buttonText: "Become a Tasker",
    link: "/tasker-signup",
  },
  {
    id: 2,
    title: "Learn and grow",
    shortTitle: "Learn",
    description: "Access youth empowerment materials, training and opportunities through our partners.",
    image: "/learn.png",
    icon: ShoppingBag,
    buttonText: "Learn more",
    link: "/about"
  },
];

const headingLines = ["Campus.", "People.", "Community."];


function Hero() {
  const [activeCard, setActiveCard] = useState(0);
  const [desktopPaused, setDesktopPaused] = useState(false);
  const [mobileCard, setMobileCard] = useState(0);
  const [mobileCarouselVisible, setMobileCarouselVisible] = useState(false);
  const mobileCardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (desktopPaused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const interval = window.setInterval(() => {
      setActiveCard((current) => (current + 1) % services.length);
    }, 3200);

    return () => window.clearInterval(interval);
  }, [desktopPaused]);

  useEffect(() => {
    const carousel = mobileCardsRef.current;
    if (!carousel) return;

    const observer = new IntersectionObserver(
      ([entry]) => setMobileCarouselVisible(entry.isIntersecting),
      { threshold: 0.2 },
    );

    observer.observe(carousel);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!mobileCarouselVisible || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const interval = window.setInterval(() => {
      setMobileCard((current) => {
        const next = (current + 1) % services.length;
        const container = mobileCardsRef.current;
        const card = mobileCardsRef.current?.children.item(next) as HTMLElement | null;

        if (container && card) {
          container.scrollTo({
            left: card.offsetLeft - (container.clientWidth - card.clientWidth) / 2,
            behavior: "smooth",
          });
        }

        return next;
      });
    }, 3600);

    return () => window.clearInterval(interval);
  }, [mobileCarouselVisible]);

  return (
    <section
      className={`relative overflow-hidden bg-[#faf9f7]`}
    >
      {/* extremely subtle background decoration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-52 top-32 h-105 w-105 rounded-full bg-indigo-100/50 blur-[120px]"
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-20 h-[500px] w-[500px] rounded-full bg-purple-100/40 blur-[140px]"
      />

      <div className="relative mx-auto max-w-[1500px] px-5 pb-12 pt-28 sm:px-8 lg:px-10 lg:pb-16 lg:pt-36">
        <div className="grid items-center gap-12 lg:grid-cols-[0.8fr_1.35fr] xl:gap-16">
          {/* =========================================================
              LEFT
          ========================================================== */}

          <div className="relative z-10">
            {/* Big Skillex-style headline */}
            <h1 className="text-[clamp(3.8rem,7vw,7.4rem)] font-semibold leading-[0.84] tracking-[-0.075em] text-[#17151d]">
              {headingLines.map((line, index) => (
                <span
                  key={line}
                  className="block overflow-hidden pb-[0.11em]"
                >
                  <motion.span
                    className={`block ${headingLines[headingLines.length-1] == line ? "text-violet-600":""}`}
                    initial={{
                      y: "110%",
                      rotate: 2,
                    }}
                    animate={{
                      y: "0%",
                      rotate: 0,
                    }}
                    transition={{
                      duration: 0.95,
                      delay: 0.12 + index * 0.09,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    {line}
                  </motion.span>
                </span>
              ))}
            </h1>

            <motion.p
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                duration: 0.75,
                delay: 0.39,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="mt-6 max-w-[480px] text-base leading-7 text-[#68646f] sm:text-lg sm:leading-8"
            >
              SwiftDU connects students who need things done with students who get them done - from food and shopping to printing and everyday campus errands.
            </motion.p>

            {/* Skillex-inspired action/search bar */}
            <motion.div
              initial={{ y: 30, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{
                duration: 0.75,
                delay: 0.48,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="mt-8 flex max-w-[500px] flex-col gap-3 sm:flex-row"
            >
              <Link
                href="/signup"
                className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-full bg-gradient-to-br from-indigo-600 to-purple-600 px-7 text-sm font-semibold text-white shadow-lg shadow-indigo-600/20 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-indigo-600/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 sm:text-base"
              >
                Post a task
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
              <Link
                href="/tasker-signup"
                className="group inline-flex min-h-14 items-center justify-center gap-2 rounded-full border border-[#d8d4df] bg-white/70 px-7 text-sm font-semibold text-[#25222c] backdrop-blur-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-indigo-300 hover:bg-white hover:text-indigo-700 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600 focus-visible:ring-offset-2 sm:text-base"
              >
                Become a Tasker
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </Link>
            </motion.div>
          </div>

          {/* =========================================================
              DESKTOP INTERACTIVE CARDS
          ========================================================== */}

          <motion.div
            initial="hidden"
            animate="show"
            variants={{
              hidden: {},
              show: {
                transition: {
                  staggerChildren: 0.09,
                  delayChildren: 0.3,
                },
              },
            }}
            className="hidden h-[590px] min-w-0 gap-4 lg:flex"
            onMouseEnter={() => setDesktopPaused(true)}
            onMouseLeave={() => setDesktopPaused(false)}
            onFocusCapture={() => setDesktopPaused(true)}
            onBlurCapture={() => setDesktopPaused(false)}
          >
            {services.map((service, index) => {
              const active = activeCard === index;
              const Icon = service.icon;

              return (
                <motion.div
                  key={service.id}
                  variants={{
                    hidden: {
                      opacity: 0,
                      y: 70,
                      scale: 0.96,
                    },
                    show: {
                      opacity: 1,
                      y: 0,
                      scale: 1,
                    },
                  }}
                  transition={{
                    duration: 0.8,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                  onMouseEnter={() => setActiveCard(index)}
                  onFocus={() => setActiveCard(index)}
                  animate={{
                    flex: active ? 4.5 : 1,
                  }}
                  className="group relative min-w-[82px] cursor-pointer overflow-hidden rounded-[18px] bg-[#dedde2]"
                  style={{
                    willChange: "flex",
                  }}
                >
                  {/* Card photo */}
                  <motion.div
                    className="absolute inset-0 bg-cover bg-center"
                    style={{
                      backgroundImage: `url("${service.image}")`,
                    }}
                    animate={{
                      scale: active ? 1.02 : 1.12,
                    }}
                    transition={{
                      duration: 0.9,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  />

                  {/* dark gradient over photo */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/5 to-black/5" />

                  {/* subtle SwiftDU tint */}
                  <div
                    className={`absolute inset-0 bg-indigo-950 transition-opacity duration-500 ${
                      active ? "opacity-0" : "opacity-[0.10]"
                    }`}
                  />

                  {/* EXPANDED CONTENT */}
                  <motion.div
                    animate={{
                      opacity: active ? 1 : 0,
                      y: active ? 0 : 20,
                    }}
                    transition={{
                      duration: 0.3,
                      delay: active ? 0.12 : 0,
                    }}
                    className={`absolute inset-x-0 bottom-0 p-7 text-white ${
                      active
                        ? "pointer-events-auto"
                        : "pointer-events-none"
                    }`}
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/15 backdrop-blur-md">
                        <Icon className="h-5 w-5" />
                      </div>

                      <span className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/70">
                        SwiftDU
                      </span>
                    </div>

                    <h2 className="max-w-[300px] text-[clamp(2rem,3vw,3.4rem)] font-semibold leading-[0.95] tracking-[-0.055em]">
                      {service.title}
                    </h2>

                    <p className="mt-4 max-w-[330px] text-sm leading-6 text-white/75">
                      {service.description}
                    </p>

                    <Link
                      href={service.link}
                      className="mt-6 flex items-center gap-2 text-sm font-semibold"
                    >
                      {service.buttonText}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </motion.div>

                  {/* COLLAPSED VERTICAL LABEL */}
                  <motion.div
                    animate={{
                      opacity: active ? 0 : 1,
                    }}
                    transition={{ duration: 0.2 }}
                    className={`absolute inset-0 flex items-end justify-center pb-7 ${
                      active ? "pointer-events-none" : ""
                    }`}
                  >
                    <div
                      className="flex items-center gap-3 text-lg font-semibold text-white"
                      style={{
                        writingMode: "vertical-rl",
                        transform: "rotate(180deg)",
                      }}
                    >
                      {service.shortTitle}
                    </div>
                  </motion.div>
                </motion.div>
              );
            })}
          </motion.div>

          {/* =========================================================
              MOBILE CARDS
              Hover doesn't exist on phones, so they become touch cards.
          ========================================================== */}

          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.8,
              delay: 0.45,
              ease: [0.16, 1, 0.3, 1],
            }}
            ref={mobileCardsRef}
            className="flex snap-x gap-4 overflow-x-auto overscroll-x-contain pb-4 [overflow-anchor:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:hidden"
          >
            {services.map((service) => {
              const Icon = service.icon;

              return (
                <Link
                  key={service.id}
                  href="/signup"
                  className="relative h-[440px] min-w-[82vw] snap-center overflow-hidden rounded-[20px] bg-[#ddd]"
                >
                  <div
                    className="absolute inset-0 scale-[1.02] bg-cover bg-center"
                    style={{
                      backgroundImage: `url("${service.image}")`,
                    }}
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />

                  <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                    <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 backdrop-blur-md">
                      <Icon className="h-5 w-5" />
                    </div>

                    <h2 className="text-4xl font-semibold leading-none tracking-[-0.05em]">
                      {service.title}
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-white/75">
                      {service.description}
                    </p>

                    <div className="mt-5 flex items-center gap-2 text-sm font-semibold">
                      Post a task
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </motion.div>

          <div className="-mt-2 flex justify-center gap-2 lg:hidden" aria-label="Service card position">
            {services.map((service, index) => (
              <button
                key={service.id}
                type="button"
                aria-label={`Show ${service.title}`}
                aria-current={mobileCard === index ? "true" : undefined}
                onClick={() => {
                  setMobileCard(index);
                  const container = mobileCardsRef.current;
                  const card = mobileCardsRef.current?.children.item(index) as HTMLElement | null;
                  if (container && card) {
                    container.scrollTo({
                      left: card.offsetLeft - (container.clientWidth - card.clientWidth) / 2,
                      behavior: "smooth",
                    });
                  }
                }}
                className={`h-2 rounded-full transition-all duration-300 ${mobileCard === index ? "w-7 bg-indigo-600" : "w-2 bg-slate-300"}`}
              />
            ))}
          </div>
        </div>

        {/* =========================================================
            BOTTOM LINE — like the text beneath Skillex's cards
        ========================================================== */}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="mt-14 flex flex-col gap-4 border-t border-black/[0.07] pt-7 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-lg font-semibold tracking-[-0.025em] text-[#25222c]">
            One campus. One community. One people.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <main>
        <Hero />
        <HomepageSections />
      </main>
    </div>
  );
}
