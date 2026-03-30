"use client"

import React, { useState, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import { 
  Target, 
  Users, 
  TrendingUp, 
  Heart, 
  MapPin, 
  ArrowRight,
  Quote,
  Calendar,
  Award,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

// --- Animation Components ---

const FadeInWhenVisible = ({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ 
        duration: 0.8, 
        delay,
        type: "spring",
        stiffness: 100
      }}
    >
      {children}
    </motion.div>
  );
};

const CountUp = ({ end, suffix = "" }: { end: number, suffix?: string }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const [count, setCount] = useState(0);

  React.useEffect(() => {
    if (isInView) {
      let start = 0;
      const duration = 2000;
      const increment = end / (duration / 16);

      const timer = setInterval(() => {
        start += increment;
        if (start >= end) {
          setCount(end);
          clearInterval(timer);
        } else {
          setCount(Math.floor(start));
        }
      }, 16);

      return () => clearInterval(timer);
    }
  }, [isInView, end]);

  return <span ref={ref}>{count}{suffix}</span>;
};

// --- Sections ---

const Hero = () => {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const y2 = useTransform(scrollY, [0, 500], [0, -150]);

  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden bg-linear-to-br from-indigo-900 via-purple-900 to-indigo-800">
      {/* Animated Background Elements */}
      <motion.div 
        style={{ y: y1 }}
        className="absolute top-20 left-10 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl"
      />
      <motion.div 
        style={{ y: y2 }}
        className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl"
      />

      {/* Floating Shapes */}
      <motion.div
        animate={{ 
          y: [0, -30, 0],
          rotate: [0, 5, 0]
        }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-1/4 right-1/4 w-20 h-20 border-2 border-white/10 rounded-2xl"
      />
      <motion.div
        animate={{ 
          y: [0, 30, 0],
          rotate: [0, -5, 0]
        }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-1/3 left-1/4 w-16 h-16 bg-white/5 rounded-full"
      />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white mb-8"
        >
          <MapPin className="w-4 h-4" />
          <span className="text-sm font-medium">Born at Western Delta University</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="text-5xl md:text-7xl lg:text-8xl font-bold text-white mb-6 leading-tight"
        >
          We Are The{' '}
          <span className="relative inline-block">
            <span className="relative z-10 text-transparent bg-clip-text bg-linear-to-r from-yellow-400 to-orange-500">
              Solution
            </span>
            <motion.svg
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ delay: 0.8, duration: 0.8 }}
              className="absolute -bottom-2 left-0 w-full"
              viewBox="0 0 300 12"
              fill="none"
            >
              <path
                d="M2 10C50 2 100 2 150 6C200 10 250 10 298 2"
                stroke="url(#gradient)"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <defs>
                <linearGradient id="gradient" x1="0" y1="0" x2="300" y2="0">
                  <stop stopColor="#FBBF24" />
                  <stop offset="1" stopColor="#F97316" />
                </linearGradient>
              </defs>
            </motion.svg>
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="text-xl md:text-2xl text-indigo-100 max-w-3xl mx-auto mb-10 leading-relaxed"
        >
          Students just like you, who got tired of waiting. We built Swiftdu in 2025 to solve 
          the everyday struggle of getting things done on campus.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.8 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link
            href="/signup"
            className="group px-8 py-4 bg-white text-indigo-900 rounded-full font-bold text-lg hover:bg-yellow-400 transition-all duration-300 flex items-center justify-center gap-2"
          >
            Join Our Movement
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </div>

      {/* Scroll Indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-6 h-10 border-2 border-white/30 rounded-full flex justify-center pt-2"
        >
          <motion.div className="w-1.5 h-3 bg-white/50 rounded-full" />
        </motion.div>
      </motion.div>
    </section>
  );
};

const StorySection = () => {
  return (
    <section className="py-24 bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Image Side */}
          <FadeInWhenVisible>
            <div className="relative">
              <motion.div
                whileHover={{ scale: 1.02 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="relative z-10 rounded-3xl overflow-hidden shadow-2xl"
              >
                <img 
                  src="/Western_Delta_University.jpg" 
                  alt="Western Delta University Gate"
                  className="w-full h-[500px] object-cover"
                />
                <div className="absolute inset-0 bg-linear-to-t from-indigo-900/60 to-transparent" />
                <div className="absolute bottom-6 left-6 text-white">
                  <p className="text-sm font-medium opacity-80">Where It All Started</p>
                  <p className="text-2xl font-bold">Western Delta University</p>
                </div>
              </motion.div>

              {/* Floating Badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5, type: "spring" }}
                className="absolute -bottom-6 -right-6 bg-yellow-400 text-indigo-900 p-6 rounded-2xl shadow-xl z-20"
              >
                <Calendar className="w-8 h-8 mb-2" />
                <p className="text-3xl font-bold">2025</p>
                <p className="text-sm font-medium">Established</p>
              </motion.div>

              {/* Background Decoration */}
              <div className="absolute -top-10 -left-10 w-full h-full bg-indigo-100 rounded-3xl -z-10" />
            </div>
          </FadeInWhenVisible>

          {/* Content Side */}
          <div className="lg:pl-8">
            <FadeInWhenVisible>
              <span className="text-indigo-600 font-bold tracking-wider uppercase text-sm">Our Story</span>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mt-4 mb-6 leading-tight">
                From Frustration to{' '}
                <span className="text-indigo-600">Innovation</span>
              </h2>
            </FadeInWhenVisible>

            <FadeInWhenVisible delay={0.2}>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                It started with a simple problem: we needed food from the cafeteria, without waiting in line for 30 minutes. The queue was endless. We thought, &quot;What if someone could 
                just do this for us?&quot;
              </p>
            </FadeInWhenVisible>

            <FadeInWhenVisible delay={0.3}>
              <p className="text-lg text-gray-600 mb-8 leading-relaxed">
                That moment sparked Swiftdu. We realized thousands of WDU students faced the same 
                daily struggles — long queues, missed meals, forgotten items, and the constant 
                battle of balancing academics with life.
              </p>
            </FadeInWhenVisible>

            <FadeInWhenVisible delay={0.4}>
              <div className="space-y-4">
                {[
                  "Built by WDU students, for WDU students",
                  "Solving real campus problems we face daily",
                  "Creating earning opportunities for students"
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + index * 0.1 }}
                    className="flex items-center gap-3"
                  >
                    <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    </div>
                    <span className="text-gray-700 font-medium">{item}</span>
                  </motion.div>
                ))}
              </div>
            </FadeInWhenVisible>
          </div>
        </div>
      </div>
    </section>
  );
};

