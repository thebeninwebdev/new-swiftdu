export type SwiftyMood = 'idle' | 'thinking' | 'searching' | 'matched' | 'moving' | 'success' | 'warning' | 'error'
export type SwiftyInteraction = 'rest' | 'greet' | 'acknowledge' | 'consider' | 'guide' | 'check' | 'scan' | 'celebrate' | 'travel' | 'complete' | 'attention' | 'apologize'

export const SWIFTY_ASSETS = {
  idle: '/mascot/idle.png', thinking: '/mascot/thinking.png', searching: '/mascot/searching.png', matched: '/mascot/matched.png',
  moving: '/mascot/moving.png', success: '/mascot/success.png', warning: '/mascot/warning.png', error: '/mascot/error.png',
} satisfies Record<SwiftyMood, string>

export const SWIFTY_ALT: Record<SwiftyMood, string> = {
  idle: 'Swifty welcoming you', thinking: 'Swifty considering your order', searching: 'Swifty looking for a Tasker',
  matched: 'Swifty celebrating a Tasker match', moving: 'Swifty helping your order on its way',
  success: 'Swifty celebrating your completed order', warning: 'Swifty asking for your attention', error: 'Swifty calmly explaining an error',
}

export const SWIFTY_SIZES = { sm: 'h-16 w-16 sm:h-18 sm:w-18', md: 'h-24 w-24 sm:h-28 sm:w-28', lg: 'h-32 w-32 sm:h-36 sm:w-36' } as const
