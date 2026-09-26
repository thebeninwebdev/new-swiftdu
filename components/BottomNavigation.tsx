'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Bell,
  CircleUserRound,
  Clock3,
  Headphones,
  Home,
  ListTodo,
  LogOut,
  Menu,
  Power,
  UserRound,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useTaskerWork } from '@/components/tasker/WorkProvider'

import { authClient } from '@/lib/auth-client'

const spring = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 32,
  mass: 0.8,
}

type NavId = 'home' | 'tasks' | 'work' | 'history' | 'more'

interface NavItem {
  id: NavId
  label: string
  href?: string
  icon: LucideIcon
}

const navigation: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    href: '/tasker-dashboard',
    icon: Home,
  },
  {
    id: 'tasks',
    label: 'Tasks',
    href: '/tasker-dashboard?accepted=true',
    icon: ListTodo,
  },
  {
    id: 'work',
    label: 'Check in',
    icon: Power,
  },
  {
    id: 'history',
    label: 'History',
    href: '/tasker-dashboard/history',
    icon: Clock3,
  },
  {
    id: 'more',
    label: 'More',
    icon: Menu,
  },
]

const moreNavigation = [
  {
    label: 'Profile',
    href: '/tasker-dashboard/profile',
    icon: CircleUserRound,
  },
  {
    label: 'Notifications',
    href: '/tasker-dashboard/notifications',
    icon: Bell,
  },
  {
    label: 'Support',
    href: '/tasker-dashboard/support',
    icon: Headphones,
  },
  {
    label: 'User dashboard',
    href: '/dashboard',
    icon: UserRound,
  },
]

function getNotchPath(
  activeIndex: number,
  width = 500,
  height = 82
) {
  const itemWidth = width / navigation.length
  const center = itemWidth * activeIndex + itemWidth / 2

  // Width of the curved cut-out.
  const notchWidth = 84
  const notchDepth = 28

  const left = center - notchWidth / 2
  const right = center + notchWidth / 2

  /*
   * The SVG surface begins at y=0.
   *
   * The path creates:
   *
   * ───────╮       ╭───────
   *        ╰───────╯
   *
   * underneath the raised active button.
   */

  return `
    M 28 0

    L ${left - 18} 0

    C ${left - 7} 0,
      ${left - 7} ${notchDepth},
      ${left + 14} ${notchDepth}

    C ${left + 28} ${notchDepth},
      ${center - 30} ${notchDepth + 22},
      ${center} ${notchDepth + 22}

    C ${center + 30} ${notchDepth + 22},
      ${right - 28} ${notchDepth},
      ${right - 14} ${notchDepth}

    C ${right + 7} ${notchDepth},
      ${right + 7} 0,
      ${right + 18} 0

    L ${width - 28} 0

    Q ${width} 0 ${width} 28

    L ${width} ${height - 28}

    Q ${width} ${height} ${width - 28} ${height}

    L 28 ${height}

    Q 0 ${height} 0 ${height - 28}

    L 0 28

    Q 0 0 28 0

    Z
  `
}