const ProblemSolution = () => {
  const problems = [
    { icon: "⏰", title: "Long Queues", desc: "Spending hours in lines instead of studying" },
    { icon: "📚", title: "Missed Deliveries", desc: "Textbooks and supplies arriving at wrong times" },
    { icon: "🍽️", title: "Skipped Meals", desc: "Too busy to grab food between classes" },
    { icon: "😰", title: "Campus Stress", desc: "Juggling too many tasks with little time" }
  ];

  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInWhenVisible>
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              The Problem We{' '}
              <span className="text-red-500 line-through decoration-4">Faced</span>{' '}
              <span className="text-green-500">Solved</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Campus life shouldn&apos;t be a constant struggle. We identified the pain points and built the solution.
            </p>
          </div>
        </FadeInWhenVisible>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {problems.map((problem, index) => (
            <FadeInWhenVisible key={index} delay={index * 0.1}>
              <motion.div
                whileHover={{ y: -10, rotate: [0, -2, 2, 0] }}
                transition={{ duration: 0.3 }}
                className="bg-white p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 text-center group"
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                  className="text-5xl mb-4"
                >
                  {problem.icon}
                </motion.div>
                <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                  {problem.title}
                </h3>
                <p className="text-gray-600">{problem.desc}</p>
              </motion.div>
            </FadeInWhenVisible>
          ))}
        </div>

        {/* Arrow Down Animation */}
        <div className="flex justify-center my-12">
          <motion.div
            animate={{ y: [0, 20, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="text-indigo-600"
          >
            <ArrowRight className="w-12 h-12 rotate-90" />
          </motion.div>
        </div>

        <FadeInWhenVisible>
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-linear-to-r from-indigo-600 to-purple-600 rounded-3xl p-10 text-center text-white shadow-2xl"
          >
            <Sparkles className="w-12 h-12 mx-auto mb-4 text-yellow-300" />
            <h3 className="text-3xl font-bold mb-4">Enter Swiftdu</h3>
            <p className="text-xl text-indigo-100 max-w-2xl mx-auto">
              A platform where students help students. Post a task, set your price, 
              and let a fellow student handle it while you focus on what matters.
            </p>
          </motion.div>
        </FadeInWhenVisible>
      </div>
    </section>
  );
};

const Values = () => {
  const values = [
    {
      icon: Users,
      title: "Student First",
      desc: "We are students serving students. Every feature is designed with campus life in mind.",
      color: "bg-blue-500"
    },
    {
      icon: Target,
      title: "Reliability",
      desc: "When you post a task, it gets done. No excuses, no delays — just results.",
      color: "bg-green-500"
    },
    {
      icon: Heart,
      title: "Community",
      desc: "We're building more than an app — we're building a supportive campus ecosystem.",
      color: "bg-red-500"
    },
    {
      icon: TrendingUp,
      title: "Growth",
      desc: "Every task completed is a step toward a more efficient campus experience.",
      color: "bg-purple-500"
    }
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInWhenVisible>
          <div className="text-center mb-16">
            <span className="text-indigo-600 font-bold tracking-wider uppercase text-sm">What Drives Us</span>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mt-4">Our Core Values</h2>
          </div>
        </FadeInWhenVisible>

        <div className="grid md:grid-cols-2 gap-8">
          {values.map((value, index) => (
            <FadeInWhenVisible key={index} delay={index * 0.1}>
              <motion.div
                whileHover={{ x: 10 }}
                className="flex gap-6 p-8 rounded-3xl bg-gray-50 hover:bg-white hover:shadow-xl transition-all duration-300 group"
              >
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                  className={`w-16 h-16 ${value.color} rounded-2xl flex items-center justify-center text-white shadow-lg shrink-0`}
                >
                  <value.icon className="w-8 h-8" />
                </motion.div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2 group-hover:text-indigo-600 transition-colors">
                    {value.title}
                  </h3>
                  <p className="text-gray-600 leading-relaxed">{value.desc}</p>
                </div>
              </motion.div>
            </FadeInWhenVisible>
          ))}
        </div>
      </div>
    </section>
  );
};

const Stats = () => {
  const stats = [
    { value: 1000, suffix: "+", label: "Students Helped", icon: Users },
    { value: 5000, suffix: "+", label: "Tasks Completed", icon: CheckCircle2 },
    { value: 50, suffix: "k", label: "Naira Earned by Runners", icon: TrendingUp },
    { value: 5, suffix: "", label: "Campuses (Coming Soon)", icon: MapPin }
  ];

  return (
    <section className="py-24 bg-indigo-900 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
          backgroundSize: '40px 40px'
        }} />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <FadeInWhenVisible>
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">Making an Impact</h2>
            <p className="text-indigo-200 text-xl">Numbers that tell our story since 2025</p>
          </div>
        </FadeInWhenVisible>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((stat, index) => (
            <FadeInWhenVisible key={index} delay={index * 0.1}>
              <motion.div
                whileHover={{ y: -10, scale: 1.05 }}
                className="bg-white/10 backdrop-blur-sm rounded-3xl p-8 text-center border border-white/20"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.2 + index * 0.1, type: "spring" }}
                  className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center text-white mx-auto mb-4"
                >
                  <stat.icon className="w-8 h-8" />
                </motion.div>
                <div className="text-5xl font-bold text-white mb-2">
                  <CountUp end={stat.value} suffix={stat.suffix} />
                </div>
                <p className="text-indigo-200 font-medium">{stat.label}</p>
              </motion.div>
            </FadeInWhenVisible>
          ))}
        </div>
      </div>
    </section>
  );
};

