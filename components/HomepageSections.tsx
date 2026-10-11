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
import wduBlogLogo from "@/public/partners/wdu-blog.jpeg";
import yaliEdoLogo from "@/public/partners/yali-edo.jpg";
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
  return <section id="features" className="overflow-x-clip bg-[#f8f7fb] pt-24 pb-14 sm:pt-28 sm:pb-16 lg:pt-32 lg:pb-20"><div className="mx-auto max-w-[1380px] px-5 sm:px-8 lg:px-10">
    <div className="grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-16 xl:gap-20">
      <motion.div {...reveal()} className="lg:sticky lg:top-[20vh] lg:h-fit lg:self-start">
        <div className="border-b border-slate-200/80 pb-10 sm:pb-12 lg:border-b-0 lg:pb-0"><p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-600">There&apos;s a place for you here</p><h2 className="mt-4 text-4xl font-black leading-[1.02] tracking-[-0.055em] text-slate-950 sm:text-5xl lg:text-6xl">What can you do<br className="hidden lg:block" /> in SwiftDU?</h2><p className="mt-6 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">Whether you need help, want to earn, or want to grow, there&apos;s a place for you in the SwiftDU community.</p></div>
      </motion.div>
      <div className="space-y-0 pb-[10svh] sm:pb-[12svh] lg:pb-[14vh]">{pillars.map((pillar, index) => <article key={pillar.title} style={{ zIndex: index + 10 }} className={`group sticky min-h-[500px] overflow-hidden rounded-[32px] border border-slate-200/70 bg-slate-100 shadow-[0_18px_50px_rgba(30,22,70,0.07)] transition-[border-color,box-shadow] duration-500 hover:border-violet-200 hover:shadow-[0_22px_55px_rgba(30,22,70,0.12)] sm:min-h-[580px] lg:min-h-[620px] lg:max-h-[680px] ${index < pillars.length - 1 ? "mb-[28svh] sm:mb-[32svh] lg:mb-[34vh]" : "mb-0"} ${index === 0 ? "top-20 sm:top-24 lg:top-28" : index === 1 ? "top-[5.5rem] sm:top-28 lg:top-32" : "top-24 sm:top-32 lg:top-36"}`}>
        <Image src={pillar.image} alt={pillar.alt} fill sizes="(max-width: 1023px) 100vw, 56vw" className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.015]" />
        <div aria-hidden="true" className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-slate-950/25 via-slate-950/5 to-transparent" />
        <span className="absolute left-5 top-5 flex h-9 min-w-9 items-center justify-center rounded-full border border-white/70 bg-white/90 px-3 text-xs font-black text-slate-900 shadow-sm backdrop-blur-sm">0{index + 1}</span>
        <div className="absolute inset-x-4 bottom-4 rounded-[24px] border border-white/80 bg-white/[0.94] p-5 shadow-[0_10px_30px_rgba(30,22,70,0.12)] backdrop-blur-[8px] sm:inset-x-5 sm:bottom-5 sm:p-6 lg:p-7">
          <div className="flex items-center gap-3"><span className={`flex h-8 w-8 items-center justify-center rounded-lg ${pillar.iconTone}`}><pillar.icon className="h-4 w-4" aria-hidden="true" /></span><p className="rounded-full bg-slate-950/[0.05] px-3 py-1 text-[11px] font-black tracking-[0.14em] text-slate-600">{pillar.label}</p></div>
          <h3 className="mt-4 text-xl font-black tracking-[-0.04em] text-slate-950 sm:text-2xl">{pillar.title}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">{pillar.description}</p>
          <Link href={pillar.href} className="mt-5 inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white/70 px-4 py-2.5 text-sm font-bold text-slate-950 transition duration-300 hover:border-violet-300 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2">{pillar.cta}<ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" /></Link>
        </div>
      </article>)}</div>
    </div>
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

// Kept temporarily as a reference for the existing SwiftDU mockup content.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyHowItWorksCarousel() {
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
const howItWorksStackSteps = [
  { number: "01", title: "Tell us what you need", description: "Choose a service, add the details and tell us where it should go." },
  { number: "02", title: "A Swifter takes the task", description: "Available verified students can accept your request and get to work." },
  { number: "03", title: "Follow it until it’s done", description: "Track the task, stay updated and confirm everything when it arrives." },
] as const;

