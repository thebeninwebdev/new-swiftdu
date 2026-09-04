"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef } from "react";
import { motion, type MotionValue, useReducedMotion, useScroll, useTransform } from "framer-motion";
import supportImage from "@/public/support.jpeg";
import earnImage from "@/public/earn.jpeg";
import learnImage from "@/public/learn.jpeg";
import signupImage from "@/public/sign-up.jpg";
import taskerSignupImage from "@/public/tasker-signup.jpg";
import {
  ArrowRight, ArrowUpRight, BadgeCheck, Banknote, Bike, BookOpen,
  Coffee, GraduationCap, Headphones, Heart, PackageCheck, Shield,
  ShieldCheck, ShoppingBag, Sparkles, Star, Users, Wallet,
} from "lucide-react";

const stats = [
  { value: "2,500+", label: "Active students", icon: Users, tone: "bg-violet-100 text-violet-600" },
  { value: "25,000+", label: "Tasks completed", icon: PackageCheck, tone: "bg-emerald-100 text-emerald-600" },
  { value: "₦12M+", label: "Earned by students", icon: Banknote, tone: "bg-amber-100 text-amber-600" },
  { value: "1 Campus", label: "Western Delta University", icon: GraduationCap, tone: "bg-blue-100 text-blue-600" },
];

const pillars = [
  { title: "Support", description: "Get things done easily—food, printing, shopping, errands and more.", cta: "Explore services", href: "/auth", icon: Heart, style: "bg-violet-50 text-violet-600" },
  { title: "Earn", description: "Complete tasks, help others and earn money on your schedule.", cta: "Become a Swifter", href: "/tasker-signup", icon: Wallet, style: "bg-emerald-50 text-emerald-600" },
  { title: "Grow", description: "Learn new skills, build experience and grow through opportunities.", cta: "Start growing", href: "/auth", icon: GraduationCap, style: "bg-blue-50 text-blue-600" },
];

const steps = [
  { title: "Post what you need", description: "Tell us what you need done, when you need it, and what you want to spend.", icon: BookOpen, color: "bg-violet-500" },
  { title: "Connect with a Swifter", description: "A verified fellow student accepts your request and gets to work.", icon: Users, color: "bg-emerald-500" },
  { title: "Get it done securely", description: "Track the task, confirm completion, and pay safely through SwiftDU.", icon: ShieldCheck, color: "bg-blue-500" },
];

const opportunities = [
  { title: "Food pickups", category: "Everyday support", image: supportImage, icon: Coffee, href: "/auth" },
  { title: "Shopping errands", category: "Campus convenience", image: earnImage, icon: ShoppingBag, href: "/auth" },
  { title: "Printing & notes", category: "Academic support", image: learnImage, icon: BookOpen, href: "/auth" },
  { title: "Earn as a Swifter", category: "Student opportunity", image: taskerSignupImage, icon: Bike, href: "/tasker-signup" },
];

const testimonials = [
  { name: "Daniel O.", role: "Campus Swifter", image: earnImage, quote: "SwiftDU helped me earn responsibly while balancing classes." },
  { name: "Sarah E.", role: "Student", image: supportImage, quote: "I get the support I need without losing time between lectures." },
  { name: "Eseosa M.", role: "Community member", image: learnImage, quote: "Every task feels like students genuinely helping students." },
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
  return <section id="features" className="bg-[#f7f6fb] py-24 sm:py-32"><div className="mx-auto max-w-[1380px] px-5 sm:px-8 lg:px-10">
    <div className="mb-12 text-center"><p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-600">There&apos;s a place for you here</p><h2 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-slate-950 sm:text-5xl">What can you do in SwiftDU?</h2></div>
    <div className="grid gap-6 md:grid-cols-3">{pillars.map((pillar, index) => <article key={pillar.title} className="skillex-card landing-scroll-pop min-h-80 border border-slate-200 bg-white p-8 shadow-[0_12px_40px_rgba(64,48,120,0.06)] sm:p-10" style={{ animationDelay: `${index * 100}ms` }}><div className={`flex h-16 w-16 items-center justify-center ${pillar.style}`}><pillar.icon className="h-8 w-8" aria-hidden="true" /></div><h3 className="mt-7 text-2xl font-bold text-slate-950">{pillar.title}</h3><p className="mt-4 min-h-24 text-base leading-7 text-slate-600">{pillar.description}</p><Link href={pillar.href} className="group mt-5 inline-flex items-center gap-2 text-sm font-bold text-violet-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500">{pillar.cta}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></Link></article>)}</div>
  </div></section>;
}

