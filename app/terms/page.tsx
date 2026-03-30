"use client"

import React, { useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { motion, useInView, useScroll } from 'framer-motion';
import { 
  Shield, 
  Lock, 
  Eye, 
  FileText, 
  UserCheck, 
  Server,
  Clock,
  Mail,
  ChevronRight,
  ArrowUp
} from 'lucide-react';

// --- Animation Components ---

const FadeInWhenVisible = ({ children, delay = 0 }: { children: React.ReactNode, delay?: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });
  
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
};

const TableOfContents = ({ sections }: { sections: string[] }) => {
  const [activeSection, setActiveSection] = React.useState(0);
  
  React.useEffect(() => {
    const handleScroll = () => {
      const scrollPosition = window.scrollY + 200;
      
      sections.forEach((_, index) => {
        const element = document.getElementById(`section-${index}`);
        if (element) {
          const { offsetTop, offsetHeight } = element;
          if (scrollPosition >= offsetTop && scrollPosition < offsetTop + offsetHeight) {
            setActiveSection(index);
          }
        }
      });
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [sections]);
  
  const scrollToSection = (index: number) => {
    const element = document.getElementById(`section-${index}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.5 }}
      className="hidden lg:block fixed left-8 top-1/2 -translate-y-1/2 w-64 bg-white rounded-2xl shadow-xl p-6 border border-gray-100 z-40"
    >
      <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-indigo-600" />
        Contents
      </h3>
      <nav className="space-y-2">
        {sections.map((section, index) => (
          <button
            key={index}
            onClick={() => scrollToSection(index)}
            className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all flex items-center gap-2 ${
              activeSection === index 
                ? 'bg-indigo-50 text-indigo-700 font-medium' 
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <ChevronRight className={`w-4 h-4 transition-transform ${
              activeSection === index ? 'rotate-90' : ''
            }`} />
            {section}
          </button>
        ))}
      </nav>
    </motion.div>
  );
};

const PolicySection = ({ id, icon: Icon, title, children }: { 
  id: string, 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icon: any, 
  title: string, 
  children: React.ReactNode 
}) => (
  <motion.section
    id={id}
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
    transition={{ duration: 0.6 }}
    className="mb-12 scroll-mt-24"
  >
    <div className="flex items-center gap-4 mb-6">
      <motion.div
        whileHover={{ rotate: 360 }}
        transition={{ duration: 0.5 }}
        className="w-14 h-14 bg-indigo-100 rounded-2xl flex items-center justify-center text-indigo-600"
      >
        <Icon className="w-7 h-7" />
      </motion.div>
      <h2 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h2>
    </div>
    <div className="prose prose-lg max-w-none text-gray-600 leading-relaxed">
      {children}
    </div>
  </motion.section>
);

export default function PrivacyPolicy() {
  const { scrollYProgress } = useScroll();
  
  const sections = [
    "Introduction",
    "Information We Collect",
    "How We Use Your Data",
    "Data Security",
    "Your Rights",
    "Cookies & Tracking",
    "Third-Party Services",
    "Data Retention",
    "Children's Privacy",
    "Changes to Policy",
    "Contact Us"
  ];
  
  const lastUpdated = "January 2025";
  
  return (
    <div className="min-h-screen bg-gray-50 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <Head>
        <title>Privacy Policy | Swiftdu</title>
        <meta name="description" content="Swiftdu Privacy Policy - Learn how we protect your data and privacy." />
      </Head>
      
      {/* Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-indigo-600 z-50 origin-left"
        style={{ scaleX: scrollYProgress }}
      />
      
      {/* Table of Contents */}
      <TableOfContents sections={sections} />
      
      {/* Hero */}
      <section className="bg-linear-to-br from-indigo-900 via-purple-900 to-indigo-800 text-white py-24 relative overflow-hidden">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
          className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl"
        />
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl"
        />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200 }}
            className="w-20 h-20 bg-white/10 backdrop-blur-sm rounded-3xl flex items-center justify-center mx-auto mb-8"
          >
            <Shield className="w-10 h-10" />
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-4xl md:text-6xl font-bold mb-6"
          >
            Privacy Policy
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-xl text-indigo-200 mb-4"
          >
            Your privacy is our priority
          </motion.p>
          
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="flex items-center justify-center gap-2 text-sm text-indigo-300"
          >
            <Clock className="w-4 h-4" />
            Last updated: {lastUpdated}
          </motion.div>
        </div>
      </section>
      
      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <FadeInWhenVisible>
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 md:p-12">
            
            <PolicySection id="section-0" icon={FileText} title="1. Introduction">
              <p className="mb-4">
                Welcome to Swiftdu (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;). We are committed to protecting your personal 
                information and your right to privacy. This Privacy Policy explains how we collect, use, 
                store, and protect your information when you use our platform.
              </p>
              <p>
                By using Swiftdu, you agree to the collection and use of information in accordance with 
                this policy. If you do not agree with our policies and practices, please do not use our services.
              </p>
            </PolicySection>
            
            <PolicySection id="section-1" icon={UserCheck} title="2. Information We Collect">
              <p className="mb-4">We collect several types of information to provide and improve our services:</p>
              <ul className="space-y-3 mb-4">
                <li className="flex items-start gap-3">
                  <span className="w-2 h-2 bg-indigo-600 rounded-full mt-2 shrink-0" />
                  <span><strong>Personal Information:</strong> Name, email address, phone number, student ID, 
                  and profile picture when you register.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-2 h-2 bg-indigo-600 rounded-full mt-2 shrink-0" />
                  <span><strong>Location Data:</strong> Campus location and delivery addresses to facilitate task completion.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-2 h-2 bg-indigo-600 rounded-full mt-2 shrink-0" />
                  <span><strong>Transaction Data:</strong> Payment information, task history, and earnings for runners.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="w-2 h-2 bg-indigo-600 rounded-full mt-2 shrink-0" />
                  <span><strong>Device Information:</strong> IP address, browser type, and device identifiers for security.</span>
                </li>
              </ul>
            </PolicySection>
            
            <PolicySection id="section-2" icon={Eye} title="3. How We Use Your Data">
              <p className="mb-4">We use the collected information for various purposes:</p>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  "To provide and maintain our services",
                  "To match task posters with runners",
                  "To process payments securely",
                  "To verify student status",
                  "To improve user experience",
                  "To ensure platform safety",
                  "To communicate updates",
                  "To prevent fraud and abuse"
                ].map((use, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl"
                  >
                    <div className="w-2 h-2 bg-indigo-600 rounded-full" />
                    <span className="text-gray-700">{use}</span>
                  </motion.div>
                ))}
              </div>
            </PolicySection>
            
            <PolicySection id="section-3" icon={Lock} title="4. Data Security">
              <p className="mb-4">
                We implement appropriate technical and organizational security measures to protect your 
                personal data against unauthorized access, alteration, disclosure, or destruction.
              </p>
              <p className="mb-4">Our security measures include:</p>
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
                  <span>SSL/TLS encryption for all data transmission</span>
                </li>
                <li className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
                  <span>Secure payment processing through PCI-compliant providers</span>
                </li>
                <li className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
                  <span>Regular security audits and penetration testing</span>
                </li>
                <li className="flex items-start gap-3">
                  <Lock className="w-5 h-5 text-indigo-600 mt-0.5 shrink-0" />
                  <span>Strict access controls for employee data access</span>
                </li>
              </ul>
            </PolicySection>
            
            <PolicySection id="section-4" icon={UserCheck} title="5. Your Rights">
              <p className="mb-4">As a user, you have the following rights regarding your personal data:</p>
              <div className="bg-indigo-50 rounded-2xl p-6 space-y-4">
                {[
                  { right: "Right to Access", desc: "Request a copy of your personal data" },
                  { right: "Right to Rectification", desc: "Correct inaccurate or incomplete data" },
                  { right: "Right to Erasure", desc: "Request deletion of your personal data" },
                  { right: "Right to Restrict Processing", desc: "Limit how we use your data" },
                  { right: "Right to Data Portability", desc: "Receive your data in a structured format" },
                  { right: "Right to Object", desc: "Opt-out of certain data uses" }
                ].map((item, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.1 }}
                    className="flex items-start gap-3"
                  >
                    <div className="w-6 h-6 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {index + 1}
                    </div>
                    <div>
                      <span className="font-semibold text-gray-900">{item.right}:</span>
                      <span className="text-gray-600 ml-2">{item.desc}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
              <p className="mt-4 text-sm text-gray-500">
                To exercise these rights, please contact us at support@swiftdu.org
              </p>
            </PolicySection>
            
            <PolicySection id="section-5" icon={Server} title="6. Cookies & Tracking">
              <p className="mb-4">
                We use cookies and similar tracking technologies to track activity on our platform and 
                hold certain information to improve your experience.
              </p>
              <p className="mb-4">Types of cookies we use:</p>
              <ul className="space-y-3 mb-4">
                <li><strong>Essential Cookies:</strong> Required for the platform to function properly</li>
                <li><strong>Preference Cookies:</strong> Remember your settings and preferences</li>
                <li><strong>Analytics Cookies:</strong> Help us understand how users interact with our platform</li>
                <li><strong>Marketing Cookies:</strong> Used to deliver relevant advertisements (with consent)</li>
              </ul>
              <p>
                You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent. 
                However, some features may not function properly without cookies.
              </p>
            </PolicySection>
            
            <PolicySection id="section-6" icon={Server} title="7. Third-Party Services">
              <p className="mb-4">
                We may employ third-party companies and individuals to facilitate our services, provide 
                services on our behalf, or assist us in analyzing how our platform is used.
              </p>
              <p className="mb-4">These third parties have access to your personal data only to perform 
              these tasks on our behalf and are obligated not to disclose or use it for any other purpose. 
              Our key service providers include:</p>
              <ul className="space-y-2">
                <li>• Payment processing providers</li>
                <li>• Cloud hosting services</li>
                <li>• Analytics providers</li>
                <li>• Email communication services</li>
              </ul>
            </PolicySection>
            
            <PolicySection id="section-7" icon={Clock} title="8. Data Retention">
              <p>
                We will retain your personal data only for as long as is necessary for the purposes set 
                out in this Privacy Policy. We will retain and use your data to the extent necessary to 
                comply with our legal obligations, resolve disputes, and enforce our policies. Typically, 
                we retain account data for 2 years after account closure, unless longer retention is 
                required by law.
              </p>
            </PolicySection>
            
            <PolicySection id="section-8" icon={UserCheck} title="9. Children's Privacy">
              <p>
                Our services are intended for university students aged 18 and older. We do not knowingly 
                collect personally identifiable information from anyone under the age of 18. If you are 
                a parent or guardian and you are aware that your child has provided us with personal data, 
                please contact us immediately so we can take necessary actions.
              </p>
            </PolicySection>
            
            <PolicySection id="section-9" icon={FileText} title="10. Changes to This Policy">
              <p>
                We may update our Privacy Policy from time to time. We will notify you of any changes by 
                posting the new Privacy Policy on this page and updating the &quot;Last Updated&quot; date. 
                You are advised to review this Privacy Policy periodically for any changes. Changes to 
                this Privacy Policy are effective when they are posted on this page.
              </p>
            </PolicySection>
            
            <PolicySection id="section-10" icon={Mail} title="11. Contact Us">
              <p className="mb-6">
                If you have any questions about this Privacy Policy or our data practices, please contact us:
              </p>
              <div className="bg-linear-to-br from-indigo-600 to-purple-700 rounded-2xl p-8 text-white">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <Mail className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-indigo-200 text-sm">Email</p>
                      <p className="font-semibold">support@swiftdu.org</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                      <Shield className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-indigo-200 text-sm">Data Protection Officer</p>
                      <p className="font-semibold">Western Delta University, Oghara, Delta State</p>
                    </div>
                  </div>
                </div>
                <Link 
                  href="/contact-us"
                  className="inline-flex items-center gap-2 mt-6 px-6 py-3 bg-white text-indigo-600 rounded-xl font-semibold hover:bg-yellow-400 hover:text-indigo-900 transition-all"
                >
                  Contact Support <ChevronRight className="w-5 h-5" />
                </Link>
              </div>
            </PolicySection>
            
          </div>
        </FadeInWhenVisible>
      </main>
      
      {/* Back to Top */}
      <motion.button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        initial={{ opacity: 0 }}
        animate={{ opacity: scrollYProgress.get() > 0.2 ? 1 : 0 }}
        className="fixed bottom-8 right-8 w-12 h-12 bg-indigo-600 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-indigo-700 transition-colors z-50"
      >
        <ArrowUp className="w-5 h-5" />
      </motion.button>
      
    </div>
  );
}