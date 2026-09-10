import { calculateOrderPricing, CAFE_INQUIRY_EXTRA_FEE, RESTAURANT_MAX_PEOPLE } from './pricing'

export type CafeInquiryStatus = 'waiting_for_tasker' | 'tasker_assigned' | 'checking_cafe' | 'awaiting_customer_choice' | 'unavailable' | 'ready_for_payment' | 'completed'
export interface CafeOption { id: string; name: string; price: number }
export interface CafeSelection { itemId: string; name: string; price: number; quantity: number }
export interface CafeInquiryFields {
  cafeInquiryStatus?: CafeInquiryStatus
  cafeAvailableItems?: CafeOption[]
  cafeSelectedItems?: CafeSelection[]
  cafeOptionsVersion?: number
}
export const cafeStatusLabels: Record<CafeInquiryStatus, string> = {
  waiting_for_tasker: 'Finding a Tasker to check the cafe…',
  tasker_assigned: 'Tasker found. They will check the cafe.',
  checking_cafe: 'Your Tasker is checking what’s available.',
  awaiting_customer_choice: 'Here’s what they have.',
  unavailable: 'Nothing suitable is available right now.',
  ready_for_payment: 'Nice choice. Let’s finish your order.',
  completed: 'Delivered',
}

export function validateCafeOptions(input: unknown): Omit<CafeOption, 'id'>[] {
  if (!Array.isArray(input) || input.length < 1 || input.length > 40) throw new Error('Add 1 to 40 available items.')
  return input.map(item => {
    if (!item || typeof item.name !== 'string' || !item.name.trim() || item.name.trim().length > 100) throw new Error('Each item needs a name of up to 100 characters.')
    if (typeof item.price !== 'number' || !Number.isSafeInteger(item.price) || item.price <= 0 || item.price > 1000000) throw new Error('Enter a whole-naira price between 1 and 1,000,000.')
    return { name: item.name.trim(), price: item.price }
  })
}

export function calculateCafeSelection(options: CafeOption[], input: unknown, people: unknown, takeaway: unknown, discounted: boolean) {
  if (!Array.isArray(input) || !input.length || input.length > options.length) throw new Error('Choose at least one available item.')
  if (typeof people !== 'number' || !Number.isInteger(people) || people < 1 || people > RESTAURANT_MAX_PEOPLE) throw new Error('Choose a valid number of meals.')
  if (typeof takeaway !== 'number' || !Number.isInteger(takeaway) || takeaway < 0 || takeaway > people) throw new Error('Choose how many meals need takeaway packs.')
  const seen = new Set<string>()
  const selected = input.map(item => {
    const option = options.find(option => option.id === item?.itemId)
    if (!option || seen.has(option.id)) throw new Error('Choose each saved option only once.')
    seen.add(option.id)
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 20) throw new Error('Quantities must be between 1 and 20.')
    return { itemId: option.id, name: option.name, price: option.price, quantity: item.quantity } as CafeSelection
  })
  const foodAmount = selected.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const pricing = calculateOrderPricing({ taskType: 'restaurant', cafeInquiry: true, amount: foodAmount, restaurantPeopleCount: people, restaurantTakeawayCount: takeaway })
  return { selected, pricing, totalAmount: pricing.totalAmount - (discounted ? pricing.serviceFee - CAFE_INQUIRY_EXTRA_FEE : 0), packaging: takeaway === people ? 'Takeaway pack' : takeaway === 0 ? 'Cellophane' : `${takeaway} takeaway, ${people - takeaway} cellophane` }
}

export const CAFE_OPTIONS = [
    { value: '', label: 'Select a store...' },
    { value: 'tasker_choose', label: 'Help me choose / any open cafe' },
    { value: 'akpan', label: 'Akpan Store' },
    { value: 'mama', label: "Mama's Kitchen" },
    { value: 'golley', label: 'Golley Shop' },
  ]
export const getCafeLabel = (store?: string) => CAFE_OPTIONS.find(option => option.value === store)?.label || store || 'Cafe'
