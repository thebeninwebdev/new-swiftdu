export type FactCategory = 'study' | 'studentLife' | 'career' | 'productivity' | 'technology' | 'money' | 'swiftdu' | 'fun'

export interface StudentFact {
  id: string
  category: FactCategory
  text: string
}

export const STUDENT_FACTS: StudentFact[] = [
  {
    "id": "study-1",
    "category": "study",
    "text": "Testing yourself on what you learned can strengthen recall more than rereading notes alone."
  },
  {
    "id": "study-2",
    "category": "study",
    "text": "Explaining a topic to someone else can reveal which parts you still need to review."
  },
  {
    "id": "study-3",
    "category": "study",
    "text": "Spacing study sessions across several days can help information stick."
  },
  {
    "id": "study-4",
    "category": "study",
    "text": "Writing a short summary in your own words can show what you truly understand."
  },
  {
    "id": "study-5",
    "category": "study",
    "text": "Practice questions can help you notice gaps before an exam."
  },
  {
    "id": "study-6",
    "category": "study",
    "text": "Mixing related topics during practice can help you tell similar ideas apart."
  },
  {
    "id": "studentLife-1",
    "category": "studentLife",
    "text": "Preparing your bag the night before can make a busy morning easier."
  },
  {
    "id": "studentLife-2",
    "category": "studentLife",
    "text": "A short walk can provide a useful break between study sessions."
  },
  {
    "id": "studentLife-3",
    "category": "studentLife",
    "text": "Keeping important dates in one calendar can make deadlines easier to track."
  },
  {
    "id": "studentLife-4",
    "category": "studentLife",
    "text": "Sharing a study plan with a friend can make it easier to follow through."
  },
  {
    "id": "studentLife-5",
    "category": "studentLife",
    "text": "A tidy study space can make it easier to find what you need."
  },
  {
    "id": "studentLife-6",
    "category": "studentLife",
    "text": "Making time for meals and rest can help a packed day feel more manageable."
  },
  {
    "id": "career-1",
    "category": "career",
    "text": "A portfolio can show skills that may not be obvious from a CV alone."
  },
  {
    "id": "career-2",
    "category": "career",
    "text": "Small real-world projects give you examples to discuss in interviews."
  },
  {
    "id": "career-3",
    "category": "career",
    "text": "Keeping a record of your projects makes updating your CV easier."
  },
  {
    "id": "career-4",
    "category": "career",
    "text": "Asking someone about their work can help you explore a career path."
  },
  {
    "id": "career-5",
    "category": "career",
    "text": "A clear example often explains your skills better than a long list of adjectives."
  },
  {
    "id": "career-6",
    "category": "career",
    "text": "Volunteer work can provide practical experience to describe on applications."
  },
  {
    "id": "career-7",
    "category": "career",
    "text": "Reading a job description can show which skills you may want to practice."
  },
  {
    "id": "career-8",
    "category": "career",
    "text": "A short thank-you note after an interview can show appreciation for the conversation."
  },
  {
    "id": "career-9",
    "category": "career",
    "text": "Saving feedback on your work can help you describe how you improved."
  },
  {
    "id": "career-10",
    "category": "career",
    "text": "Trying different projects can help you discover what kind of work you enjoy."
  },
  {
    "id": "productivity-1",
    "category": "productivity",
    "text": "Breaking a large assignment into smaller steps can make it easier to begin."
  },
  {
    "id": "productivity-2",
    "category": "productivity",
    "text": "Choosing one next task can feel simpler than looking at an entire to-do list."
  },
  {
    "id": "productivity-3",
    "category": "productivity",
    "text": "Putting your phone out of reach can reduce interruptions while you focus."
  },
  {
    "id": "productivity-4",
    "category": "productivity",
    "text": "A brief plan at the start of a study session can help you use the time well."
  },
  {
    "id": "productivity-5",
    "category": "productivity",
    "text": "Finishing a small task first can help you build momentum."
  },
  {
    "id": "productivity-6",
    "category": "productivity",
    "text": "Taking a short break before returning to a difficult problem can offer a fresh view."
  },
  {
    "id": "technology-1",
    "category": "technology",
    "text": "Two-factor authentication adds a layer of protection beyond a password."
  },
  {
    "id": "technology-2",
    "category": "technology",
    "text": "Keeping copies of important files in two places can help if a device fails."
  },
  {
    "id": "technology-3",
    "category": "technology",
    "text": "Software updates often include security fixes."
  },
  {
    "id": "technology-4",
    "category": "technology",
    "text": "A password manager can help you use a different password for each account."
  },
  {
    "id": "technology-5",
    "category": "technology",
    "text": "Checking a link's destination before opening it can help you spot suspicious messages."
  },
  {
    "id": "technology-6",
    "category": "technology",
    "text": "Version history can help you recover an earlier draft of a document."
  },
  {
    "id": "technology-7",
    "category": "technology",
    "text": "Cloud sync is useful, but an additional backup can protect against accidental deletion."
  },
  {
    "id": "money-1",
    "category": "money",
    "text": "Writing down small expenses can make spending patterns easier to notice."
  },
  {
    "id": "money-2",
    "category": "money",
    "text": "A budget is a plan for your money, not a record of perfect behavior."
  },
  {
    "id": "money-3",
    "category": "money",
    "text": "Comparing the total cost can be more useful than comparing sticker prices alone."
  },
  {
    "id": "money-4",
    "category": "money",
    "text": "Setting aside money for an expected expense can make it easier to handle later."
  },
  {
    "id": "money-5",
    "category": "money",
    "text": "Keeping a receipt can help you check what you paid or resolve a mistake."
  },
  {
    "id": "swiftdu-1",
    "category": "swiftdu",
    "text": "SwiftDU connects students who need help with taskers available to help."
  },
  {
    "id": "swiftdu-2",
    "category": "swiftdu",
    "text": "A SwiftDU inquiry helps you connect with a tasker to discuss details directly."
  },
  {
    "id": "swiftdu-3",
    "category": "swiftdu",
    "text": "SwiftDU taskers are students too, and requests can create opportunities to earn."
  },
  {
    "id": "swiftdu-4",
    "category": "swiftdu",
    "text": "You can cancel a pending task while SwiftDU is still looking for a tasker."
  },
  {
    "id": "swiftdu-5",
    "category": "swiftdu",
    "text": "Once a tasker accepts, the tracking page updates with the next step."
  },
  {
    "id": "fun-1",
    "category": "fun",
    "text": "An octopus has three hearts."
  },
  {
    "id": "fun-2",
    "category": "fun",
    "text": "A day on Venus is longer than its year."
  },
  {
    "id": "fun-3",
    "category": "fun",
    "text": "The smallest bones in the human body are in the ear."
  },
  {
    "id": "fun-4",
    "category": "fun",
    "text": "Bananas are berries in botanical terms, but strawberries are not."
  }
]
