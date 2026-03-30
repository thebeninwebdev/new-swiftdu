"use client"

import React, { useState, useRef } from 'react';
import Head from 'next/head';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import { 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  Send, 
  MessageCircle,
  Instagram,
  Twitter,
  Linkedin,
  Facebook,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Users,
  Briefcase,
  AlertCircle
} from 'lucide-react';

// --- Animation Components ---

const FadeInWhenVisible = ({ children, delay = 0, direction = "up" }: { 
  children: React.ReactNode, 
  delay?: number,
  direction?: "up" | "down" | "left" | "right"
}) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  const directions = {
    up: { y: 50, x: 0 },
    down: { y: -50, x: 0 },
    left: { y: 0, x: 50 },
    right: { y: 0, x: -50 }
  };

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, ...directions[direction] }}
      animate={isInView ? { opacity: 1, y: 0, x: 0 } : { opacity: 0, ...directions[direction] }}
      transition={{ 
        duration: 0.7, 
        delay,
        type: "spring",
        stiffness: 100
      }}
    >
      {children}
    </motion.div>
  );
};

const FloatingElement = ({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) => (
  <motion.div
    className={className}
    animate={{ 
      y: [0, -15, 0],
    }}
    transition={{ 
      duration: 4, 
      repeat: Infinity, 
      ease: "easeInOut",
      delay 
    }}
  >
    {children}
  </motion.div>
);

// --- Components ---

const Hero = () => {
  return (
    <section className="relative min-h-[60vh] flex items-center justify-center overflow-hidden bg-linear-to-br from-indigo-900 via-purple-900 to-indigo-800">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <motion.div
          animate={{ 
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0]
          }}
          transition={{ duration: 20, repeat: Infinity }}
          className="absolute top-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ 
            scale: [1, 1.3, 1],
            rotate: [0, -90, 0]
          }}
          transition={{ duration: 25, repeat: Infinity }}
          className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-500/20 rounded-full blur-3xl"
        />
      </div>

      {/* Floating Icons */}
      <FloatingElement delay={0} className="absolute top-1/4 left-1/4">
        <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white/50">
          <Mail className="w-8 h-8" />
        </div>
      </FloatingElement>

      <FloatingElement delay={1}>
        <div className="absolute top-1/3 right-1/4 w-14 h-14 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white/50">
          <MessageCircle className="w-7 h-7" />
        </div>
      </FloatingElement>

      <FloatingElement delay={2}>
        <div className="absolute bottom-1/4 left-1/3 w-12 h-12 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center text-white/50">
          <Phone className="w-6 h-6" />
        </div>
      </FloatingElement>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200 }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white mb-6"
        >
          <MessageCircle className="w-4 h-4" />
          <span className="text-sm font-medium">We&apos;d Love to Hear From You</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="text-5xl md:text-7xl font-bold text-white mb-6"
        >
          Get in{' '}
          <span className="text-transparent bg-clip-text bg-linear-to-r from-yellow-400 to-orange-500">
            Touch
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="text-xl text-indigo-100 max-w-2xl mx-auto"
        >
          Have a question, suggestion, or just want to say hello? 
          We&apos;re here to help and always excited to hear from fellow students.
        </motion.p>
      </div>
    </section>
  );
};

const ContactCards = () => {
  const contacts = [
    {
      icon: Mail,
      title: "Email Us",
      info: "support@swiftdu.org",
      subInfo: "We reply within 24 hours",
      color: "from-blue-500 to-blue-600",
      hoverColor: "group-hover:shadow-blue-200"
    },
    {
      icon: Phone,
      title: "Call Us",
      info: "+234 800 SWIFTDU",
      subInfo: "Mon-Fri, 9am-6pm WAT",
      color: "from-green-500 to-green-600",
      hoverColor: "group-hover:shadow-green-200"
    },
    {
      icon: MapPin,
      title: "Visit Us",
      info: "Western Delta University",
      subInfo: "Oghara, Delta State, Nigeria",
      color: "from-purple-500 to-purple-600",
      hoverColor: "group-hover:shadow-purple-200"
    },
    {
      icon: Clock,
      title: "Support Hours",
      info: "Always Online",
      subInfo: "24/7 for urgent requests",
      color: "from-orange-500 to-orange-600",
      hoverColor: "group-hover:shadow-orange-200"
    }
  ];

  return (
    <section className="py-20 bg-gray-50 -mt-10 relative z-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {contacts.map((contact, index) => (
            <FadeInWhenVisible key={index} delay={index * 0.1}>
              <motion.div
                whileHover={{ y: -10, scale: 1.02 }}
                className={`group bg-white rounded-3xl p-8 shadow-lg ${contact.hoverColor} hover:shadow-2xl transition-all duration-300`}
              >
                <motion.div
                  whileHover={{ rotate: 360 }}
                  transition={{ duration: 0.5 }}
                  className={`w-16 h-16 bg-linear-to-br ${contact.color} rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg`}
                >
                  <contact.icon className="w-8 h-8" />
                </motion.div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">{contact.title}</h3>
                <p className="text-indigo-600 font-semibold mb-1">{contact.info}</p>
                <p className="text-gray-500 text-sm">{contact.subInfo}</p>
              </motion.div>
            </FadeInWhenVisible>
          ))}
        </div>
      </div>
    </section>
  );
};

