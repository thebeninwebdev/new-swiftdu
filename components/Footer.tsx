import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

const footerGroups = [
  { title: "Community", links: [{ label: "About SwiftDU", href: "/about-us" }, { label: "Student reviews", href: "/reviews" }, { label: "Contact us", href: "/contact-us" }] },
  { title: "Get started", links: [{ label: "Join SwiftDU", href: "/auth" }, { label: "Become a Swifter", href: "/tasker-signup" }, { label: "Log in", href: "/auth" }] },
  { title: "Services", links: [{ label: "Post a task", href: "/auth" }, { label: "Available tasks", href: "/available-tasks" }, { label: "Dry cleaning", href: "/dry-cleaner-signup" }] },
  { title: "Legal", links: [{ label: "Terms & conditions", href: "/terms" }] },
];

export const Footer = () => (
  <footer className="bg-[#0a102b] text-white">
    <div className="mx-auto max-w-7xl px-5 py-14 sm:px-8 lg:px-10 lg:py-16">
      <div className="grid gap-12 border-b border-white/10 pb-12 lg:grid-cols-[1.25fr_2fr]">
        <div>
          <Link href="/" className="inline-flex rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">
            <Image src="/logo.png?v=20260826" alt="SwiftDU" width={342} height={63} className="h-10 w-auto object-contain brightness-0 invert" />
          </Link>
          <p className="mt-5 max-w-sm text-sm leading-6 text-slate-400">Building a stronger campus through support, opportunity and community.</p>
          <div className="mt-6 space-y-3 text-sm text-slate-400">
            <p className="flex items-center gap-3"><MapPin className="h-4 w-4 text-violet-400" />Western Delta University, Oghara</p>
            <a href="mailto:info@swifdu.org" className="flex w-fit items-center gap-3 transition hover:text-white"><Mail className="h-4 w-4 text-violet-400" />info@swifdu.org</a>
            <a href="tel:+2349014116505" className="flex w-fit items-center gap-3 transition hover:text-white"><Phone className="h-4 w-4 text-violet-400" />0901 411 6505</a>
          </div>
        </div>
        <nav aria-label="Footer navigation" className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {footerGroups.map((group) => <div key={group.title}><h2 className="text-xs font-bold uppercase tracking-[0.16em]">{group.title}</h2><ul className="mt-5 space-y-3">{group.links.map((link) => <li key={link.label}><Link href={link.href} className="text-sm text-slate-400 transition hover:text-violet-300 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400">{link.label}</Link></li>)}</ul></div>)}
        </nav>
      </div>
      <div className="flex flex-col gap-5 pt-7 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} SwiftDU. All rights reserved.</p>
        <p>Built for students at Western Delta University.</p>
      </div>
    </div>
  </footer>
);
