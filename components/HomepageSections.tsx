"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type MotionValue, useReducedMotion, useScroll, useTransform } from "framer-motion";
import signupImage from "@/public/sign-up.jpg";
import supportImage from "@/public/support.jpeg";
import earnImage from "@/public/earn.jpeg";
import learnImage from "@/public/learn.jpeg";
import opportunityEarnImage from "@/public/opportunity-earn.jpg";
import opportunityLearnImage from "@/public/opportunity-learn.jpg";
import opportunityCommunityImage from "@/public/opportunity-community.jpg";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Banknote, Bell, BookOpen, BriefcaseBusiness, Check, ChevronLeft, ChevronRight, FileText,
  GraduationCap, Headphones, Heart, Lightbulb, MapPin, PackageCheck, Shield, ShoppingBag,
  ShieldCheck, TrendingUp, Trophy, Users, Wallet,
} from "lucide-react";

const stats = [
  { value: "2,500+", label: "Active students", icon: Users, tone: "bg-violet-100 text-violet-600" },
  { value: "25,000+", label: "Tasks completed", icon: PackageCheck, tone: "bg-emerald-100 text-emerald-600" },
  { value: "₦12M+", label: "Earned by students", icon: Banknote, tone: "bg-amber-100 text-amber-600" },
  { value: "1 Campus", label: "Western Delta University", icon: GraduationCap, tone: "bg-blue-100 text-blue-600" },
];

const pillars = [
  { label: "GET HELP", title: "Get support", description: "Need food, printing, shopping or something else on campus? Tell SwiftDU what you need and another student can help get it done.", cta: "Post a task", href: "/auth", icon: Heart, image: supportImage, alt: "Students supporting each other through SwiftDU", tone: "bg-[#f4f0ff]", iconTone: "bg-violet-100 text-violet-700" },
  { label: "EARN", title: "Earn as a Swifter", description: "Turn your free time into income by helping fellow students with everyday campus tasks.", cta: "Become a Swifter", href: "/tasker-signup", icon: Wallet, image: earnImage, alt: "Student earning through campus opportunities", tone: "bg-[#eef8ef]", iconTone: "bg-emerald-100 text-emerald-700" },
  { label: "GROW", title: "Learn & grow", description: "Build useful skills, gain practical experience, meet people and discover opportunities while you're still a student.", cta: "Explore opportunities", href: "/about", icon: GraduationCap, image: learnImage, alt: "Students learning and growing together", tone: "bg-[#eef5ff]", iconTone: "bg-sky-100 text-sky-700" },
];

const steps = [
  { title: "Post what you need", description: "Tell us what you need done, when you need it, and what you want to spend.", icon: BookOpen, color: "bg-violet-500" },
  { title: "Connect with a Swifter", description: "A verified fellow student accepts your request and gets to work.", icon: Users, color: "bg-emerald-500" },
  { title: "Get it done securely", description: "Track the task, confirm completion, and pay safely through SwiftDU.", icon: ShieldCheck, color: "bg-blue-500" },
];

// Retained as a reusable metric block, but intentionally not rendered on the homepage.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function StatsStrip() {
  return <section aria-label="SwiftDU community milestones" className="relative z-10 -mt-5 px-5 sm:-mt-8 sm:px-8 lg:px-10">
    <div className="mx-auto grid max-w-[1380px] grid-cols-1 overflow-hidden border border-slate-300 bg-white shadow-[0_18px_55px_rgba(30,22,70,0.12)] sm:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => <div key={stat.label} className="landing-scroll-reveal flex min-h-28 items-center gap-5 border-b border-r border-slate-200 p-6 last:border-r-0 sm:min-h-32 sm:p-8 lg:border-b-0" style={{ animationDelay: `${index * 80}ms` }}>
        <span className={`flex h-14 w-14 shrink-0 items-center justify-center ${stat.tone}`}><stat.icon className="h-7 w-7" aria-hidden="true" /></span>
        <div><p className="text-2xl font-extrabold tracking-tight text-slate-950 sm:text-3xl">{stat.value}</p><p className="mt-1 text-xs font-medium leading-5 text-slate-500 sm:text-sm">{stat.label}</p></div>
      </div>)}
    </div>
  </section>;
}

function CommunitySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start 85%", "end 35%"],
  });
  const text = "We're creating a community where students support one another, earn through flexible opportunities, learn useful skills and grow together.";
  const words = text.split(" ");

  return <section ref={sectionRef} className="bg-gradient-to-r from-sky-50 via-violet-50/80 to-emerald-50 py-24 sm:py-32 lg:py-52">
    <div className="mx-auto max-w-[1380px] px-5 sm:px-8 lg:px-10">
      <div className="mx-auto px-2 text-center sm:px-10 lg:px-20">
        <p className="mx-auto max-w-6xl text-3xl font-medium leading-[1.25] tracking-[-0.035em] text-slate-900 sm:text-4xl lg:text-5xl lg:leading-[1.18]">
          {words.map((word, index) => <CommunityWord key={`${word}-${index}`} progress={scrollYProgress} index={index} total={words.length}>{word}</CommunityWord>)}
        </p>
      </div>
    </div>
  </section>;
}

function CommunityWord({ children, progress, index, total }: { children: string; progress: MotionValue<number>; index: number; total: number }) {
  const reducedMotion = useReducedMotion();
  const start = (index / total) * 0.88;
  const end = Math.min(start + 0.12, 1);
  const opacity = useTransform(progress, [start, end], [0.12, 1]);

  return <motion.span className="mr-[0.22em] inline-block" style={{ opacity: reducedMotion ? 1 : opacity }}>{children}</motion.span>;
}

function PillarsSection() {
  const reducedMotion = useReducedMotion();
  const reveal = (delay = 0) => ({
    initial: reducedMotion ? false as const : { opacity: 0, y: 35 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.2 },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  });
  return <section id="features" className="bg-[#f8f7fb] py-24 sm:py-32 lg:py-36"><div className="mx-auto max-w-[1380px] px-5 sm:px-8 lg:px-10">
    <motion.div {...reveal()} className="grid gap-6 border-b border-slate-200/80 pb-10 sm:pb-12 lg:grid-cols-[1fr_0.72fr] lg:items-end lg:gap-16"><div><p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-600">There&apos;s a place for you here</p><h2 className="mt-4 text-4xl font-black leading-[1.02] tracking-[-0.055em] text-slate-950 sm:text-5xl lg:text-6xl">What can you do<br className="hidden lg:block" /> in SwiftDU?</h2></div><p className="max-w-xl text-base leading-8 text-slate-600 sm:text-lg lg:pb-1">Whether you need help, want to earn, or want to grow, there&apos;s a place for you in the SwiftDU community.</p></motion.div>
    <div className="mt-8 grid gap-5 lg:mt-10 lg:grid-cols-3 lg:gap-6">{pillars.map((pillar, index) => <motion.article key={pillar.title} {...reveal(0.1 + index * 0.09)} className={`group flex min-h-[470px] flex-col overflow-hidden rounded-[28px] ${pillar.tone} shadow-[0_18px_50px_rgba(30,22,70,0.07)] transition duration-500 hover:-translate-y-1 sm:min-h-[500px] lg:min-h-[540px]`}>
      <div className={`relative ${index === 1 ? "h-[280px] sm:h-[305px]" : "h-[245px] sm:h-[275px]"} shrink-0 overflow-hidden`}><Image src={pillar.image} alt={pillar.alt} fill sizes="(max-width: 1023px) 100vw, 33vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.035]" /><div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" /><span className="absolute left-5 top-5 flex h-9 min-w-9 items-center justify-center rounded-full bg-white/90 px-3 text-xs font-black text-slate-900 shadow-sm">0{index + 1}</span></div>
      <div className="flex flex-1 flex-col p-6 sm:p-7"><div className="flex items-center justify-between gap-4"><p className="text-xs font-black tracking-[0.16em] text-slate-500">{pillar.label}</p><span className={`flex h-9 w-9 items-center justify-center rounded-xl ${pillar.iconTone}`}><pillar.icon className="h-4 w-4" aria-hidden="true" /></span></div><h3 className="mt-5 text-2xl font-black tracking-[-0.04em] text-slate-950 xl:text-3xl">{pillar.title}</h3><p className="mt-3 text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">{pillar.description}</p><Link href={pillar.href} className="mt-auto inline-flex w-fit items-center gap-2 pt-7 text-sm font-bold text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2">{pillar.cta}<ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" /></Link></div>
    </motion.article>)}</div>
  </div></section>;
}
// Retained for reference while the redesigned section below is used.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyHowItWorks() {
  return <section id="how-it-works" className="relative overflow-hidden bg-[#0d1236] py-20 text-white sm:py-24"><div aria-hidden="true" className="absolute inset-0 opacity-15 [background-image:radial-gradient(circle_at_center,#8b5cf6_1px,transparent_1px)] [background-size:28px_28px]" /><div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
    <div className="mb-12 max-w-xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">How it works</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Every order supports<br />another student.</h2><p className="mt-4 text-sm leading-6 text-indigo-200">You get what you need done. A fellow student earns. Our community grows.</p></div>
    <div className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-5"><div aria-hidden="true" className="absolute left-[10%] right-[10%] top-7 hidden h-px bg-white/20 lg:block" />{steps.map((step, index) => <div key={step.title} className="landing-scroll-pop relative text-center"><span className={`relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-full ring-4 ring-[#0d1236] ${step.color}`}><step.icon className="h-5 w-5" aria-hidden="true" /></span><p className="mt-4 text-xs font-bold text-indigo-300">0{index + 1}</p><h3 className="mt-2 text-sm font-bold">{step.title}</h3><p className="mx-auto mt-2 max-w-36 text-xs leading-5 text-indigo-200">{step.description}</p></div>)}</div>
    <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/10 pt-6 text-xs text-indigo-200"><span className="font-bold uppercase tracking-wider text-white">Services include</span><span>Food</span><span>Printing</span><span>Shopping</span><span>Water</span><span>Notes</span><span>…and more</span></div>
  </div></section>;
}