function HowItWorksStackVisual({ step }: { step: number }) {
  if (step === 0) return <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-[#f4f0ff]"><div className="absolute -right-16 -top-24 h-72 w-72 rounded-full bg-violet-200/70 blur-3xl" /><div className="absolute left-1/2 top-[10%] w-[58%] min-w-[275px] max-w-[390px] -translate-x-1/2 rounded-[22px] border border-violet-100 bg-white p-4 shadow-[0_28px_60px_rgba(69,45,151,0.16)] sm:p-5"><div className="flex items-center justify-between"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-600 text-sm font-black text-white">S</span><span className="text-xs font-bold text-slate-400">SwiftDU</span></div><h3 className="mt-4 text-xl font-black tracking-tight text-slate-950">What do you need?</h3><div className="mt-3 grid grid-cols-2 gap-2">{[["Food", "bg-orange-100 text-orange-600"], ["Shopping", "bg-emerald-100 text-emerald-600"], ["Printing", "bg-sky-100 text-sky-600"], ["Water", "bg-violet-100 text-violet-600"]].map(([label, color]) => <div key={label} className="rounded-xl border border-slate-100 p-2.5 sm:p-3"><span className={`flex h-7 w-7 items-center justify-center rounded-lg ${color}`}><ShoppingBag className="h-3.5 w-3.5" /></span><p className="mt-1.5 text-xs font-bold text-slate-700">{label}</p></div>)}</div><div className="mt-3 flex items-center gap-3 rounded-xl bg-violet-50 p-2.5"><MapPin className="h-4 w-4 text-violet-600" /><div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Deliver to</p><p className="text-xs font-bold text-slate-800">Girls&apos; Hostel</p></div></div></div></div>;
  if (step === 1) return <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-[#f7f3ff]"><div className="absolute -bottom-24 -left-12 h-64 w-64 rounded-full bg-violet-200/70 blur-3xl" /><div className="absolute left-1/2 top-[12%] w-[57%] min-w-[280px] max-w-[410px] -translate-x-1/2 rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_22px_50px_rgba(69,45,151,0.13)] sm:p-5"><div className="flex items-center justify-between"><span className="text-xs font-bold text-violet-600">TASK POSTED</span><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /></div><h3 className="mt-3 text-xl font-black text-slate-950">Restaurant</h3><div className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-500"><MapPin className="h-4 w-4 text-violet-500" />Girls&apos; Hostel</div><div className="mt-4 flex items-center gap-3 rounded-xl bg-violet-50 p-3"><span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-violet-200 border-t-violet-600" /><span className="text-sm font-bold text-violet-700">Finding a Swifter…</span></div></div><div className="absolute right-[15%] top-[54%] w-[40%] min-w-[205px] rounded-2xl bg-slate-950 p-4 text-white shadow-xl"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500"><BadgeCheck className="h-5 w-5" /></span><div><p className="text-sm font-bold">Swifter found</p><p className="text-xs text-slate-300">Task accepted</p></div></div></div></div>;
  return <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-[#17151d] text-white"><div className="absolute -right-10 top-0 h-64 w-64 rounded-full bg-violet-700/30 blur-3xl" /><div className="absolute left-1/2 top-[11%] w-[58%] min-w-[285px] max-w-[410px] -translate-x-1/2 rounded-2xl border border-white/10 bg-white/[0.08] p-4 shadow-2xl backdrop-blur-sm sm:p-5"><div className="flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-wider text-violet-300">Your task</p><h3 className="mt-1 text-xl font-black">Restaurant order</h3></div><span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-300">Active</span></div><div className="mt-5 space-y-3.5">{[["Accepted", "Your Swifter is ready", true], ["On the way", "Heading to Girls' Hostel", true], ["Delivered", "Confirm when it arrives", false]].map(([title, body, done], index) => <div key={title as string} className="relative flex gap-3"><span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${done ? "bg-violet-500" : "border border-white/30 bg-white/10"}`}>{done ? <Check className="h-3.5 w-3.5" /> : <span className="h-2 w-2 rounded-full bg-white/70" />}</span>{index < 2 ? <span className="absolute left-3.5 top-7 h-4 w-px bg-white/20" /> : null}<div><p className="text-sm font-bold">{title}</p><p className="text-xs text-slate-300">{body}</p></div></div>)}</div><div className="mt-5 rounded-xl bg-white p-2.5 text-center text-sm font-bold text-violet-700">Confirm received</div></div></div>;
}

function HowItWorks() {
  const reducedMotion = useReducedMotion();
  return <section id="how-it-works" aria-label="How SwiftDU works" className="overflow-x-clip bg-[#faf9ff] pt-24 pb-14 sm:pt-28 sm:pb-16 lg:pt-32 lg:pb-20"><div className="mx-auto max-w-[1380px] px-5 sm:px-8 lg:px-10"><motion.div initial={reducedMotion ? false : { opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }} className="mx-auto max-w-2xl text-center"><p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-600">How SwiftDU works</p><h2 className="mt-4 text-4xl font-black tracking-[-0.055em] text-slate-950 sm:text-5xl lg:text-6xl">Get it done in <span className="text-violet-600">3.</span></h2><p className="mt-5 text-base leading-7 text-slate-500 sm:text-lg">Getting help on campus is simple. Tell us what you need, a verified Swifter takes the task, and you follow it until it&apos;s done.</p></motion.div><div className="mx-auto mt-12 max-w-[880px] space-y-0 pb-[10svh] sm:mt-16 sm:pb-[12svh] lg:pb-[14vh]">{howItWorksStackSteps.map((step, index) => <article key={step.number} style={{ zIndex: (index + 1) * 10 }} className={`relative sticky aspect-[4/3] overflow-hidden rounded-[24px] border border-black/[0.06] shadow-[0_18px_45px_rgba(30,22,70,0.10)] sm:aspect-[1.7/1] lg:aspect-[1.82/1] lg:max-h-[480px] lg:min-h-[410px] ${index < howItWorksStackSteps.length - 1 ? "mb-[26svh] sm:mb-[30svh] lg:mb-[34vh]" : "mb-0"} ${index === 0 ? "top-20 -rotate-[1.25deg] sm:top-24 lg:top-28" : index === 1 ? "top-[5.5rem] rotate-[1deg] sm:top-28 lg:top-[8.5rem]" : "top-24 -rotate-[0.75deg] sm:top-32 lg:top-36"}`}><HowItWorksStackVisual step={index} /><span className={`absolute left-5 top-5 z-10 text-xs font-black tracking-[0.16em] ${index === 2 ? "text-white/75" : "text-slate-500"}`}>{step.number}</span><div className={`absolute inset-x-0 bottom-0 z-10 px-5 pb-5 pt-16 text-center sm:px-10 sm:pb-8 ${index === 2 ? "bg-gradient-to-t from-[#17151d] via-[#17151d]/80 to-transparent text-white" : "bg-gradient-to-t from-white via-white/85 to-transparent text-slate-950"}`}><h3 className="text-2xl font-black tracking-[-0.045em] sm:text-3xl">{step.title}</h3><p className={`mx-auto mt-2 max-w-xl text-sm leading-6 sm:text-base ${index === 2 ? "text-slate-300" : "text-slate-600"}`}>{step.description}</p></div></article>)}</div></div></section>;
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

const partners = [
  {
    number: "01",
    name: "Western Delta Blog",
    category: "Media & Community",
    description: "Amplifying student stories, opportunities and innovations across the Western Delta community.",
    logo: wduBlogLogo,
    logoAlt: "Western Delta Blog logo",
    href: "https://www.instagram.com/westerndeltablog_/",
    annotation: <>Stronger voices<br />for student communities.</>,
    floatClass: "partner-float-one",
    rotationClass: "-rotate-[2.5deg]",
  },
  {
    number: "02",
    name: "YALI Network Edo",
    category: "Youth Leadership & Community",
    description: "Empowering young people with leadership skills, opportunities and stronger communities in Edo State.",
    logo: yaliEdoLogo,
    logoAlt: "YALI Network Edo logo",
    href: "https://www.instagram.com/yali_networkedo/",
    annotation: <>Empowering<br />the next generation.</>,
    floatClass: "partner-float-two",
    rotationClass: "rotate-[2.5deg]",
  },
] as const;

function PartnerCard({ partner }: { partner: typeof partners[number] }) {
  return <div className={partner.rotationClass}>
    <div className={partner.floatClass}>
      <a href={partner.href} target="_blank" rel="noreferrer" aria-label={`Visit ${partner.name} on Instagram`} className="group block rounded-[30px] border border-violet-100/90 bg-white p-5 shadow-[0_22px_55px_rgba(49,35,92,0.10)] transition-[box-shadow,transform] duration-500 hover:scale-[1.015] hover:shadow-[0_30px_68px_rgba(49,35,92,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-4 sm:rounded-[34px] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <span className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-black tracking-[0.12em] text-violet-700">{partner.number}</span>
          <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-full border border-violet-100 bg-violet-50 text-violet-700 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"><ArrowUpRight className="h-5 w-5" /></span>
        </div>
        <div className="mt-7 flex min-h-28 items-center justify-center rounded-[22px] bg-[#faf9ff] px-5 py-4 sm:min-h-32">
          <Image src={partner.logo} alt={partner.logoAlt} width={300} height={150} sizes="(max-width: 640px) 58vw, 280px" className="max-h-24 w-auto max-w-full object-contain sm:max-h-28" />
        </div>
        <h3 className="mt-7 text-2xl font-black tracking-[-0.045em] text-slate-950 sm:text-[1.75rem]">{partner.name}</h3>
        <p className="mt-2 text-xs font-black uppercase tracking-[0.12em] text-violet-600">{partner.category}</p>
        <div className="mt-5 h-px bg-violet-100" />
        <p className="mt-5 max-w-md text-sm leading-6 text-slate-600 sm:text-[0.95rem] sm:leading-7">{partner.description}</p>
      </a>
    </div>
  </div>;
}

function PartnersSection() {
  const reducedMotion = useReducedMotion();
  const reveal = (delay = 0) => ({ initial: reducedMotion ? false as const : { opacity: 0, y: 34 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, amount: 0.18 }, transition: { duration: 0.75, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } });
  return <section id="partners" aria-labelledby="partners-heading" className="relative isolate overflow-hidden bg-[#fcfbf8] py-24 sm:py-28 lg:py-40">
    <div aria-hidden="true" className="pointer-events-none absolute -left-12 top-5 select-none text-[clamp(8rem,16vw,18.75rem)] font-black uppercase leading-none tracking-[-0.09em] text-violet-950/[0.045]">Partners</div>
    <div aria-hidden="true" className="pointer-events-none absolute right-[8%] top-[20%] h-72 w-72 rounded-full bg-violet-200/35 blur-3xl" />
    <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-[13%] h-64 w-64 rotate-[-18deg] rounded-[4rem] bg-purple-100/65" />
    <svg aria-hidden="true" className="pointer-events-none absolute right-[4%] top-[30%] hidden h-56 w-[31rem] text-violet-300/70 lg:block" viewBox="0 0 496 224" fill="none"><path d="M8 170C106 194 119 33 240 82c97 39 92 140 242 92" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /><circle cx="8" cy="170" r="4" fill="currentColor" /><circle cx="482" cy="174" r="4" fill="currentColor" /></svg>
    <div className="relative mx-auto max-w-[1440px] px-5 sm:px-8 lg:px-10">
      <div className="grid items-center gap-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12 xl:gap-16">
        <motion.div {...reveal()} className="relative z-10 max-w-[620px]">
          <p className="text-sm font-black uppercase tracking-[0.18em] text-violet-600">Partners</p>
          <h2 id="partners-heading" className="mt-5 max-w-[620px] text-[clamp(2.8rem,5vw,6rem)] font-black leading-[0.88] tracking-[-0.075em] text-slate-950">Built with people who believe in <span className="text-violet-600">the mission.</span></h2>
          <p className="mt-7 max-w-[520px] text-base leading-8 text-slate-600 sm:text-lg">We work with trusted communities and organizations helping SwiftDU grow beyond errands.</p>
          <Link href="/contact-us" className="group mt-9 inline-flex h-14 items-center gap-3 rounded-2xl bg-violet-600 px-6 text-sm font-bold text-white shadow-[0_12px_28px_rgba(124,58,237,0.22)] transition duration-300 hover:-translate-y-0.5 hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2">Partner with SwiftDU <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" /></Link>
        </motion.div>
        <div className="relative mx-auto w-full max-w-[700px] pb-7 pt-5 lg:min-h-[720px] lg:pt-0 xl:min-h-[760px]">
          <p aria-hidden="true" className="pointer-events-none absolute left-[3%] top-0 z-0 hidden rotate-[-7deg] font-serif text-lg italic leading-5 text-violet-500/80 lg:block">{partners[0].annotation}</p>
          <motion.div {...reveal(0.14)} className="relative z-10 hover:z-30 w-[92%] sm:w-[88%] lg:absolute lg:left-0 lg:top-10 lg:w-[72%]"><PartnerCard partner={partners[0]} /></motion.div>
          <p aria-hidden="true" className="pointer-events-none absolute right-[3%] top-[35%] z-0 hidden rotate-[6deg] font-serif text-lg italic leading-5 text-violet-500/80 lg:block">{partners[1].annotation}</p>
          <motion.div {...reveal(0.26)} className="relative z-20 hover:z-30 ml-auto mt-9 w-[92%] sm:w-[88%] lg:absolute lg:right-0 lg:top-[42%] lg:mt-0 lg:w-[72%]"><PartnerCard partner={partners[1]} /></motion.div>
        </div>
      </div>
      <motion.div {...reveal(0.12)} className="mt-14 flex items-center gap-4 border-t border-violet-100 pt-7 sm:mt-20"><span aria-hidden="true" className="flex -space-x-1.5"><i className="h-3.5 w-3.5 rounded-full bg-violet-300" /><i className="h-3.5 w-3.5 rounded-full bg-violet-500" /><i className="h-3.5 w-3.5 rounded-full bg-purple-700" /></span><p className="text-lg font-bold tracking-[-0.03em] text-slate-800 sm:text-xl">Stronger communities.<br className="sm:hidden" /> More opportunities.</p></motion.div>
    </div>
  </section>;
}

const faqs = [
  { number: "01", question: "What exactly is SwiftDU?", answer: "SwiftDU is a student-powered campus service that connects students who need something done with verified students who can help. You can request everyday campus errands while another student earns by completing the task." },
  { number: "02", question: "What can I use SwiftDU for?", answer: "You can use SwiftDU for everyday campus needs such as getting food, shopping, printing, water, notes and other supported errands around campus." },
  { number: "03", question: "Who actually completes my task?", answer: "Tasks are completed by registered SwiftDU Swifters — fellow students who have gone through our onboarding process and are available to help with campus requests." },
  { number: "04", question: "How much does it cost?", answer: "The fee depends on the type of request, distance and complexity. You will see the applicable cost before completing your request, so you know what you are paying for." },
  { number: "05", question: "How do I know what is happening with my task?", answer: "SwiftDU keeps you updated as your request moves through each stage — from finding a Swifter, to acceptance, progress and delivery." },
  { number: "06", question: "What happens if something goes wrong?", answer: "If there is a problem with an order, delivery or payment, SwiftDU provides a support and review process so the issue can be investigated and resolved." },
  { number: "07", question: "Can I earn with SwiftDU too?", answer: "Yes. Students can apply to become Swifters and earn by helping other students with tasks when they are available. There is no fixed work schedule — you choose when you are available." },
  { number: "08", question: "Where is SwiftDU currently available?", answer: "SwiftDU is currently focused on the Western Delta University community, with the service designed around everyday student life on campus." },
] as const;

function FAQItem({ item, index, isOpen, onToggle, reducedMotion }: { item: typeof faqs[number]; index: number; isOpen: boolean; onToggle: () => void; reducedMotion: boolean | null }) {
  const panelId = `faq-panel-${index}`;
  return <motion.div layout transition={{ duration: reducedMotion ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }} className="group relative border-b border-slate-300/70"><button id={`faq-trigger-${index}`} type="button" aria-expanded={isOpen} aria-controls={panelId} onClick={onToggle} className="grid w-full grid-cols-[32px_1fr_28px] items-center gap-3 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-inset sm:grid-cols-[52px_1fr_32px] sm:gap-4 sm:py-7 lg:py-9"><span className={`text-xs font-semibold tracking-[0.12em] transition-colors duration-300 ${isOpen ? "text-violet-600" : "text-slate-400 group-hover:text-violet-600"}`}>{item.number}</span><span className={`text-lg font-semibold leading-[1.2] tracking-[-0.03em] transition-transform duration-300 sm:text-2xl xl:text-[2rem] ${isOpen ? "text-slate-950" : "text-slate-700 group-hover:translate-x-1.5 group-hover:text-slate-950"}`}>{item.question}</span><motion.span animate={{ rotate: isOpen ? 45 : 0, scale: isOpen ? 1 : 0.94 }} transition={{ duration: reducedMotion ? 0 : 0.35, ease: [0.16, 1, 0.3, 1] }} className="justify-self-end text-2xl font-light leading-none text-violet-600 sm:text-3xl">+</motion.span></button><AnimatePresence initial={false}>{isOpen && <motion.div id={panelId} role="region" aria-labelledby={`faq-trigger-${index}`} initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ height: { duration: reducedMotion ? 0.15 : 0.55, ease: [0.16, 1, 0.3, 1] }, opacity: { duration: reducedMotion ? 0.15 : 0.3, ease: "easeOut" } }} className="overflow-hidden"><motion.p initial={{ opacity: 0, y: reducedMotion ? 0 : 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: reducedMotion ? 0 : 6 }} transition={{ duration: reducedMotion ? 0.15 : 0.42, delay: reducedMotion ? 0 : 0.09, ease: [0.16, 1, 0.3, 1] }} className="max-w-[650px] pb-6 pl-[44px] text-sm leading-7 text-slate-600 sm:pb-8 sm:pl-[68px] sm:text-base sm:leading-8">{item.answer}</motion.p></motion.div>}</AnimatePresence><motion.span animate={{ width: isOpen ? "100%" : "0%" }} whileHover={{ width: isOpen ? "100%" : "28%" }} transition={{ duration: reducedMotion ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }} className="absolute bottom-[-1px] left-0 h-px bg-violet-500" /></motion.div>;
}

function FAQSection() {
  const reducedMotion = useReducedMotion();
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  return <section aria-labelledby="faq-heading" className="bg-[#f6f3ff] py-24 sm:py-28 lg:py-36"><div className="mx-auto max-w-[1380px] px-5 sm:px-8 lg:px-10"><div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-16 xl:gap-20"><motion.div initial={reducedMotion ? false : { opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.25 }} transition={{ duration: reducedMotion ? 0 : 0.7, ease: [0.16, 1, 0.3, 1] }} className="lg:pt-3"><p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-600">FAQ</p><h2 id="faq-heading" className="mt-5 text-4xl font-black leading-[0.95] tracking-[-0.06em] text-slate-950 sm:text-5xl lg:text-6xl">Questions?<br />We&apos;ve got you.</h2><p className="mt-6 max-w-sm text-base leading-8 text-slate-600 sm:text-lg">A few quick answers about using SwiftDU, getting help on campus and becoming a Swifter.</p><p className="mt-8 text-sm font-semibold text-slate-500">Still have a question?</p><Link href="/contact-us" className="group mt-2 inline-flex items-center gap-2 text-sm font-bold text-violet-700 transition hover:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2">Contact SwiftDU <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" /></Link></motion.div><div className="border-t border-slate-300/70">{faqs.map((item, index) => <motion.div key={item.number} initial={reducedMotion ? false : { opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.08 }} transition={{ duration: reducedMotion ? 0 : 0.58, delay: reducedMotion ? 0 : index * 0.05, ease: [0.16, 1, 0.3, 1] }}><FAQItem item={item} index={index} isOpen={openIndex === index} onToggle={() => setOpenIndex(openIndex === index ? null : index)} reducedMotion={reducedMotion} /></motion.div>)}</div></div></div></section>;
}

// Retained for reference while the redesigned closing composition below is used.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyTrustAndCTA() {
  const items = [{ label: "Verified Swifters", icon: BadgeCheck }, { label: "Secure payments", icon: Shield }, { label: "Order tracking", icon: PackageCheck }, { label: "Community standards", icon: Users }, { label: "Dedicated support", icon: Headphones }, { label: "Safe & reliable", icon: ShieldCheck }];
  return <section className="bg-white px-5 py-24 sm:px-8 sm:py-32 lg:px-10"><div className="mx-auto grid max-w-[1380px] overflow-hidden bg-[#0d1236] text-white lg:grid-cols-[1.05fr_0.95fr]">
    <div className="p-7 sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Built on trust</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.04em]">Your safety. Our priority.</h2><div className="mt-9 grid grid-cols-2 gap-6 sm:grid-cols-3">{items.map((item) => <div key={item.label} className="text-center"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-violet-300"><item.icon className="h-5 w-5" /></span><p className="mt-3 text-xs font-semibold text-indigo-100">{item.label}</p></div>)}</div></div>
    <div className="relative isolate overflow-hidden bg-gradient-to-br from-violet-700 to-purple-500 p-7 sm:p-10"><div aria-hidden="true" className="absolute -right-20 -top-20 -z-10 h-72 w-72 rounded-full bg-white/15 blur-2xl" /><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-100">Your place is here</p><h2 className="mt-3 max-w-md text-3xl font-bold tracking-[-0.04em]">Belong. Support. Earn. Learn. Grow.</h2><p className="mt-4 max-w-md text-sm leading-6 text-violet-100">Whether you need help getting things done or have time and skills to give, SwiftDU has a place for you.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link href="/auth" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-violet-700 transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Join the community <ArrowRight className="h-4 w-4" /></Link><Link href="/tasker-signup" className="inline-flex items-center justify-center rounded-full border border-white/40 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Become a Swifter</Link></div></div>
  </div></section>;
}

function TrustAndCTA() {
  const reducedMotion = useReducedMotion();
  const lines = ["Belong.", "Support. Earn.", "Learn. Grow."];
  return <section className="bg-white px-5 py-20 sm:px-8 sm:py-24 lg:px-10 lg:py-28"><motion.div initial={reducedMotion ? false : { opacity: 0, y: 40 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: 0.2 }} transition={{ duration: reducedMotion ? 0 : 0.8, ease: [0.16, 1, 0.3, 1] }} className="relative isolate mx-auto flex min-h-[540px] max-w-[1480px] overflow-hidden bg-[#0d1236] px-6 py-8 text-white sm:min-h-[580px] sm:px-10 sm:py-10 lg:min-h-[660px] lg:px-14 lg:py-12"><div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-30 [background-image:linear-gradient(rgba(255,255,255,.10)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.10)_1px,transparent_1px)] [background-size:72px_72px]" /><motion.div aria-hidden="true" animate={reducedMotion ? undefined : { x: [0, 10, 0], y: [0, -8, 0], scale: [1, 1.04, 1] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="pointer-events-none absolute -right-24 -top-24 -z-10 h-[28rem] w-[28rem] rounded-full bg-violet-600/40 blur-[95px]" /><div aria-hidden="true" className="pointer-events-none absolute right-[8%] top-[16%] h-40 w-40 rounded-full border border-violet-200/35 sm:h-56 sm:w-56" /><div aria-hidden="true" className="pointer-events-none absolute right-[11%] top-[20%] flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-lg text-violet-200">↗</div><div aria-hidden="true" className="pointer-events-none absolute bottom-[-13%] right-[-1%] select-none text-[clamp(8rem,19vw,19rem)] font-black leading-none tracking-[-0.09em] text-white/[0.035]">BELONG</div><div className="relative z-10 flex w-full flex-col"><motion.p initial={reducedMotion ? false : { opacity: 0, y: 15 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: reducedMotion ? 0 : 0.6, delay: reducedMotion ? 0 : 0.12, ease: [0.16, 1, 0.3, 1] }} className="text-xs font-bold uppercase tracking-[0.2em] text-violet-200">Your place is here</motion.p><p className="absolute right-0 top-0 hidden text-[10px] font-bold tracking-[0.18em] text-violet-200/80 sm:block">01 / COMMUNITY</p><h2 className="mt-auto max-w-5xl text-[clamp(3.5rem,7vw,7.5rem)] font-black leading-[0.9] tracking-[-0.07em]">{lines.map((line, index) => <motion.span key={line} initial={reducedMotion ? false : { opacity: 0, y: 35 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: reducedMotion ? 0 : 0.78, delay: reducedMotion ? 0 : 0.14 + index * 0.09, ease: [0.16, 1, 0.3, 1] }} className={`block ${index === 2 ? "text-violet-300" : ""}`}>{line}</motion.span>)}</h2><div className="mt-8 flex flex-col gap-7 lg:mt-10 lg:flex-row lg:items-end lg:justify-between"><motion.p initial={reducedMotion ? false : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: reducedMotion ? 0 : 0.65, delay: reducedMotion ? 0 : 0.42, ease: [0.16, 1, 0.3, 1] }} className="max-w-md text-sm leading-7 text-indigo-100 sm:text-base sm:leading-8">Whether you need help getting things done or have time and skills to give, SwiftDU has a place for you.</motion.p><motion.div initial={reducedMotion ? false : { opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: reducedMotion ? 0 : 0.65, delay: reducedMotion ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }} className="flex flex-col gap-3 sm:flex-row"><Link href="/auth" className="group inline-flex h-14 items-center justify-center gap-3 rounded-full bg-white px-7 text-sm font-bold text-[#17151d] transition duration-300 hover:scale-[1.02] hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Join the community <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" /></Link><Link href="/tasker-signup" className="inline-flex h-14 items-center justify-center rounded-full border border-white/25 px-7 text-sm font-bold text-white transition duration-300 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Become a Swifter</Link></motion.div></div></div></motion.div></section>;
}

// Retained only as the previous short marquee reference.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyTrustMarquee() {
  const phrases = ["Built on trust", "Verified Swifters", "Safe & reliable", "Order tracking", "Dedicated support", "Community first"];
  return <section aria-label="SwiftDU trust commitments" className="overflow-hidden bg-violet-600 py-6 sm:py-8"><p className="sr-only">Built on trust. Verified Swifters. Safe and reliable. Order tracking. Dedicated support. Community first.</p><div aria-hidden="true" className="trust-marquee-track flex w-max items-center">{[0, 1].map((group) => <div key={group} className="flex shrink-0 items-center gap-7 pr-7 sm:gap-10 sm:pr-10">{phrases.map((phrase, index) => <span key={phrase} className="flex items-center gap-7 sm:gap-10"><span className={`whitespace-nowrap text-4xl font-black uppercase leading-none tracking-[-0.055em] sm:text-5xl lg:text-[clamp(3.5rem,6vw,6.5rem)] ${index % 2 === 1 ? "[-webkit-text-stroke:1px_rgba(255,255,255,0.72)] text-transparent" : "text-white"}`}>{phrase}</span><span className="text-2xl text-violet-200 sm:text-3xl lg:text-4xl">✦</span></span>)}</div>)}</div></section>;
}

const trustMarqueeItems = ["BUILT ON TRUST", "VERIFIED SWIFTERS", "STUDENT POWERED", "TRACK EVERY STEP", "SAFE & RELIABLE", "DEDICATED SUPPORT", "COMMUNITY FIRST", "BUILT FOR CAMPUS", "HELP WHEN YOU NEED IT", "EARN WHILE HELPING", "REAL STUDENTS. REAL SUPPORT.", "SWIFTDU COMMUNITY"];

function TrustMarquee() {
  const group = (key: string) => <div key={key} className="trust-marquee-group flex shrink-0 items-center">{trustMarqueeItems.map((item, index) => <span key={`${key}-${item}`} className="flex shrink-0 items-center"><span className={`whitespace-nowrap text-4xl font-black uppercase leading-none tracking-[-0.055em] sm:text-5xl lg:text-[clamp(3.5rem,6vw,6.5rem)] ${index % 2 === 1 ? "[-webkit-text-stroke:1.5px_rgba(255,255,255,0.82)] text-transparent" : "text-white"}`}>{item}</span><span className="mx-7 text-2xl text-violet-200 sm:mx-10 sm:text-3xl lg:mx-12 lg:text-4xl">✦</span></span>)}</div>;
  return <section aria-label="SwiftDU trust commitments" className="overflow-hidden bg-violet-600 py-7 sm:py-9 lg:py-10"><p className="sr-only">SwiftDU is built on trust with verified Swifters, order tracking, dedicated support and a student-powered campus community.</p><div aria-hidden="true" className="trust-marquee-track">{group("first")}{group("second")}</div></section>;
}

export default function HomepageSections() {
  return <><CommunitySection /><PillarsSection /><HowItWorks /><OpportunitiesSection /><PartnersSection /><FAQSection /><TrustAndCTA /><TrustMarquee /></>;
}
