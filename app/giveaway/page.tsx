import type { Metadata } from 'next'
import { GiveawayExperience } from '@/components/giveaway-wheel'

export const metadata: Metadata = { title: 'SwiftDU Week 1 Giveaway', description: 'Watch the SwiftDU Week 1 Giveaway live and see who becomes the Last Swifter Standing.', openGraph: { title: 'SwiftDU Week 1 Giveaway', description: 'Watch the SwiftDU Week 1 Giveaway live and see who becomes the Last Swifter Standing.', images: ['/opengraph-image.png'] } }
export default function GiveawayPage() { return <GiveawayExperience /> }
