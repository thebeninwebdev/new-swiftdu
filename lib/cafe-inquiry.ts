export type CafeInquiryStatus = 'waiting_for_tasker' | 'tasker_assigned' | 'checking_cafe' | 'awaiting_customer_choice' | 'unavailable' | 'ready_for_payment' | 'completed'
export interface CafeOption { id: string; name: string; price: number; unit?: string }
export interface CafeSelection { itemId: string; name: string; price: number; quantity: number; unit?: string }
export interface CafeInquiryFields {
  cafeInquiryStatus?: CafeInquiryStatus
  cafeAvailableItems?: CafeOption[]
  cafeSelectedItems?: CafeSelection[]
  cafeOptionsVersion?: number
}
export const cafeStatusLabels: Record<CafeInquiryStatus, string> = {
  waiting_for_tasker: 'Finding a Tasker to check the cafe…',
  tasker_assigned: 'Tasker found. They will check the cafe.',
  checking_cafe: 'Your Tasker is at the cafe.',
  awaiting_customer_choice: 'Cafe check details are on WhatsApp.',
  unavailable: 'Cafe check details are on WhatsApp.',
  ready_for_payment: 'Cafe check details are on WhatsApp.',
  completed: 'Cafe inquiry completed',
}

export function canPayCafeInquiry(status: CafeInquiryStatus | undefined) {
  return status === 'checking_cafe' || status === 'ready_for_payment'
}

export const CAFE_OPTIONS = [
  { value: '', label: 'Select a store...' },
  { value: 'tasker_choose', label: 'Help me choose / any open cafe' },
  { value: 'akpan', label: 'Akpan Store' },
  { value: 'mama', label: "Mama's Kitchen" },
  { value: 'golley', label: 'Golley Shop' },
]
export const getCafeLabel = (store?: string) => CAFE_OPTIONS.find(option => option.value === store)?.label || store || 'Cafe'