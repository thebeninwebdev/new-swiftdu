"use client"

import Head from 'next/head';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { 
  CheckCircle2, 
  MapPin, 
  Clock, 
  Wallet, 
  ArrowRight, 
  Zap, 
  Users, 
  ShieldCheck,
  Coffee,
  BookOpen,
  ShoppingBag,
  Bike
} from 'lucide-react';
import { useEffect } from 'react';
import {authClient} from "@/lib/auth-client";
import InstallPwaButton from "@/components/InstallPwaButton";

// --- Animation Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2
    }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: { type: "spring" as const, stiffness: 100 }
  }
};

const floatVariants = {
  animate: {
    y: [0, -10, 0],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: "easeInOut" as const
    }
  }
};

// --- Components ---



const Hero = () => {
  return (
    <section className="relative pt-32 pb-20 lg:pt-40 lg:pb-28 overflow-hidden">
      {/* Background Blobs */}
      <div className="absolute top-0 right-0 -mr-20 -mt-20 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob"></div>
      <div className="absolute top-0 left-0 -ml-20 -mt-20 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000"></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-12 items-center">

          {/* Left Content */}
          <motion.div 
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="text-center lg:text-left"
          >
            <motion.div variants={itemVariants} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold text-sm mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
              </span>
              Now live on 5 campuses
            </motion.div>

            <motion.h1 variants={itemVariants} className="text-5xl lg:text-7xl font-extrabold text-gray-900 tracking-tight leading-[1.1] mb-6">
              Campus life, <br/>
              <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-600 to-purple-600">
                simplified.
              </span>
            </motion.h1>

            <motion.p variants={itemVariants} className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              Need a coffee run? A textbook delivered? Or your laundry picked up? 
              Swiftdu connects busy students with reliable campus runners in minutes.
            </motion.p>

            <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link 
                href="/signup"
                className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2"
              >
                Post a Task <ArrowRight className="w-5 h-5" />
              </Link>
              <Link 
                href="/tasker-signup"
                className="px-8 py-4 bg-white text-gray-700 border border-gray-200 rounded-xl font-bold text-lg hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2"
              >
                Become a Runner
              </Link>
            </motion.div>

            <motion.div variants={itemVariants} className="mt-5 flex justify-center lg:justify-start">
              <InstallPwaButton />
            </motion.div>

            <motion.div variants={itemVariants} className="mt-8 flex items-center justify-center lg:justify-start gap-4 text-sm text-gray-500">
              <div className="flex -space-x-2">
                {[1,2,3,4].map((i) => (
                  <div key={i} className="w-8 h-8 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center text-xs font-bold text-gray-600">
                    {String.fromCharCode(64+i)}
                  </div>
                ))}
              </div>
              <p>Trusted by 1,000+ students</p>
            </motion.div>
          </motion.div>

          {/* Right Content: Interactive Visual */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8 }}
            className="relative hidden lg:block"
          >
            {/* Mock Phone/App Interface */}
            <div className="relative mx-auto w-80 bg-gray-900 rounded-[3rem] border-8 border-gray-900 shadow-2xl overflow-hidden h-150">
              <div className="absolute top-0 inset-x-0 h-6 bg-gray-900 z-20 flex justify-center">
                <div className="w-20 h-4 bg-gray-800 rounded-b-xl"></div>
              </div>

              {/* App Screen Content */}
              <div className="bg-gray-50 h-full pt-8 pb-4 px-4 flex flex-col gap-4 overflow-hidden relative">
                 {/* Status Bar Mock */}
                 <div className="flex justify-between text-xs font-bold text-gray-900 px-2 mb-2">
                    <span>9:41</span>
                    <div className="flex gap-1">
                      <div className="w-4 h-2.5 bg-gray-900 rounded-sm"></div>
                      <div className="w-0.5 h-2.5 bg-gray-900 rounded-sm"></div>
                    </div>
                 </div>

                 {/* App Header */}
                 <div className="flex justify-between items-center mb-4">
                   <div>
                     <p className="text-xs text-gray-500">Good Morning,</p>
                     <h3 className="font-bold text-gray-900">Boss 👋</h3>
                   </div>
                   <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600">
                     <Users size={16} />
                   </div>
                 </div>

                 {/* Active Task Card */}
                 <motion.div 
                   variants={floatVariants}
                   animate="animate"
                   className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100"
                 >
                   <div className="flex justify-between items-start mb-3">
                     <div className="bg-orange-100 p-2 rounded-lg text-orange-600">
                       <Coffee size={20} />
                     </div>
                     <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">Active</span>
                   </div>
                   <h4 className="font-bold text-gray-900">Cafeteria Run</h4>
                   <p className="text-xs text-gray-500 mb-3">2 Items • Library Drop-off</p>
                   <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
                     <div className="bg-indigo-500 h-full w-2/3 rounded-full"></div>
                   </div>
                   <p className="text-xs text-right mt-1 text-indigo-600 font-medium">Runner nearby</p>
                 </motion.div>

                 {/* Categories */}
                 <div className="grid grid-cols-4 gap-2 mt-2">
                    {[
                      {icon: Coffee, label: "Food"},
                      {icon: BookOpen, label: "Books"},
                      {icon: ShoppingBag, label: "Shop"},
                      {icon: Bike, label: "Misc"},
                    ].map((cat, idx) => (
                      <div key={idx} className="flex flex-col items-center gap-1">
                        <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-gray-700">
                          <cat.icon size={20} />
                        </div>
                        <span className="text-[10px] font-medium text-gray-500">{cat.label}</span>
                      </div>
                    ))}
                 </div>

                 {/* Recent Activity List */}
                 <div className="mt-4">
                   <h4 className="font-bold text-sm text-gray-900 mb-3">Recent Requests</h4>
                   <div className="space-y-3">
                     {[1,2].map((i) => (
                       <div key={i} className="bg-white p-3 rounded-xl flex items-center gap-3 shadow-sm border border-gray-50">
                         <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                           <ShoppingBag size={16} />
                         </div>
                         <div className="flex-1">
                           <h5 className="text-sm font-bold text-gray-900">Target Pickup</h5>
                           <p className="text-xs text-gray-500">Completed yesterday</p>
                         </div>
                         <span className="text-xs font-bold text-gray-900">₦1250</span>
                       </div>
                     ))}
                   </div>
                 </div>
              </div>
            </div>

            {/* Decorative Elements around phone */}
            <motion.div 
              animate={{ y: [0, -15, 0], rotate: [0, 5, 0] }}
              transition={{ duration: 5, repeat: Infinity, delay: 1 }}
              className="absolute -top-10 -right-10 bg-white p-4 rounded-2xl shadow-xl border border-gray-100 z-20"
            >
              <div className="flex items-center gap-3">
                <div className="bg-green-100 p-2 rounded-full text-green-600">
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Task Completed</p>
                  <p className="font-bold text-gray-900">+₦800</p>
                </div>
              </div>
            </motion.div>

            <motion.div 
              animate={{ y: [0, 15, 0], rotate: [0, -5, 0] }}
              transition={{ duration: 6, repeat: Infinity, delay: 0.5 }}
              className="absolute -bottom-5 -left-10 bg-white p-4 rounded-2xl shadow-xl border border-gray-100 z-20"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-bold text-xs">
                  JD
                </div>
                <div>
                  <p className="text-xs text-gray-500">Runner Assigned</p>
                  <p className="font-bold text-gray-900">John D.</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

const Features = () => {
  const features = [
    {
      icon: Clock,
      title: "Lightning Fast",
      desc: "Average task completion time of under 45 minutes. We prioritize speed because we know you have deadlines."
    },
    {
      icon: MapPin,
      title: "Campus Only",
      desc: "Hyper-localized to your university. Runners know the library shortcuts and dorm locations by heart."
    },
    {
      icon: Wallet,
      title: "Secure Payments",
      desc: "In-app wallet system. No cash needed. Pay securely with your student ID linked account or card."
    },
    {
      icon: ShieldCheck,
      title: "Verified Students",
      desc: "Every runner is a verified student with a background check. Safety and trust are our top priorities."
    }
  ];

  return (
    <section id="features" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-indigo-600 font-bold tracking-wide uppercase text-sm mb-2">Why Swiftdu?</h2>
          <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Built by students, for students.</h3>
          <p className="text-gray-600 text-lg">We understand the struggle of balancing classes, social life, and chores. Let us handle the running around.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {features.map((feature, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="p-6 bg-gray-50 rounded-2xl hover:bg-white hover:shadow-xl transition-all duration-300 border border-transparent hover:border-gray-100 group"
            >
              <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center text-indigo-600 mb-4 group-hover:scale-110 transition-transform">
                <feature.icon size={24} />
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">{feature.title}</h4>
              <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const HowItWorks = () => {
  const steps = [
    { title: "Post Your Task", desc: "Describe what you need, set your price, and drop a pin. Payment is automatic." },
    { title: "Get Matched", desc: "A verified student runner nearby accepts your request instantly." },
    { title: "Track & Relax", desc: "Watch the progress in real-time as your runner updates you." },
    { title: "Rate Tasker", desc: "Confirm completion and rate your runner" }
  ];

  return (
    <section id="how-it-works" className="py-24 bg-indigo-900 text-white overflow-hidden relative">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }}></div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How it works</h2>
          <p className="text-indigo-200 text-lg">From request to relaxation in 4 easy steps.</p>
        </div>

        <div className="grid md:grid-cols-4 gap-8 relative">
          {/* Connecting Line (Desktop) */}
          <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-indigo-700 -z-10"></div>

          {steps.map((step, index) => (
            <motion.div 
              key={index}
              initial={{ opacity: 0, scale: 0.5 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.2, type: "spring" }}
              className="text-center"
            >
              <div className="w-24 h-24 mx-auto bg-indigo-800 rounded-full border-4 border-indigo-600 flex items-center justify-center mb-6 relative z-10 shadow-lg shadow-indigo-900/50">
                <span className="text-3xl font-bold text-white">{index + 1}</span>
              </div>
              <h3 className="text-xl font-bold mb-2">{step.title}</h3>
              <p className="text-indigo-200 text-sm px-4">{step.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const CTASection = () => {
  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col md:flex-row"
        >
          <div className="p-10 md:p-16 md:w-2/3 flex flex-col justify-center">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Ready to get your time back?</h2>
            <p className="text-gray-600 text-lg mb-8">
              Join the Swiftdu community today. Whether you need help or want to earn extra cash between classes, we&apos;ve got you covered.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link 
                href="/signup"
                className="px-8 py-4 bg-indigo-600 text-white rounded-xl font-bold text-center hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200"
              >
                Sign Up Now — It&apos;s Free
              </Link>
              <Link 
                href="/tasker-signup"
                className="px-8 py-4 bg-white text-gray-700 border border-gray-200 rounded-xl font-bold text-center hover:bg-gray-50 hover:border-gray-300 transition-all"
              >
                Become a Runner
              </Link>
            </div>
            <p className="text-xs text-gray-400 mt-4">Available on 5 campuses. Sign up takes less than 2 minutes.</p>
          </div>
          <div className="md:w-1/3 bg-indigo-600 relative overflow-hidden flex items-center justify-center p-10">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            <motion.div 
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
              className="text-white/20"
            >
              <Zap size={200} />
            </motion.div>
            <div className="relative z-10 text-center text-white">
              <p className="font-bold text-2xl mb-2">₦50k+</p>
              <p className="text-indigo-200 text-sm">Earned by runners this semester</p>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default function LandingPage() {
  
  const router = useRouter();
  const { data: session } = authClient.useSession();
  useEffect(() => {
    if (session?.user) {
      router.replace('/dashboard')
    }
  }, [session?.user, router]);

  return (
    <div className="min-h-screen bg-white font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Head>
        <title>Swiftdu | Campus Errands Made Easy</title>
        <meta name="description" content="Swiftdu connects students for fast, safe campus errands." />
      </Head>

 

      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <CTASection />
      </main>
    </div>
  );
}
