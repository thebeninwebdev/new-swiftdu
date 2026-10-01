'use client'

export type PendingTaskerApplicationPdfItem = {
  name: string
  email: string
  phone: string
  location: string
  studentId: string
  level?: string
  availability?: string[]
  motivation?: string
  motivationOther?: string
  createdAt: string
}

export async function downloadPendingTaskerApplicationsPdf(
  applications: PendingTaskerApplicationPdfItem[]
) {
  const { jsPDF } = await import('jspdf')
  const document = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = document.internal.pageSize.getWidth()
  const pageHeight = document.internal.pageSize.getHeight()
  const margin = 16
  const contentWidth = pageWidth - margin * 2
  let y = 18

  const addFooter = () => {
    document.setFontSize(8)
    document.setTextColor(100)
    document.text(
      `SwiftDU - Pending tasker applications - Page ${document.getNumberOfPages()}`,
      margin,
      pageHeight - 10
    )
  }

  const ensureSpace = (height: number) => {
    if (y + height <= pageHeight - 18) return
    addFooter()
    document.addPage()
    y = 18
  }

  document.setFont('helvetica', 'bold')
  document.setFontSize(18)
  document.setTextColor(48, 32, 113)
  document.text('Pending Tasker Applications', margin, y)
  y += 8
  document.setFont('helvetica', 'normal')
  document.setFontSize(10)
  document.setTextColor(70)
  document.text(`Generated ${new Date().toLocaleString('en-GB')} - ${applications.length} application${applications.length === 1 ? '' : 's'}`, margin, y)
  y += 10

  applications.forEach((application, index) => {
    const motivation = application.motivation === 'Other'
      ? application.motivationOther || 'Other'
      : application.motivation || 'Not provided'
    const rows = [
      ['Email', application.email || 'Not provided'],
      ['Phone', application.phone || 'Not provided'],
      ['Location', application.location || 'Not provided'],
      ['Matric number', application.studentId || 'Not provided'],
      ['Level', application.level || 'Not provided'],
      ['Availability', application.availability?.join(', ') || 'Not provided'],
      ['Why SwiftDU', motivation],
      ['Applied', new Date(application.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })],
    ] as const
    const rowLines = rows.map(([label, value]) => ({ label, lines: document.splitTextToSize(String(value), contentWidth - 37) }))
    const entryHeight = 12 + rowLines.reduce((total, row) => total + Math.max(5, row.lines.length * 4.4), 0) + 6
    ensureSpace(entryHeight)

    document.setFillColor(246, 243, 255)
    document.roundedRect(margin, y, contentWidth, entryHeight, 3, 3, 'F')
    document.setFont('helvetica', 'bold')
    document.setFontSize(12)
    document.setTextColor(48, 32, 113)
    document.text(`${index + 1}. ${application.name || 'Tasker applicant'}`, margin + 5, y + 8)
    y += 14

    rowLines.forEach(({ label, lines }) => {
      document.setFont('helvetica', 'bold')
      document.setFontSize(9)
      document.setTextColor(75)
      document.text(`${label}:`, margin + 5, y)
      document.setFont('helvetica', 'normal')
      document.setTextColor(25)
      document.text(lines, margin + 32, y)
      y += Math.max(5, lines.length * 4.4)
    })
    y += 6
  })

  addFooter()
  document.save(`swiftdu-pending-tasker-applications-${new Date().toISOString().slice(0, 10)}.pdf`)
}