const ContactForm = () => {
  const [formState, setFormState] = useState({
    name: '',
    email: '',
    subject: '',
    message: '',
    category: 'general'
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const categories = [
    { id: 'general', label: 'General Inquiry', icon: HelpCircle },
    { id: 'support', label: 'Technical Support', icon: AlertCircle },
    { id: 'business', label: 'Business Partnership', icon: Briefcase },
    { id: 'student', label: 'Student Issue', icon: Users }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1500));

    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16">
          {/* Form Side */}
          <FadeInWhenVisible direction="left">
            <div>
              <span className="text-indigo-600 font-bold tracking-wider uppercase text-sm">Send a Message</span>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mt-4 mb-6">
                Let&apos;s Start a Conversation
              </h2>
              <p className="text-gray-600 text-lg mb-8">
                Fill out the form below and we&apos;ll get back to you as soon as possible. 
                Whether you have a question about our service or want to partner with us, 
                we&apos;re all ears.
              </p>

              <AnimatePresence mode="wait">
                {isSubmitted ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="bg-green-50 border-2 border-green-200 rounded-3xl p-10 text-center"
                  >
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                      className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center text-white mx-auto mb-6"
                    >
                      <CheckCircle2 className="w-10 h-10" />
                    </motion.div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Message Sent!</h3>
                    <p className="text-gray-600 mb-6">Thanks for reaching out. We&apos;ll get back to you within 24 hours.</p>
                    <button
                      onClick={() => {
                        setIsSubmitted(false);
                        setFormState({ name: '', email: '', subject: '', message: '', category: 'general' });
                      }}
                      className="text-indigo-600 font-semibold hover:underline"
                    >
                      Send another message
                    </button>
                  </motion.div>
                ) : (
                  <motion.form
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleSubmit}
                    className="space-y-6"
                  >
                    {/* Category Selection */}
                    <div className="grid grid-cols-2 gap-3">
                      {categories.map((cat) => (
                        <motion.button
                          key={cat.id}
                          type="button"
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setFormState({ ...formState, category: cat.id })}
                          className={`p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${
                            formState.category === cat.id 
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-700' 
                              : 'border-gray-200 hover:border-indigo-300 text-gray-600'
                          }`}
                        >
                          <cat.icon className="w-5 h-5" />
                          <span className="text-sm font-medium">{cat.label}</span>
                        </motion.button>
                      ))}
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Your Name</label>
                        <input
                          type="text"
                          required
                          value={formState.name}
                          onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                          placeholder="John Doe"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                        <input
                          type="email"
                          required
                          value={formState.email}
                          onChange={(e) => setFormState({ ...formState, email: e.target.value })}
                          className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                          placeholder="john@student.wdu.edu.ng"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Subject</label>
                      <input
                        type="text"
                        required
                        value={formState.subject}
                        onChange={(e) => setFormState({ ...formState, subject: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all"
                        placeholder="How do I become a runner?"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Message</label>
                      <textarea
                        required
                        rows={5}
                        value={formState.message}
                        onChange={(e) => setFormState({ ...formState, message: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all resize-none"
                        placeholder="Tell us what's on your mind..."
                      />
                    </div>

                    <motion.button
                      type="submit"
                      disabled={isSubmitting}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                    >
                      {isSubmitting ? (
                        <>
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                          />
                          Sending...
                        </>
                      ) : (
                        <>
                          Send Message
                          <Send className="w-5 h-5" />
                        </>
                      )}
                    </motion.button>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </FadeInWhenVisible>

          {/* Info Side */}
          <FadeInWhenVisible direction="right">
            <div className="lg:pl-8">
              <div className="bg-linear-to-br from-indigo-600 to-purple-700 rounded-3xl p-8 md:p-10 text-white h-full">
                <h3 className="text-2xl font-bold mb-6">Frequently Asked Questions</h3>

                <div className="space-y-6">
                  {[
                    {
                      q: "How quickly do you respond?",
                      a: "We typically respond within 24 hours during weekdays. For urgent issues, reach out on social media."
                    },
                    {
                      q: "Can I visit your office?",
                      a: "Yes! We're located on the Western Delta University campus. Drop by during our support hours."
                    },
                    {
                      q: "How do I report an issue?",
                      a: "Use the form on this page and select 'Student Issue' as the category for fastest resolution."
                    },
                    {
                      q: "Interested in partnering?",
                      a: "Select 'Business Partnership' in the form. We love collaborating with student organizations and local businesses."
                    }
                  ].map((faq, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 }}
                      className="border-b border-white/20 pb-4 last:border-0"
                    >
                      <h4 className="font-semibold text-lg mb-2 flex items-center gap-2">
                        <HelpCircle className="w-5 h-5 text-yellow-400" />
                        {faq.q}
                      </h4>
                      <p className="text-indigo-100 text-sm leading-relaxed">{faq.a}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="mt-8 pt-8 border-t border-white/20">
                  <p className="text-sm text-indigo-200 mb-4">Follow us for updates</p>
                  <div className="flex gap-4">
                    {[Twitter, Instagram, Facebook, Linkedin].map((Icon, index) => (
                      <motion.a
                        key={index}
                        href="#"
                        whileHover={{ scale: 1.2, y: -5 }}
                        whileTap={{ scale: 0.9 }}
                        className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
                      >
                        <Icon className="w-5 h-5" />
                      </motion.a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </FadeInWhenVisible>
        </div>
      </div>
    </section>
  );
};

const MapSection = () => {
  return (
    <section className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <FadeInWhenVisible>
          <div className="text-center mb-12">
            <span className="text-indigo-600 font-bold tracking-wider uppercase text-sm">Find Us</span>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mt-4">Visit Our Campus Office</h2>
            <p className="text-gray-600 mt-4 max-w-2xl mx-auto">
              We&apos;re right here at Western Delta University. Come say hello or drop off any physical documents.
            </p>
          </div>
        </FadeInWhenVisible>

        <FadeInWhenVisible delay={0.2}>
          <motion.div
            whileHover={{ scale: 1.01 }}
            className="relative rounded-3xl overflow-hidden shadow-2xl"
          >
            {/* Map Placeholder - Replace with actual map embed */}
            <div className="bg-gray-200 h-96 md:h-125 relative flex items-center justify-center">
              <img 
                src="/Western_Delta_University.jpg" 
                alt="Western Delta University Location"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />

              {/* Location Pin */}
              <motion.div
                initial={{ y: -20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: "spring", stiffness: 200, delay: 0.5 }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full"
              >
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="relative"
                >
                  <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-4 bg-indigo-600 rotate-45 -z-10" />
                </motion.div>
              </motion.div>

              {/* Location Info Card */}
              <motion.div
                initial={{ y: 20, opacity: 0 }}
                whileInView={{ y: 0, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.6 }}
                className="absolute bottom-6 left-6 right-6 md:left-6 md:right-auto md:max-w-sm bg-white rounded-2xl p-6 shadow-xl"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 shrink-0">
                    <MapPin className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">Swiftdu HQ</h3>
                    <p className="text-gray-600 text-sm mt-1">
                      Western Delta University,<br />
                      Oghara, Delta State,<br />
                      Nigeria.
                    </p>
                    <a 
                      href="https://maps.google.com" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-600 font-semibold text-sm mt-3 hover:underline"
                    >
                      Get Directions <ArrowRight className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        </FadeInWhenVisible>
      </div>
    </section>
  );
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-white font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Head>
        <title>Contact Us | Swiftdu - Get in Touch</title>
        <meta name="description" content="Contact Swiftdu - Reach out to us for support, partnerships, or general inquiries. We're here to help!" />
      </Head>

      <main>
        <Hero />
        <ContactCards />
        <ContactForm />
        <MapSection />
      </main>
    </div>
  );
}