function HowItWorks() {
  const reducedMotion = useReducedMotion();
  const carouselRef = useRef<HTMLDivElement>(null);
  const [activeHowStep, setActiveHowStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isVisible, setIsVisible] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);
  const howItWorksSteps = [
    { number: "01", title: "Tell us what you need", description: "Choose a service, add the details and tell us where it should go.", rows: [{ icon: ShoppingBag, title: "Pick a service", body: "Food, shopping, printing, water and more." }, { icon: FileText, title: "Add the details", body: "Tell us exactly what you need." }, { icon: MapPin, title: "Choose delivery", body: "Select where on campus it should go." }] },
    { number: "02", title: "A Swifter takes the task", description: "Available verified students can accept your request and get to work.", rows: [{ icon: Users, title: "We notify Swifters", body: "Available students can see the request." }, { icon: BadgeCheck, title: "Someone accepts", body: "A student takes responsibility for your task." }, { icon: Bell, title: "You stay informed", body: "SwiftDU updates you as the task moves." }] },
    { number: "03", title: "Follow it until it’s done", description: "Track the task, stay updated and confirm everything when it arrives.", rows: [{ icon: MapPin, title: "See the status", body: "Know what stage your request is in." }, { icon: Bell, title: "Stay updated", body: "Get important changes as they happen." }, { icon: PackageCheck, title: "Confirm completion", body: "Finish the task once everything is settled." }] },
  ];
  const activeStep = howItWorksSteps[activeHowStep];
  const goToStep = (next: number) => { setDirection(next > activeHowStep || (activeHowStep === 2 && next === 0) ? 1 : -1); setActiveHowStep((next + howItWorksSteps.length) % howItWorksSteps.length); };

  useEffect(() => {
    const node = carouselRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0.25 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const updateVisibility = () => setIsDocumentVisible(!document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => document.removeEventListener("visibilitychange", updateVisibility);
  }, []);
  useEffect(() => {
    if (reducedMotion || !isVisible || isPaused || !isDocumentVisible) return;
    const timer = window.setTimeout(() => goToStep(activeHowStep + 1), 5500);
    return () => window.clearTimeout(timer);
  }, [activeHowStep, isDocumentVisible, isPaused, isVisible, reducedMotion]);

  const visual = () => {
    if (activeHowStep === 0) return <div aria-hidden="true" className="relative h-full overflow-hidden rounded-[28px] bg-[#f5f2ff] p-5 sm:p-8"><div className="absolute -right-16 -top-20 h-64 w-64 rounded-full bg-violet-200/60 blur-3xl" /><div className="relative mx-auto max-w-[350px] rounded-[25px] border border-violet-100 bg-white p-4 shadow-[0_28px_60px_rgba(69,45,151,0.16)] sm:p-5"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-sm font-black text-white">S</span><span className="text-xs font-bold text-slate-400">SwiftDU</span></div><h3 className="mt-5 text-xl font-black tracking-tight text-slate-950">What do you need?</h3><div className="mt-4 grid grid-cols-2 gap-2">{[["Food", "bg-orange-100 text-orange-600"], ["Shopping", "bg-emerald-100 text-emerald-600"], ["Printing", "bg-sky-100 text-sky-600"], ["Water", "bg-violet-100 text-violet-600"]].map(([label, color]) => <div key={label} className="rounded-xl border border-slate-100 p-3"><span className={`flex h-7 w-7 items-center justify-center rounded-lg ${color}`}><ShoppingBag className="h-3.5 w-3.5" /></span><p className="mt-2 text-xs font-bold text-slate-700">{label}</p></div>)}</div><div className="mt-4 flex items-center gap-3 rounded-xl bg-violet-50 p-3"><MapPin className="h-4 w-4 text-violet-600" /><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Deliver to</p><p className="text-xs font-bold text-slate-800">Girls&apos; Hostel</p></div></div></div></div>;
    if (activeHowStep === 1) return <div aria-hidden="true" className="relative h-full overflow-hidden rounded-[28px] bg-[#f5f2ff] p-5 sm:p-8"><div className="absolute bottom-0 left-0 h-56 w-56 rounded-full bg-violet-200/70 blur-3xl" /><div className="relative mx-auto max-w-[390px] space-y-4 pt-5"><div className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_22px_50px_rgba(69,45,151,0.13)]"><div className="flex items-center justify-between"><span className="text-xs font-bold text-violet-600">TASK POSTED</span><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /></div><h3 className="mt-3 text-xl font-black text-slate-950">Restaurant</h3><div className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-500"><MapPin className="h-4 w-4 text-violet-500" />Girls&apos; Hostel</div><div className="mt-5 flex items-center gap-3 rounded-xl bg-violet-50 p-3"><span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-violet-200 border-t-violet-600" /><span className="text-sm font-bold text-violet-700">Finding a Swifter…</span></div></div><div className="ml-auto w-[82%] rounded-2xl bg-slate-950 p-4 text-white shadow-xl"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500"><BadgeCheck className="h-5 w-5" /></span><div><p className="text-sm font-bold">Swifter found</p><p className="text-xs text-slate-300">Task accepted</p></div></div></div></div></div>;
    return <div aria-hidden="true" className="relative h-full overflow-hidden rounded-[28px] bg-[#17151d] p-5 text-white sm:p-8"><div className="absolute -right-10 top-0 h-64 w-64 rounded-full bg-violet-700/30 blur-3xl" /><div className="relative mx-auto max-w-[390px] rounded-2xl border border-white/10 bg-white/[0.08] p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-300">Your task</p><h3 className="mt-1 text-xl font-black">Restaurant order</h3></div><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-300">Active</span></div><div className="mt-7 space-y-5">{[["Accepted", "Your Swifter is ready", true], ["On the way", "Heading to Girls’ Hostel", true], ["Delivered", "Confirm when it arrives", false]].map(([title, body, done], index) => <div key={title as string} className="relative flex gap-3"><span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${done ? "bg-violet-500" : "border border-white/30 bg-white/10"}`}>{done ? <Check className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-white/70" />}</span>{index < 2 ? <span className="absolute left-4 top-8 h-5 w-px bg-white/20" /> : null}<div><p className="text-sm font-bold">{title}</p><p className="text-xs text-slate-300">{body}</p></div></div>)}</div><div className="mt-6 rounded-xl bg-white p-3 text-center text-sm font-bold text-violet-700">Confirm received</div></div></div>;
  };

  return <section id="how-it-works" aria-label="How SwiftDU works" className="overflow-hidden bg-[#faf9ff] py-24 sm:py-32 lg:py-36"><div className="mx-auto max-w-[1380px] px-5 sm:px-8 lg:px-10"><div className="mx-auto max-w-2xl text-center"><p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-600">How SwiftDU works</p><h2 className="mt-4 text-4xl font-black tracking-[-0.055em] text-slate-950 sm:text-5xl lg:text-6xl">Get it done in <span className="text-violet-600">3.</span></h2><p className="mt-5 text-base leading-7 text-slate-500 sm:text-lg">Getting help on campus is simple. Tell us what you need, a verified Swifter takes the task, and you follow it until it&apos;s done.</p></div>
    <div ref={carouselRef} className="relative mt-12 sm:mt-16" onPointerEnter={() => setIsPaused(true)} onPointerLeave={() => setIsPaused(false)} onFocusCapture={() => setIsPaused(true)} onBlurCapture={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setIsPaused(false); }}><div className="mx-auto flex max-w-xs justify-center gap-3">{howItWorksSteps.map((item, index) => <button key={item.number} type="button" aria-label={`Show step ${index + 1}: ${item.title}`} aria-current={activeHowStep === index ? "step" : undefined} onClick={() => goToStep(index)} className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 ${activeHowStep === index ? "bg-violet-600 text-white shadow-lg shadow-violet-500/25" : "bg-violet-100 text-slate-700 hover:bg-violet-200"}`}>{item.number}</button>)}</div><div className="mx-auto mt-4 h-px max-w-xs overflow-hidden bg-violet-100"><motion.div key={`${activeHowStep}-${reducedMotion}`} initial={{ width: reducedMotion ? "100%" : "0%" }} animate={{ width: "100%" }} transition={{ duration: reducedMotion ? 0 : 5.5, ease: "linear" }} className="h-full bg-violet-600" /></div>
      <div className="mt-9 grid items-center gap-10 lg:grid-cols-[1.12fr_0.88fr] lg:gap-16"><button type="button" aria-label="Previous step" onClick={() => goToStep(activeHowStep - 1)} className="absolute left-0 top-[55%] z-20 hidden h-12 w-12 -translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:bg-violet-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 lg:flex"><ChevronLeft className="h-5 w-5" /></button><button type="button" aria-label="Next step" onClick={() => goToStep(activeHowStep + 1)} className="absolute right-0 top-[55%] z-20 hidden h-12 w-12 translate-x-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm transition hover:bg-violet-600 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 lg:flex"><ChevronRight className="h-5 w-5" /></button><AnimatePresence mode="wait" custom={direction}><motion.div key={`visual-${activeHowStep}`} custom={direction} initial={{ opacity: 0, x: direction * 25 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction * -25 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className="h-[360px] sm:h-[430px] lg:h-[550px]">{visual()}</motion.div></AnimatePresence><AnimatePresence mode="wait" custom={direction}><motion.div key={`copy-${activeHowStep}`} custom={direction} initial={{ opacity: 0, x: direction * 25 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction * -25 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className="lg:py-8"><p className="text-sm font-black tracking-[0.16em] text-violet-600">{activeStep.number}</p><h3 className="mt-3 text-3xl font-black tracking-[-0.045em] text-slate-950 sm:text-4xl">{activeStep.title}</h3><p className="mt-5 max-w-lg text-base leading-8 text-slate-600 sm:text-lg">{activeStep.description}</p><div className="mt-8 space-y-5">{activeStep.rows.map((row) => <div key={row.title} className="flex gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-600"><row.icon className="h-4 w-4" aria-hidden="true" /></span><div><h4 className="font-bold text-slate-950">{row.title}</h4><p className="mt-0.5 text-sm leading-6 text-slate-500">{row.body}</p></div></div>)}</div></motion.div></AnimatePresence></div><div className="mt-8 flex justify-center gap-3 lg:hidden"><button type="button" aria-label="Previous step" onClick={() => goToStep(activeHowStep - 1)} className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"><ChevronLeft className="h-5 w-5" /></button><button type="button" aria-label="Next step" onClick={() => goToStep(activeHowStep + 1)} className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"><ChevronRight className="h-5 w-5" /></button></div></div>
  </div></section>;
}
function OpportunitiesSection() {
  const reducedMotion = useReducedMotion();
  const reveal = (delay = 0) => ({ initial: reducedMotion ? false as const : { opacity: 0, y: 30 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.25 }, transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } });
  const arrow = "flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-slate-950 shadow-sm transition-transform duration-300 group-hover:translate-x-1";
  return <section className="overflow-hidden bg-[#fdfcff] py-24 sm:py-32 lg:py-36"><div className="mx-auto max-w-[1480px] px-5 sm:px-8 lg:px-10">
    <div className="grid gap-14 lg:grid-cols-[0.72fr_1.28fr] lg:gap-12 xl:gap-16">
      <motion.div {...reveal()} className="relative self-center lg:pb-12"><p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-600">Opportunities at SwiftDU</p><h2 className="mt-5 text-4xl font-bold leading-[1.02] tracking-[-0.055em] text-slate-950 sm:text-5xl lg:text-[4rem] xl:text-[4.5rem]">What you do <span className="lg:block">on campus can</span> <span className="lg:block">become</span> <span className="text-violet-600">something bigger.</span></h2><p className="mt-7 max-w-[28rem] text-base leading-8 text-slate-600 sm:text-lg">Earn from your free time. Build practical experience. Learn useful skills. Meet people and discover opportunities while you're still a student.</p><Link href="/auth" className="group mt-9 inline-flex h-14 items-center gap-3 rounded-2xl bg-violet-600 px-6 text-sm font-bold text-white shadow-[0_12px_28px_rgba(124,58,237,0.22)] transition duration-300 hover:-translate-y-0.5 hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2">Explore opportunities <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" /></Link><svg aria-hidden="true" className="absolute -bottom-5 left-44 hidden h-14 w-24 text-violet-300 sm:block lg:left-36" viewBox="0 0 96 56" fill="none"><path d="M4 36c14-22 30-28 46-15 10 8 21 9 39-7M75 9l14 5-6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg></motion.div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-12 lg:grid-rows-[minmax(250px,1fr)_minmax(250px,1fr)_200px]">
        <motion.div {...reveal(0.08)} className="md:row-span-2 lg:col-span-6"><Link href="/tasker-signup" className="group relative flex min-h-[440px] h-full overflow-hidden rounded-[28px] bg-slate-950 p-6 text-white shadow-sm transition duration-500 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-4 sm:min-h-[520px]"><Image src={opportunityEarnImage} alt="Student using SwiftDU opportunities on campus" fill sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 35vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.035]" /><div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/25 to-slate-950/5" /><span className="relative z-10 flex h-9 min-w-9 items-center justify-center rounded-full bg-white/15 px-3 text-xs font-bold backdrop-blur-sm">01</span><div className="relative z-10 mt-auto flex w-full items-end justify-between gap-4"><div className="max-w-sm"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-500/85 text-white"><Wallet className="h-5 w-5" aria-hidden="true" /></span><h3 className="mt-4 text-2xl font-bold tracking-[-0.03em]">Earn on campus</h3><p className="mt-2 max-w-xs text-sm leading-6 text-slate-200">Turn spare time into income by solving real problems for other students.</p></div><span className={arrow}><ArrowUpRight className="h-5 w-5" aria-hidden="true" /></span></div></Link></motion.div>
        <motion.div {...reveal(0.16)} className="lg:col-span-6"><article className="min-h-[310px] h-full overflow-hidden rounded-[28px] border border-violet-100 bg-gradient-to-br from-violet-50 to-purple-100/70 p-6 sm:p-7"><div className="flex items-start justify-between"><span className="rounded-full border border-violet-200 bg-white/70 px-3 py-1.5 text-xs font-bold text-violet-700">02</span><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-violet-600 shadow-sm"><BriefcaseBusiness className="h-5 w-5" aria-hidden="true" /></span></div><h3 className="mt-6 text-2xl font-bold tracking-[-0.035em] text-slate-950">Build real experience</h3><p className="mt-2 max-w-md text-sm leading-6 text-slate-600">Take responsibility, solve problems and build a track record you can talk about.</p><div className="mt-6 flex flex-wrap gap-2">{[{ label: "Real tasks", icon: PackageCheck }, { label: "Teamwork", icon: Users }, { label: "Problem solving", icon: Lightbulb }, { label: "Leadership", icon: Trophy }].map((item) => <span key={item.label} className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm"><item.icon className="h-3.5 w-3.5 text-violet-600" aria-hidden="true" />{item.label}</span>)}</div></article></motion.div>
        <motion.div {...reveal(0.24)} className="lg:col-span-6"><Link href="/about" className="group relative flex min-h-[300px] h-full overflow-hidden rounded-[28px] bg-slate-950 p-6 text-white transition duration-500 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-4"><Image src={opportunityLearnImage} alt="Students learning and working together" fill sizes="(max-width: 767px) 100vw, (max-width: 1023px) 50vw, 35vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.035]" /><div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/55 to-slate-950/10" /><div className="relative z-10 flex w-full flex-col"><span className="w-fit rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">03</span><div className="mt-auto flex items-end justify-between gap-4"><div className="max-w-[17rem]"><BookOpen className="h-5 w-5 text-violet-200" aria-hidden="true" /><h3 className="mt-3 text-xl font-bold tracking-[-0.03em]">Learn useful skills</h3><p className="mt-2 text-sm leading-6 text-slate-200">Access training, resources and opportunities designed around student growth.</p></div><span className={arrow}><ArrowUpRight className="h-5 w-5" aria-hidden="true" /></span></div></div></Link></motion.div>
        <motion.div {...reveal(0.32)} className="md:col-span-2 lg:col-span-12"><Link href="/about" className="group relative flex min-h-[280px] h-full overflow-hidden rounded-[28px] bg-indigo-950 p-6 text-white transition duration-500 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-4 sm:p-8 lg:min-h-0"><Image src={opportunityCommunityImage} alt="Students connecting and collaborating on campus" fill sizes="(max-width: 1023px) 100vw, 65vw" className="object-cover object-right transition-transform duration-500 group-hover:scale-[1.035]" /><div className="absolute inset-0 bg-gradient-to-r from-indigo-950 via-indigo-950/80 to-violet-950/10" /><div className="relative z-10 flex w-full items-end justify-between gap-5"><div className="max-w-md"><span className="rounded-full bg-white/15 px-3 py-1.5 text-xs font-bold">04</span><Users className="mt-4 h-5 w-5 text-violet-200" aria-hidden="true" /><h3 className="mt-2 text-2xl font-bold tracking-[-0.035em]">Meet people &amp; lead</h3><p className="mt-2 text-sm leading-6 text-indigo-100">Work with others, take initiative and grow your campus network.</p></div><span className={arrow}><ArrowUpRight className="h-5 w-5" aria-hidden="true" /></span></div></Link></motion.div>
      </div>
    </div>
    <motion.div {...reveal(0.15)} className="mt-12 grid border-t border-slate-200 pt-6 sm:grid-cols-3">{[{ label: "Real campus tasks", icon: PackageCheck }, { label: "Real responsibility", icon: ShieldCheck }, { label: "Real growth", icon: TrendingUp }].map((item) => <div key={item.label} className="flex items-center gap-3 py-3 text-sm font-semibold text-slate-600 sm:justify-center"><item.icon className="h-4 w-4 text-violet-600" aria-hidden="true" />{item.label}</div>)}</motion.div>
  </div></section>;
}
function TrustAndCTA() {
  const items = [{ label: "Verified Swifters", icon: BadgeCheck }, { label: "Secure payments", icon: Shield }, { label: "Order tracking", icon: PackageCheck }, { label: "Community standards", icon: Users }, { label: "Dedicated support", icon: Headphones }, { label: "Safe & reliable", icon: ShieldCheck }];
  return <section className="bg-white px-5 py-24 sm:px-8 sm:py-32 lg:px-10"><div className="mx-auto grid max-w-[1380px] overflow-hidden bg-[#0d1236] text-white lg:grid-cols-[1.05fr_0.95fr]">
    <div className="p-7 sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Built on trust</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.04em]">Your safety. Our priority.</h2><div className="mt-9 grid grid-cols-2 gap-6 sm:grid-cols-3">{items.map((item) => <div key={item.label} className="text-center"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-violet-300"><item.icon className="h-5 w-5" /></span><p className="mt-3 text-xs font-semibold text-indigo-100">{item.label}</p></div>)}</div></div>
    <div className="relative isolate overflow-hidden bg-gradient-to-br from-violet-700 to-purple-500 p-7 sm:p-10"><div aria-hidden="true" className="absolute -right-20 -top-20 -z-10 h-72 w-72 rounded-full bg-white/15 blur-2xl" /><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-100">Your place is here</p><h2 className="mt-3 max-w-md text-3xl font-bold tracking-[-0.04em]">Belong. Support. Earn. Learn. Grow.</h2><p className="mt-4 max-w-md text-sm leading-6 text-violet-100">Whether you need help getting things done or have time and skills to give, SwiftDU has a place for you.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link href="/auth" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-violet-700 transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Join the community <ArrowRight className="h-4 w-4" /></Link><Link href="/tasker-signup" className="inline-flex items-center justify-center rounded-full border border-white/40 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Become a Swifter</Link></div></div>
  </div></section>;
}

export default function HomepageSections() {
  return <><CommunitySection /><PillarsSection /><HowItWorks /><OpportunitiesSection /><TrustAndCTA /></>;
}
