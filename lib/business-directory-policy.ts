export const BUSINESS_CATEGORIES = [
  "Food & Drinks",
  "Fashion",
  "Hair & Beauty",
  "Photography & Media",
  "Printing",
  "Technology",
  "Phone/Laptop Services",
  "Laundry",
  "Academic/Tutoring Services",
  "Design",
  "Events",
  "Transportation",
  "Retail",
  "Professional Services",
  "Other",
] as const;

export const PROHIBITED_FLAGS = [
  "sexual_content",
  "sexual_services",
  "pornography",
  "illegal_drugs",
  "weapons_trafficking",
  "stolen_goods",
  "fraud",
  "phishing",
  "identity_theft",
  "investment_scam",
  "academic_cheating",
  "impersonation",
  "illegal_gambling",
  "hate_extremism",
  "illegal_activity",
  "spam",
] as const;

export const BUSINESS_POLICY = `Classify a WDU community business offering. Reject clear prostitution or paid sexual services, pornography, illegal drug/controlled-substance dealing, weapons/explosives trafficking, stolen goods, fraud/scams, phishing, identity theft, fake investments/get-rich-quick scams, academic cheating/exam malpractice, impersonation, illegal gambling, hate/extremist commercial services, primarily illegal activity, or obvious spam. Use the corresponding prohibited flag: ${PROHIBITED_FLAGS.join(", ")}.
Screen every submitted text field and the image, including text embedded in logos, for fraudulent offers and sexual content. Flag sexual_content for sexual acts, explicit nudity, erotic imagery or sexual solicitations; set imageSafe=false when the image contains these. Ordinary clothing, beauty products and non-sexual health information are not sexual content. Check fraud indicators such as requests for passwords or OTPs, deceptive impersonation, advance-fee scams and unrealistic guaranteed returns; use the corresponding fraud flags and set appearsGenuine=false when detected. Lack of external verification alone is not evidence of fraud.
Tutoring is allowed; selling exam answers, taking exams for others and academic cheating are not. Small businesses need no web presence or recognizable brand. Unusual categories alone are not grounds for rejection. Assess coherence and internal consistency, clear services, plausible contacts, and image relevance/safety. The image is a business/logo/product image, NOT identity evidence. Never identify people or use facial recognition. Never claim legal or identity verification. Approval is automatic when all checks pass. Use review for ambiguity; this prevents publication and asks the submitter to correct their listing rather than requesting human approval. Reasons must be short classification summaries, never chain-of-thought. Select a category from: ${BUSINESS_CATEGORIES.join(", ")}.`;

export const APPROVAL_CONFIDENCE = 0.85;
export const MAX_BUSINESS_IMAGE_BYTES = 2 * 1024 * 1024;