// Retained for reference while the redesigned section below is used.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function LegacyHowItWorks() {
  return <section id="how-it-works" className="relative overflow-hidden bg-[#0d1236] py-20 text-white sm:py-24"><div aria-hidden="true" className="absolute inset-0 opacity-15 [background-image:radial-gradient(circle_at_center,#8b5cf6_1px,transparent_1px)] [background-size:28px_28px]" /><div className="relative mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
    <div className="mb-12 max-w-xl"><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">How it works</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-4xl">Every order supports<br />another student.</h2><p className="mt-4 text-sm leading-6 text-indigo-200">You get what you need done. A fellow student earns. Our community grows.</p></div>
    <div className="relative grid gap-8 sm:grid-cols-2 lg:grid-cols-5"><div aria-hidden="true" className="absolute left-[10%] right-[10%] top-7 hidden h-px bg-white/20 lg:block" />{steps.map((step, index) => <div key={step.title} className="landing-scroll-pop relative text-center"><span className={`relative z-10 mx-auto flex h-14 w-14 items-center justify-center rounded-full ring-4 ring-[#0d1236] ${step.color}`}><step.icon className="h-5 w-5" aria-hidden="true" /></span><p className="mt-4 text-xs font-bold text-indigo-300">0{index + 1}</p><h3 className="mt-2 text-sm font-bold">{step.title}</h3><p className="mx-auto mt-2 max-w-36 text-xs leading-5 text-indigo-200">{step.description}</p></div>)}</div>
    <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-white/10 pt-6 text-xs text-indigo-200"><span className="font-bold uppercase tracking-wider text-white">Services include</span><span>Food</span><span>Printing</span><span>Shopping</span><span>Water</span><span>Laundry</span><span>Notes</span><span>…and more</span></div>
  </div></section>;
}

function HowItWorks() {
  const reducedMotion = useReducedMotion();
  const reveal = (delay = 0) => ({
    initial: reducedMotion ? false as const : { opacity: 0, y: 28 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.25 },
    transition: { duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  });

  return <section id="how-it-works" className="overflow-hidden bg-white py-24 sm:py-32">
    <div className="mx-auto max-w-[1380px] px-5 sm:px-8 lg:px-10">
      <motion.div {...reveal()} className="mx-auto max-w-2xl text-center">
        <p className="text-sm font-semibold text-violet-600">Simple steps</p>
        <h2 className="mt-3 text-4xl font-bold tracking-[-0.045em] text-slate-950 sm:text-5xl">How it works</h2>
        <p className="mt-4 text-base leading-7 text-slate-500 sm:text-lg">No confusion or delays. Just simple, reliable support from your campus community.</p>
      </motion.div>

      <div className="mt-14 grid items-center gap-16 lg:mt-20 lg:grid-cols-[0.95fr_1.05fr] lg:gap-16 xl:gap-24">
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, x: -45, scale: 0.97 }}
          whileInView={{ opacity: 1, x: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto w-full max-w-[520px] pb-20 sm:pr-16 lg:mx-0"
        >
          <div className="relative aspect-[5/6] max-h-[510px] overflow-hidden rounded-[28px] bg-slate-100">
            <Image src={signupImage} alt="A SwiftDU student arranging help on campus" fill sizes="(max-width: 1024px) 90vw, 40vw" className="object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/20 via-transparent to-transparent" />
          </div>
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, delay: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-0 left-[8%] right-0 rounded-[24px] border border-slate-100 bg-white/95 p-5 shadow-[0_22px_60px_rgba(51,41,86,0.16)] backdrop-blur-xl sm:left-[35%] sm:p-6"
          >
            <div className="flex items-center justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Your request</p><p className="mt-1 font-bold text-slate-950">Campus essentials</p></div>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600"><PackageCheck className="h-5 w-5" aria-hidden="true" /></span>
            </div>
            <div className="mt-5 space-y-3">{["Food pickup", "Print course notes", "Shopping errand"].map((item, index) => <div key={item} className="flex items-center gap-3"><span className={`h-9 w-9 rounded-lg ${index === 0 ? "bg-violet-100" : index === 1 ? "bg-sky-100" : "bg-amber-100"}`} /><div className="h-2.5 flex-1 rounded-full bg-slate-100"><div className="h-full rounded-full bg-slate-200" style={{ width: `${76 - index * 13}%` }} /></div></div>)}</div>
          </motion.div>
          <motion.div
            initial={reducedMotion ? false : { opacity: 0, scale: 0.8, x: 16 }}
            whileInView={{ opacity: 1, scale: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.48, ease: [0.16, 1, 0.3, 1] }}
            className="absolute bottom-24 right-2 rounded-full bg-violet-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-violet-500/25 sm:right-0"
          >Post your task</motion.div>
        </motion.div>

        <div className="relative">
          <div aria-hidden="true" className="absolute bottom-10 left-7 top-10 w-px bg-slate-200 sm:left-8" />
          <motion.div aria-hidden="true" initial={reducedMotion ? false : { scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true, amount: 0.4 }} transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }} className="absolute left-7 top-10 h-24 w-px origin-top bg-violet-600 sm:left-8" />
          <div className="space-y-9 sm:space-y-12">{steps.map((step, index) => <motion.article key={step.title} {...reveal(0.15 + index * 0.12)} className="relative grid grid-cols-[3.5rem_1fr] gap-5 sm:grid-cols-[4rem_1fr] sm:gap-7">
            <span className={`relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border shadow-sm sm:h-16 sm:w-16 ${index === 0 ? "border-violet-200 bg-violet-600 text-white shadow-violet-200" : "border-slate-200 bg-white text-slate-900"}`}><step.icon className="h-6 w-6" aria-hidden="true" /></span>
            <div className="pt-1 sm:pt-2"><p className="text-xs font-bold tracking-[0.14em] text-violet-600">0{index + 1}</p><h3 className="mt-1 text-xl font-bold tracking-[-0.025em] text-slate-950 sm:text-2xl">{step.title}</h3><p className="mt-2 max-w-xl text-sm leading-6 text-slate-500 sm:text-base sm:leading-7">{step.description}</p></div>
          </motion.article>)}</div>
        </div>
      </div>
    </div>
  </section>;
}

