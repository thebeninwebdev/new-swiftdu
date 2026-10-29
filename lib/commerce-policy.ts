export type CommercePolicyInput = {
  taskType?: string | null
  description?: string | null
  vendorName?: string | null
  otherRelevantText?: string | null
}

export type CommercePolicyResult = {
  allowed: boolean
  reason?: string
  category?: string
}

const restrictedPatterns: Array<{ category: string; pattern: RegExp }> = [
  { category: 'alcohol', pattern: /\b(?:alcohol|beer|beers|whisky|whiskey|wine|vodka|gin|rum|champagne|liquor|spirits|stout|lager|cider)\b/i },
  { category: 'tobacco', pattern: /\b(?:cigarette|cigarettes|cigar|cigars|tobacco|nicotine|vape|vapes|vaping|e-cigarette|shisha|hookah)\b/i },
  { category: 'controlled-drugs', pattern: /\b(?:cocaine|heroin|meth|marijuana|cannabis|weed|crack|opioid|controlled\s+drug|recreational\s+drug)\b/i },
  { category: 'medical-products', pattern: /\b(?:prescription|pharmacy|medical\s+(?:product|suppl(?:y|ies))|prescription\s+(?:drug|medicine|medication)|tramadol|antibiotic)\b/i },
  { category: 'weapons', pattern: /\b(?:firearm|firearms|gun|guns|pistol|rifle|ammunition|ammo|weapon|weapons|explosive|explosives|firework|fireworks)\b/i },
  { category: 'gambling', pattern: /\b(?:gambling|casino|betting|sportsbook|lottery|wager|wagering)\b/i },
  { category: 'adult-products', pattern: /\b(?:sex\s+toy|adult\s+toy|pornograph(?:y|ic)|adult\s+product)\b/i },
  { category: 'stolen-or-counterfeit-goods', pattern: /\b(?:stolen|counterfeit|fake\s+(?:brand|designer|goods)|knock[-\s]?off)\b/i },
]

export function validateOrderAgainstCommercePolicy(input: CommercePolicyInput): CommercePolicyResult {
  const text = [input.taskType, input.description, input.vendorName, input.otherRelevantText]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .trim()

  const match = restrictedPatterns.find(({ pattern }) => pattern.test(text))
  return match
    ? { allowed: false, category: match.category, reason: 'SwiftDU can’t purchase or deliver regulated or restricted items. Please remove the restricted item from your order.' }
    : { allowed: true }
}