const TeamQuote = () => {
  return (
    <section className="py-24 bg-linear-to-br from-purple-50 to-indigo-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInWhenVisible>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative bg-white rounded-3xl p-10 md:p-16 shadow-2xl"
          >
            <Quote className="absolute top-8 left-8 w-16 h-16 text-indigo-100" />

            <div className="relative z-10 text-center">
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.2 }}
                className="text-2xl md:text-4xl font-bold text-gray-900 mb-8 leading-relaxed italic"
              >
                &quot;We didn&apos;t just build an app. We built a solution to the daily struggles 
                we face as students. Every time someone uses Swiftdu, they&apos;re not just 
                getting a task done — they&apos;re getting time back to focus on their dreams.&quot;
              </motion.p>

              <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.4 }}
                className="flex items-center justify-center gap-4"
              >
                <div className="w-16 h-16 bg-indigo-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  S
                </div>
                <div className="text-left">
                  <p className="font-bold text-gray-900 text-lg">The Swiftdu Team</p>
                  <p className="text-gray-600">Western Delta University Students</p>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </FadeInWhenVisible>
      </div>
    </section>
  );
};

const CTASection = () => {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInWhenVisible>
          <motion.div
            whileHover={{ scale: 1.02 }}
            className="bg-linear-to-r from-indigo-600 via-purple-600 to-indigo-600 rounded-3xl p-10 md:p-16 text-center text-white shadow-2xl relative overflow-hidden"
          >
            {/* Animated Background */}
            <motion.div
              animate={{ 
                background: [
                  "radial-gradient(circle at 0% 0%, rgba(255,255,255,0.1) 0%, transparent 50%)",
                  "radial-gradient(circle at 100% 100%, rgba(255,255,255,0.1) 0%, transparent 50%)",
                  "radial-gradient(circle at 0% 0%, rgba(255,255,255,0.1) 0%, transparent 50%)"
                ]
              }}
              transition={{ duration: 10, repeat: Infinity }}
              className="absolute inset-0"
            />

            <div className="relative z-10">
              <motion.div
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 200 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm mb-6"
              >
                <Award className="w-5 h-5" />
                <span className="font-medium">Join 1,000+ Students</span>
              </motion.div>

              <h2 className="text-4xl md:text-5xl font-bold mb-6">
                Be Part of the Solution
              </h2>
              <p className="text-xl text-indigo-100 mb-10 max-w-2xl mx-auto">
                Whether you need help with tasks or want to earn as a runner, 
                Swiftdu is your campus companion. Sign up today — it&apos;s free!
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/signup"
                  className="group px-8 py-4 bg-white text-indigo-600 rounded-full font-bold text-lg hover:bg-yellow-400 hover:text-indigo-900 transition-all duration-300 flex items-center justify-center gap-2"
                >
                  Sign Up Now
                  <motion.span
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    <ArrowRight className="w-5 h-5" />
                  </motion.span>
                </Link>
                <Link
                  href="/"
                  className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-full font-bold text-lg hover:bg-white/10 transition-all"
                >
                  Back to Home
                </Link>
              </div>
            </div>
          </motion.div>
        </FadeInWhenVisible>
      </div>
    </section>
  );
};


export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Head>
        <title>About Us | Swiftdu - Born at Western Delta University</title>
        <meta name="description" content="Learn about Swiftdu - the student-built solution to campus errands at Western Delta University, established in 2025." />
      </Head>

      <main>
        <Hero />
        <StorySection />
        <ProblemSolution />
        <Values />
        <Stats />
        <TeamQuote />
        <CTASection />
      </main>
    </div>
  );
}