function OpportunitiesSection() {
  return <section className="bg-white py-24 sm:py-32"><div className="mx-auto max-w-[1480px] px-5 sm:px-8 lg:px-10">
    <div className="grid gap-14 lg:grid-cols-[0.6fr_1.4fr]"><div><p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-600">Learn & grow</p><h2 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-6xl">Learn something.<br />Become something.</h2><p className="mt-7 max-w-lg text-base leading-8 text-slate-600 sm:text-lg">Access opportunities built around real campus life. Put what you learn into practice through tasks, teamwork and community.</p><Link href="/auth" className="mt-8 inline-flex items-center gap-2 bg-violet-600 px-6 py-4 text-sm font-bold text-white transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2">Explore SwiftDU <ArrowRight className="h-4 w-4" /></Link></div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{opportunities.map((item, index) => <Link key={item.title} href={item.href} className="skillex-card skillex-media-card group landing-scroll-reveal min-h-80 overflow-hidden border border-slate-300 bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500" style={{ animationDelay: `${index * 90}ms` }}><div className="relative aspect-[4/3] overflow-hidden"><Image src={item.image} alt="" fill sizes="(max-width: 640px) 100vw, 25vw" className="object-cover" /></div><div className="p-6"><div className="flex items-center justify-between"><span className="flex h-11 w-11 items-center justify-center bg-violet-50 text-violet-600"><item.icon className="h-5 w-5" /></span><ArrowUpRight className="h-5 w-5 text-slate-400" /></div><h3 className="mt-5 text-lg font-bold text-slate-950 transition-colors group-hover:text-violet-700">{item.title}</h3><p className="mt-2 text-sm text-slate-500">{item.category}</p></div></Link>)}</div>
    </div>
    <div className="mt-16 grid gap-6 border border-slate-200 bg-[#f7f6fb] p-8 sm:grid-cols-2 lg:grid-cols-4">{["Apply your skills through real tasks", "Lead teams and projects", "Build your experience", "Grow your campus network"].map((text, index) => <div key={text} className="flex items-center gap-4 text-sm font-semibold text-slate-700"><span className="flex h-11 w-11 shrink-0 items-center justify-center bg-white text-violet-600 shadow-sm"><Sparkles className="h-5 w-5" /></span><span>{String(index + 1).padStart(2, "0")}. {text}</span></div>)}</div>
  </div></section>;
}

