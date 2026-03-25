"use client"

import { useRouter } from "next/navigation"

export default function SignUpPage() {
    const router = useRouter()
  return (
    <div className='relative min-h-screen overflow-hidden font-sans'>
        <div className="absolute inset-0 bg-[url('/tasker-signup.jpg')] bg-cover bg-[position:30%_0%]" />
        <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/40 to-black/10" />
        <div 
            className='absolute inset-0 opacity-20 pointer-events-none'
                    style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px',
        }}
        />
        <div className="relative z-10 flex flex-col justify-between min-h-screen px-6 pt-14 pb-10">
            <div className='flex items-center gap-2'>
                <div className='h-px w-6 bg-white/50'/>
                <span  className='text-white/80 font-bold tracking-[0.25rem] uppercase'
                    style={{fontFamily: "'DM Mono', monospace"}}
                    >
                        Swift Du
                    </span>
            </div>
            <div className='flex flex-col gap-4'>
                <div className='inline-flex items-center gap-2 w-fit'>
                    <span className='block w-2 h-2 rounded-full bg-emerald-400 animate-pulse'/>
                    <span 
                        className='text-emerald-400 text-xs tracking-widest uppercase'
                        style={{fontFamily: "'DM Mono', monospace"}}
                        >
                            Now Accepting Taskers
                        </span>
                </div>
                <h1 className='text-white leading-none'
                 style={{
                    fontFamily: "'Playfair Display', Georgia, serif",
                    fontSize: 'clamp(3rem, 14vw, 5.5rem)',
                    fontWeight: 800,
                    letterSpacing: "-0.02em",
                 }}>
                    Be your <br/>
                    <span 
                        className='italic'
                        style={{color: 'transparent', WebkitTextStroke: '1.5px white'}}>
                            own boss.
                        </span>
                 </h1>
                 <p className='text-white/60 text-base leading-relaxed max-w-xs'
                 style={{fontFamily: "'DM Sans', sans-serif"}}
                 >
                    Join Tasker and earn money on your terms - flexible hours, real income, full control.
                 </p>
            </div>
            <div className='flex flex-col gap-4'>
                <button className='group relative w-full max-w-sm py-4 rounded-xl overflow-hidden font-semibold text-base tracking-wide transition-all duration-300 active:scale-95'
                onClick={() => router.push("/tasker-signup/signup")}
                style={{
                    fontFamily: "'DM Sans', sans-serif",
                    background: 'white',
                    color: "#0a0a0a"
                }}>
                    <span className='relative z-10 flex items-center justify-center gap-2'>
                        Get Started
                        <svg
                        className='w-4 h-4 transition-transform duration-300 group-hover:translate-x-1'
                        fill="none"
                        stroke='currentColor'
                        viewBox='0 0 24 24'
                        >
                            <path strokeLinecap="round" strokeLinejoin='round' strokeWidth={2} d='M17 814 4m0 0l-4 4m4-4H3' />
                        </svg>
                    </span>
                </button>
                <p className='text-white/30 text-xs text-center'
                style={{fontFamily: "'DM Mono', monospace"}}
                >
                    Free to join - No commitment
                </p>
            </div>
        </div>
    </div>
  )
}