export default function TaskerBottomNav() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()

  const [moreOpen, setMoreOpen] = useState(false)

  const work = useTaskerWork()
  const checkedIn = work.data?.checkedIn === true

  const accepted = searchParams.get('accepted')

  /*
   * Work out which navigation item corresponds to
   * the current Next.js route.
   */
  const routeActiveItem: NavId = useMemo(() => {
    if (moreOpen) {
      return 'more'
    }

    if (pathname.startsWith('/tasker-dashboard/history')) {
      return 'history'
    }

    if (
      pathname.startsWith('/tasker-dashboard/profile') ||
      pathname.startsWith('/tasker-dashboard/support') ||
      pathname.startsWith('/tasker-dashboard/notifications')
    ) {
      return 'more'
    }

    if (
      pathname === '/tasker-dashboard' &&
      accepted === 'true'
    ) {
      return 'tasks'
    }

    return 'home'
  }, [pathname, accepted, moreOpen])

  /*
   * Allows Check In to temporarily become the selected
   * animation when pressed.
   */
  const [interactionItem, setInteractionItem] =
    useState<NavId | null>(null)

  const activeItem = interactionItem ?? routeActiveItem

  const activeIndex = Math.max(
    0,
    navigation.findIndex((item) => item.id === activeItem)
  )

  const notchPath = useMemo(
    () => getNotchPath(activeIndex),
    [activeIndex]
  )

  const handleCheckIn = () => {
    if (work.loading || work.saving) return
    setMoreOpen(false)
    if (checkedIn || work.data?.status === 'busy') work.requestCheckout()
    else void work.checkIn()
  }

  const handleMore = () => {
    setInteractionItem(null)
    setMoreOpen((current) => !current)
  }

  const handleNavigate = () => {
    setInteractionItem(null)
    setMoreOpen(false)
  }

  const handleLogout = async () => {
    await authClient.signOut()
    setMoreOpen(false)
    router.push('/auth')
  }

  // Task details use a dedicated action bar and a focused work layout.
  if (/^\/tasker-dashboard\/[a-f\d]{24}$/i.test(pathname)) return null

  return (
    <>
      {/* =========================================
          MORE MENU BACKDROP
      ========================================== */}

      <AnimatePresence>
        {moreOpen && (
          <motion.button
            type="button"
            aria-label="Close menu"
            onClick={() => setMoreOpen(false)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="
              fixed inset-0 z-[60]
              bg-slate-950/25
              backdrop-blur-[2px]
              lg:hidden
            "
          />
        )}
      </AnimatePresence>

      {/* =========================================
          MORE MENU
      ========================================== */}

      <AnimatePresence>
        {moreOpen && (
          <motion.div
            initial={{
              opacity: 0,
              y: 30,
              scale: 0.96,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: 20,
              scale: 0.97,
            }}
            transition={spring}
            className="
              fixed inset-x-3 bottom-[108px]
              z-[70] mx-auto max-w-md
              rounded-[28px]
              border border-slate-200/80
              bg-white/95 p-3
              shadow-2xl
              backdrop-blur-xl
              dark:border-slate-800
              dark:bg-slate-950/95
              lg:hidden
            "
          >
            <div className="flex items-center justify-between px-3 py-2">
              <div>
                <p className="font-semibold text-slate-950 dark:text-white">
                  More
                </p>

                <p className="mt-0.5 text-xs text-slate-500">
                  Your Tasker account
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="
                  flex h-9 w-9
                  items-center justify-center
                  rounded-full
                  bg-slate-100
                  text-slate-600
                  transition
                  active:scale-90
                  dark:bg-slate-800
                  dark:text-slate-300
                "
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              {moreNavigation.map((item) => {
                const Icon = item.icon

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleNavigate}
                    className="
                      flex min-h-14
                      items-center gap-3
                      rounded-2xl
                      bg-slate-50 px-4
                      text-sm font-medium
                      text-slate-700
                      transition
                      active:scale-[0.97]
                      dark:bg-slate-900
                      dark:text-slate-200
                    "
                  >
                    <Icon className="h-5 w-5 shrink-0" />

                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="
                mt-2 flex h-12
                w-full items-center
                gap-3 rounded-2xl
                px-4 text-sm
                font-medium text-red-600
                transition
                active:scale-[0.98]
                hover:bg-red-50
                dark:hover:bg-red-950/30
              "
            >
              <LogOut className="h-5 w-5" />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* =========================================
          MOBILE BOTTOM NAVIGATION
      ========================================== */}

      <div
        className="
          pointer-events-none
          fixed inset-x-0 bottom-0
          z-50
          lg:hidden
        "
      >
        <div
          className="
            relative mx-auto
            h-[110px]
            w-full
            max-w-[500px]
            px-3
          "
        >
          {/* =====================================
              NAVIGATION SURFACE + MOVING NOTCH
          ====================================== */}

          <svg
            viewBox="0 0 500 82"
            preserveAspectRatio="none"
            aria-hidden="true"
            className="
              pointer-events-none
              absolute bottom-3
              left-3 right-3
              h-[82px]
              w-[calc(100%-24px)]
              overflow-visible
              drop-shadow-[0_12px_24px_rgba(15,23,42,0.14)]
            "
          >
            <motion.path
              initial={false}
              animate={{ d: notchPath }}
              transition={spring}
              fill="currentColor"
              className="
                text-white
                dark:text-slate-950
              "
            />
          </svg>

          {/* Subtle border over surface */}

          <div
            className="
              pointer-events-none
              absolute inset-x-3
              bottom-3 h-[82px]
              rounded-[28px]
              border border-slate-200/60
              dark:border-slate-800/70
            "
          />

          {/* =====================================
              NAV ITEMS
          ====================================== */}

          <nav
            aria-label="Tasker navigation"
            className="
              pointer-events-auto
              absolute inset-x-3
              bottom-3
              grid h-[82px]
              grid-cols-5
              px-1
            "
          >
            {navigation.map((item) => {
              const active = activeItem === item.id

              if (item.id === 'work') {
                return (
                  <NavButton
                    key={item.id}
                    item={{ ...item, label: work.data?.status === 'busy' ? 'Working' : checkedIn ? 'Check out' : 'Check in' }}
                    active={active}
                    checkedIn={checkedIn}
                    disabled={work.loading || work.saving || !work.data}
                    onClick={handleCheckIn}
                  />
                )
              }

              if (item.id === 'more') {
                return (
                  <NavButton
                    key={item.id}
                    item={item}
                    active={active}
                    onClick={handleMore}
                  />
                )
              }

              return (
                <NavLink
                  key={item.id}
                  item={item}
                  active={active}
                  onClick={handleNavigate}
                />
              )
            })}
          </nav>
        </div>
      </div>
    </>
  )
}

/* ============================================================
   STANDARD NAVIGATION LINK
============================================================ */

function NavLink({
  item,
  active,
  onClick,
}: {
  item: NavItem
  active: boolean
  onClick: () => void
}) {
  const Icon = item.icon

  return (
    <Link
      href={item.href!}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className="
        relative flex
        min-w-0
        items-center
        justify-center
      "
    >
      <motion.div
        initial={false}
        animate={{
          y: active ? -35 : 0,
        }}
        transition={spring}
        className="
          relative flex
          flex-col
          items-center
          justify-center
        "
      >
        {/* ACTIVE CIRCLE */}

        <AnimatePresence>
          {active && (
            <motion.span
              initial={{
                scale: 0.6,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              exit={{
                scale: 0.6,
                opacity: 0,
              }}
              transition={spring}
              className="
                absolute
                h-[58px] w-[58px]
                rounded-full
                bg-gradient-to-br
                from-indigo-600
                to-purple-600
                shadow-[0_8px_24px_rgba(124,58,237,0.32)]
              "
            />
          )}
        </AnimatePresence>

        {/* ICON */}

        <motion.div
          initial={false}
          animate={{
            scale: active ? 1.08 : 1,
          }}
          transition={spring}
          className="relative z-10"
        >
          <Icon
            className={`
              h-[22px] w-[22px]
              transition-colors duration-200

              ${
                active
                  ? 'text-white'
                  : 'text-slate-500 dark:text-slate-400'
              }
            `}
            strokeWidth={active ? 2.4 : 2}
          />
        </motion.div>

        {/* LABEL */}

        <motion.span
          initial={false}
          animate={{
            opacity: active ? 0 : 1,
            y: active ? 8 : 0,
          }}
          transition={{
            duration: 0.18,
          }}
          className="
            absolute top-7
            whitespace-nowrap
            text-[10px]
            font-medium
            text-slate-500
            dark:text-slate-400
          "
        >
          {item.label}
        </motion.span>
      </motion.div>
    </Link>
  )
}

/* ============================================================
   BUTTON NAVIGATION ITEM
   Used by CHECK IN and MORE
============================================================ */

function NavButton({
  item,
  active,
  checkedIn = false,
  onClick,
  disabled = false,
}: {
  item: NavItem
  active: boolean
  checkedIn?: boolean
  onClick: () => void
  disabled?: boolean
}) {
  const Icon = item.icon

  const isWork = item.id === 'work'

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isWork ? checkedIn : undefined}
      disabled={disabled}
      className="
        relative flex
        min-w-0
        items-center
        justify-center
      "
    >
      <motion.div
        initial={false}
        animate={{
          y: active ? -35 : 0,
        }}
        transition={spring}
        className="
          relative flex
          flex-col
          items-center
          justify-center
        "
      >
        {/* ACTIVE CIRCLE */}

        <AnimatePresence>
          {active && (
            <motion.span
              initial={{
                scale: 0.6,
                opacity: 0,
              }}
              animate={{
                scale: 1,
                opacity: 1,
              }}
              exit={{
                scale: 0.6,
                opacity: 0,
              }}
              transition={spring}
              className={`
                absolute
                h-[58px] w-[58px]
                rounded-full
                shadow-lg

                ${
                  isWork && checkedIn
                    ? `
                      bg-gradient-to-br
                      from-emerald-500
                      to-emerald-600
                      shadow-emerald-500/30
                    `
                    : `
                      bg-gradient-to-br
                      from-indigo-600
                      to-purple-600
                      shadow-purple-500/30
                    `
                }
              `}
            />
          )}
        </AnimatePresence>

        {/* ONLINE PULSE */}

        {isWork && checkedIn && active && (
          <motion.span
            initial={{ opacity: 0 }}
            animate={{
              opacity: [0, 0.35, 0],
              scale: [1, 1.35, 1.35],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeOut',
            }}
            className="
              absolute
              h-[58px] w-[58px]
              rounded-full
              bg-emerald-400
            "
          />
        )}

        {/* ICON */}

        <motion.div
          initial={false}
          animate={{
            scale: active ? 1.08 : 1,
            rotate:
              isWork && active && checkedIn
                ? [0, -6, 6, 0]
                : 0,
          }}
          transition={
            isWork && active && checkedIn
              ? {
                  scale: spring,
                  rotate: {
                    duration: 0.35,
                  },
                }
              : spring
          }
          className="relative z-10"
        >
          <Icon
            className={`
              h-[22px] w-[22px]
              transition-colors duration-200

              ${
                active
                  ? 'text-white'
                  : isWork && checkedIn
                    ? 'text-emerald-600'
                    : 'text-slate-500 dark:text-slate-400'
              }
            `}
            strokeWidth={active ? 2.5 : 2}
          />
        </motion.div>

        {/* LABEL */}

        <motion.span
          initial={false}
          animate={{
            opacity: active ? 0 : 1,
            y: active ? 8 : 0,
          }}
          transition={{
            duration: 0.18,
          }}
          className={`
            absolute top-7
            whitespace-nowrap
            text-[10px]
            font-medium

            ${
              isWork && checkedIn
                ? 'text-emerald-600'
                : 'text-slate-500 dark:text-slate-400'
            }
          `}
        >
          {item.label}
        </motion.span>
      </motion.div>
    </button>
  )
}