function ImpactSection() {
  return <section className="bg-[#f7f6fb] py-24 sm:py-32"><div className="mx-auto max-w-[1380px] px-5 sm:px-8 lg:px-10"><div className="grid gap-8 lg:grid-cols-[0.55fr_1.25fr_0.75fr]">
    <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-600">Meet the Swifters</p><h2 className="mt-4 text-4xl font-bold tracking-[-0.04em] text-slate-950 sm:text-5xl">Real students.<br />Real stories.<br />Real impact.</h2><Link href="/reviews" className="group mt-8 inline-flex items-center gap-2 text-sm font-bold text-violet-600">Meet more Swifters <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></Link></div>
    <div className="-mx-5 flex snap-x snap-mandatory gap-5 overflow-x-auto overscroll-x-contain px-5 pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0">{testimonials.map((item, index) => <article key={item.name} className="skillex-card landing-scroll-reveal min-h-80 min-w-[82vw] snap-center border border-slate-300 bg-white p-7 sm:min-w-0" style={{ animationDelay: `${index * 100}ms` }}><div className="relative h-16 w-16 overflow-hidden rounded-full"><Image src={item.image} alt={`${item.name}, ${item.role}`} fill sizes="64px" className="object-cover" /></div><h3 className="mt-5 text-lg font-bold text-slate-950">{item.name}</h3><p className="mt-1 text-sm text-violet-600">{item.role}</p><div className="mt-4 flex gap-0.5 text-amber-400" aria-label="5 out of 5 stars">{[0,1,2,3,4].map((star) => <Star key={star} className="h-4 w-4 fill-current" />)}</div><p className="mt-5 text-base leading-7 text-slate-600">“{item.quote}”</p></article>)}</div>
    <div className="relative min-h-96 overflow-hidden"><Image src={signupImage} alt="Students building a stronger SwiftDU community" fill sizes="(max-width: 1024px) 100vw, 30vw" className="object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent" /><p className="absolute bottom-8 left-8 right-8 text-3xl font-bold leading-tight text-white">Stronger together.<br />Better every day.</p></div>
  </div></div></section>;
}

function TrustAndCTA() {
  const items = [{ label: "Verified Swifters", icon: BadgeCheck }, { label: "Secure payments", icon: Shield }, { label: "Order tracking", icon: PackageCheck }, { label: "Community standards", icon: Users }, { label: "Dedicated support", icon: Headphones }, { label: "Safe & reliable", icon: ShieldCheck }];
  return <section className="bg-white px-5 py-24 sm:px-8 sm:py-32 lg:px-10"><div className="mx-auto grid max-w-[1380px] overflow-hidden bg-[#0d1236] text-white lg:grid-cols-[1.05fr_0.95fr]">
    <div className="p-7 sm:p-10"><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-300">Built on trust</p><h2 className="mt-3 text-3xl font-bold tracking-[-0.04em]">Your safety. Our priority.</h2><div className="mt-9 grid grid-cols-2 gap-6 sm:grid-cols-3">{items.map((item) => <div key={item.label} className="text-center"><span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-violet-300"><item.icon className="h-5 w-5" /></span><p className="mt-3 text-xs font-semibold text-indigo-100">{item.label}</p></div>)}</div></div>
    <div className="relative isolate overflow-hidden bg-gradient-to-br from-violet-700 to-purple-500 p-7 sm:p-10"><div aria-hidden="true" className="absolute -right-20 -top-20 -z-10 h-72 w-72 rounded-full bg-white/15 blur-2xl" /><p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-100">Your place is here</p><h2 className="mt-3 max-w-md text-3xl font-bold tracking-[-0.04em]">Belong. Support. Earn. Learn. Grow.</h2><p className="mt-4 max-w-md text-sm leading-6 text-violet-100">Whether you need help getting things done or have time and skills to give, SwiftDU has a place for you.</p><div className="mt-7 flex flex-col gap-3 sm:flex-row"><Link href="/auth" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-violet-700 transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Join the community <ArrowRight className="h-4 w-4" /></Link><Link href="/tasker-signup" className="inline-flex items-center justify-center rounded-full border border-white/40 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white">Become a Swifter</Link></div></div>
  </div></section>;
}

export default function HomepageSections() {
  return <><CommunitySection /><PillarsSection /><HowItWorks /><OpportunitiesSection /><ImpactSection /><TrustAndCTA /></>;
}
