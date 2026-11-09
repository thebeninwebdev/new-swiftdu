'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import { toast } from 'sonner'
import {
  MessageSquareQuote,
  Plus,
  ArrowUp,
  ArrowDown,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Sparkles,
  Info,
  DollarSign,
  Truck,
  HelpCircle,
  Eye,
  AlertTriangle,
  Loader2,
  ChevronRight,
  Search,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  ALLOWED_VARIABLES,
  validateTemplateBody,
  renderTemplate,
} from '@/lib/whatsapp/message-templates'
import type { MessageCategory, MessagePaymentType } from '@/models/message-template'

interface Template {
  _id: string
  title: string
  description: string
  category: MessageCategory
  body: string
  orderTypes: string[]
  applicableStates: string[]
  requiresPaymentVerification: boolean
  paymentType: MessagePaymentType
  displayOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

const CATEGORY_META: Record<
  MessageCategory,
  { label: string; bg: string; text: string; icon: any }
> = {
  intro: {
    label: 'Introduction',
    bg: 'bg-violet-100 dark:bg-violet-950/60',
    text: 'text-violet-700 dark:text-violet-300',
    icon: Sparkles,
  },
  payment: {
    label: 'Payment Request',
    bg: 'bg-emerald-100 dark:bg-emerald-950/60',
    text: 'text-emerald-700 dark:text-emerald-300',
    icon: DollarSign,
  },
  update: {
    label: 'Order Update',
    bg: 'bg-sky-100 dark:bg-sky-950/60',
    text: 'text-sky-700 dark:text-sky-300',
    icon: Info,
  },
  delivery: {
    label: 'Delivery & Arrival',
    bg: 'bg-amber-100 dark:bg-amber-950/60',
    text: 'text-amber-700 dark:text-amber-300',
    icon: Truck,
  },
  unavailable: {
    label: 'Item Unavailable',
    bg: 'bg-rose-100 dark:bg-rose-950/60',
    text: 'text-rose-700 dark:text-rose-300',
    icon: AlertTriangle,
  },
  clarification: {
    label: 'Clarification',
    bg: 'bg-indigo-100 dark:bg-indigo-950/60',
    text: 'text-indigo-700 dark:text-indigo-300',
    icon: HelpCircle,
  },
  general: {
    label: 'General',
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-700 dark:text-slate-300',
    icon: MessageSquareQuote,
  },
}

const ORDER_TYPE_OPTIONS = [
  { value: 'all', label: 'All Order Types' },
  { value: 'normal', label: 'Normal Orders' },
  { value: 'inquiry', label: 'Inquiry Orders' },
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'indomie', label: 'Indomie' },
  { value: 'water', label: 'Water' },
  { value: 'printing', label: 'Printing' },
  { value: 'copy_notes', label: 'Copy Notes' },
  { value: 'dry_cleaning', label: 'Dry Cleaning' },
]

const APPLICABLE_STATE_OPTIONS = [
  { value: 'all', label: 'All States' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'checking_cafe', label: 'Checking Cafe (Inquiry)' },
  { value: 'awaiting_customer_choice', label: 'Awaiting Choice (Inquiry)' },
  { value: 'ready_for_payment', label: 'Ready for Payment (Inquiry)' },
  { value: 'completed', label: 'Completed' },
]

export default function MessageTemplatesAdminPage() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [activeFilter, setActiveFilter] = useState<string>('all')

  // Editor Dialog State
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [saving, setSaving] = useState(false)

  // Delete Confirmation State
  const [deleteTarget, setDeleteTarget] = useState<Template | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'general' as MessageCategory,
    body: '',
    orderTypes: ['all'] as string[],
    applicableStates: ['all'] as string[],
    requiresPaymentVerification: false,
    paymentType: 'none' as MessagePaymentType,
    isActive: true,
  })

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const loadTemplates = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/message-templates', { cache: 'no-store' })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to fetch message templates')
      }
      const data = await res.json()
      setTemplates(data.templates || [])
    } catch (err: any) {
      toast.error(err.message || 'Error loading templates')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTemplates()
  }, [])

  const openCreateDialog = () => {
    setEditingTemplate(null)
    setFormData({
      title: '',
      description: '',
      category: 'general',
      body: 'Hello {{customerName}}! 👋\n\nI am your SwiftDU tasker for order #{{orderNumber}}.\n\nThank you for choosing SwiftDU! 💜',
      orderTypes: ['all'],
      applicableStates: ['all'],
      requiresPaymentVerification: false,
      paymentType: 'none',
      isActive: true,
    })
    setEditorOpen(true)
  }

  const openEditDialog = (tmpl: Template) => {
    setEditingTemplate(tmpl)
    setFormData({
      title: tmpl.title,
      description: tmpl.description,
      category: tmpl.category,
      body: tmpl.body,
      orderTypes: tmpl.orderTypes && tmpl.orderTypes.length > 0 ? tmpl.orderTypes : ['all'],
      applicableStates: tmpl.applicableStates && tmpl.applicableStates.length > 0 ? tmpl.applicableStates : ['all'],
      requiresPaymentVerification: Boolean(tmpl.requiresPaymentVerification),
      paymentType: tmpl.paymentType || 'none',
      isActive: Boolean(tmpl.isActive),
    })
    setEditorOpen(true)
  }

  const insertVariable = (variableKey: string) => {
    const textarea = textareaRef.current
    const placeholder = `{{${variableKey}}}`
    if (!textarea) {
      setFormData((prev) => ({ ...prev, body: prev.body + placeholder }))
      return
    }

    const start = textarea.selectionStart ?? prevBodyLength()
    const end = textarea.selectionEnd ?? prevBodyLength()
    const current = formData.body
    const nextBody = current.substring(0, start) + placeholder + current.substring(end)

    setFormData((prev) => ({ ...prev, body: nextBody }))

    // Restore cursor position
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length)
    }, 0)
  }

  const prevBodyLength = () => formData.body.length

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.title.trim()) {
      toast.error('Title is required')
      return
    }
    if (!formData.description.trim()) {
      toast.error('Description is required')
      return
    }
    if (!formData.body.trim()) {
      toast.error('Message body is required')
      return
    }

    const validation = validateTemplateBody(formData.body)
    if (!validation.valid) {
      toast.error(validation.errors[0] || 'Template has invalid placeholders')
      return
    }

    setSaving(true)
    try {
      const url = editingTemplate
        ? `/api/admin/message-templates/${editingTemplate._id}`
        : '/api/admin/message-templates'
      const method = editingTemplate ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save template')
      }

      toast.success(editingTemplate ? 'Template updated!' : 'Template created!')
      setEditorOpen(false)
      await loadTemplates()
    } catch (err: any) {
      toast.error(err.message || 'Error saving template')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/admin/message-templates/${deleteTarget._id}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete template')
      }
      toast.success('Template deleted')
      setDeleteTarget(null)
      await loadTemplates()
    } catch (err: any) {
      toast.error(err.message || 'Error deleting template')
    } finally {
      setDeleting(false)
    }
  }

  const toggleActiveStatus = async (tmpl: Template) => {
    const nextState = !tmpl.isActive
    // Optimistic update
    setTemplates((prev) =>
      prev.map((t) => (t._id === tmpl._id ? { ...t, isActive: nextState } : t))
    )

    try {
      const res = await fetch(`/api/admin/message-templates/${tmpl._id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: nextState }),
      })
      if (!res.ok) {
        throw new Error('Failed to toggle status')
      }
      toast.success(nextState ? 'Template activated' : 'Template deactivated')
    } catch (err) {
      // Revert on failure
      setTemplates((prev) =>
        prev.map((t) => (t._id === tmpl._id ? { ...t, isActive: tmpl.isActive } : t))
      )
      toast.error('Could not update status')
    }
  }

  const moveTemplate = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= templates.length) return

    const reordered = [...templates]
    const [moved] = reordered.splice(index, 1)
    reordered.splice(targetIndex, 0, moved)

    // Reassign displayOrder sequentially
    const updatedWithOrder = reordered.map((t, idx) => ({
      ...t,
      displayOrder: idx + 1,
    }))

    setTemplates(updatedWithOrder)

    try {
      const res = await fetch('/api/admin/message-templates/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateIds: updatedWithOrder.map((t) => t._id),
        }),
      })
      if (!res.ok) {
        throw new Error('Failed to save template order')
      }
      toast.success('Display order saved')
    } catch (err) {
      toast.error('Failed to save reordering')
      await loadTemplates()
    }
  }

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (categoryFilter === 'payment' && t.category !== 'payment') return false
      if (categoryFilter === 'delivery' && t.category !== 'delivery') return false
      if (categoryFilter === 'normal' && !t.orderTypes.includes('all') && !t.orderTypes.includes('normal')) return false
      if (categoryFilter === 'inquiry' && !t.orderTypes.includes('all') && !t.orderTypes.includes('inquiry')) return false
      if (categoryFilter !== 'all' && categoryFilter !== 'normal' && categoryFilter !== 'inquiry' && categoryFilter !== 'payment' && categoryFilter !== 'delivery') {
        if (t.category !== categoryFilter) return false
      }

      if (activeFilter === 'active' && !t.isActive) return false
      if (activeFilter === 'inactive' && t.isActive) return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchesTitle = t.title.toLowerCase().includes(q)
        const matchesDesc = t.description.toLowerCase().includes(q)
        const matchesBody = t.body.toLowerCase().includes(q)
        if (!matchesTitle && !matchesDesc && !matchesBody) return false
      }

      return true
    })
  }, [templates, categoryFilter, activeFilter, searchQuery])

  // Live preview for form
  const sampleRenderedMessage = useMemo(() => {
    return renderTemplate(formData.body, {}, true)
  }, [formData.body])

  const formValidation = useMemo(() => {
    return validateTemplateBody(formData.body)
  }, [formData.body])

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
      {/* Header */}
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold text-violet-700 dark:text-violet-400">
            <span>Operations</span>
            <ChevronRight className="h-4 w-4" />
            <span>Customer Communication</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Message Templates
          </h1>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
            Manage official pre-written WhatsApp messages for taskers. Changes sync immediately.
          </p>
        </div>
        <Button
          onClick={openCreateDialog}
          className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-violet-700 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" />
          Create Template
        </Button>
      </header>

      {/* Filters Bar */}
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search templates by title, description or content..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {/* Category Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5">
          {[
            { id: 'all', label: 'All' },
            { id: 'normal', label: 'Normal Orders' },
            { id: 'inquiry', label: 'Inquiry Orders' },
            { id: 'payment', label: 'Payment Requests' },
            { id: 'delivery', label: 'Delivery' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryFilter(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                categoryFilter === tab.id
                  ? 'bg-violet-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Active Toggle Filter */}
        <div className="flex items-center gap-1 border-t border-slate-100 pt-3 dark:border-slate-800 sm:border-0 sm:pt-0">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              activeFilter === 'all'
                ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            All ({templates.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('active')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              activeFilter === 'active'
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                : 'text-slate-500 hover:text-emerald-700'
            }`}
          >
            Active ({templates.filter((t) => t.isActive).length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('inactive')}
            className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
              activeFilter === 'inactive'
                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                : 'text-slate-500 hover:text-rose-700'
            }`}
          >
            Inactive ({templates.filter((t) => !t.isActive).length})
          </button>
        </div>
      </div>

      {/* Templates List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600" />
          <p className="mt-3 text-sm">Loading message templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
          <MessageSquareQuote className="mx-auto h-12 w-12 text-slate-400" />
          <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
            No templates found
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {searchQuery
              ? 'Try modifying your search or filter criteria.'
              : 'Create your first official SwiftDU message template.'}
          </p>
          <Button onClick={openCreateDialog} className="mt-5 rounded-xl bg-violet-600 text-white">
            Create Template
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTemplates.map((template, idx) => {
            const meta = CATEGORY_META[template.category] || CATEGORY_META.general
            const CategoryIcon = meta.icon
            const isFirst = idx === 0
            const isLast = idx === filteredTemplates.length - 1

            return (
              <div
                key={template._id}
                className={`group relative overflow-hidden rounded-3xl border bg-white p-5 shadow-sm transition-all hover:shadow-md dark:bg-slate-900 ${
                  template.isActive
                    ? 'border-slate-200/90 dark:border-slate-800'
                    : 'border-slate-200/60 bg-slate-50/50 opacity-75 dark:border-slate-800/60 dark:bg-slate-950/40'
                }`}
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  {/* Left: Info */}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {template.displayOrder}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${meta.bg} ${meta.text}`}
                      >
                        <CategoryIcon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                      {template.isActive ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          <XCircle className="h-3 w-3" />
                          Inactive
                        </span>
                      )}
                      {template.requiresPaymentVerification && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                          <DollarSign className="h-3 w-3" />
                          Payment Verified ({template.paymentType})
                        </span>
                      )}
                    </div>

                    <h3 className="mt-2 text-lg font-bold text-slate-900 dark:text-white">
                      {template.title}
                    </h3>
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                      {template.description}
                    </p>

                    {/* Order types badges */}
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {template.orderTypes.map((type) => (
                        <span
                          key={type}
                          className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        >
                          {ORDER_TYPE_OPTIONS.find((o) => o.value === type)?.label || type}
                        </span>
                      ))}
                    </div>

                    {/* Preview Bubble */}
                    <div className="mt-4 rounded-2xl bg-slate-50 p-3.5 dark:bg-slate-800/60">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Live Preview (Sample Data)
                      </p>
                      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                        {renderTemplate(template.body, {}, true)}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-row items-center gap-1 sm:flex-col sm:items-end">
                    {/* Move Up / Down */}
                    <div className="flex items-center gap-1 rounded-xl border border-slate-200 p-1 dark:border-slate-800">
                      <button
                        type="button"
                        aria-label="Move template up"
                        disabled={isFirst}
                        onClick={() => moveTemplate(idx, 'up')}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                      >
                        <ArrowUp className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Move template down"
                        disabled={isLast}
                        onClick={() => moveTemplate(idx, 'down')}
                        className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                      >
                        <ArrowDown className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="mt-2 flex items-center gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleActiveStatus(template)}
                        className="h-8 rounded-xl text-xs font-semibold"
                      >
                        {template.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(template)}
                        className="h-8 rounded-xl text-xs font-semibold"
                      >
                        <Edit2 className="mr-1 h-3.5 w-3.5" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteTarget(template)}
                        className="h-8 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:hover:bg-rose-950/40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-3xl p-6 sm:p-8">
          <DialogHeader>
            <DialogTitle className="text-xl font-extrabold text-slate-900 dark:text-white">
              {editingTemplate ? 'Edit Message Template' : 'Create Message Template'}
            </DialogTitle>
            <DialogDescription className="text-sm text-slate-500">
              Configure template content, authorized variables, and applicability rules.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="mt-4 space-y-5">
            {/* Title & Category Row */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Template Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Introduce Yourself"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value as MessageCategory })
                  }
                  className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="intro">Introduction</option>
                  <option value="payment">Payment Request</option>
                  <option value="update">Order Update</option>
                  <option value="delivery">Delivery & Arrival</option>
                  <option value="unavailable">Item Unavailable</option>
                  <option value="clarification">Clarification</option>
                  <option value="general">General</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Short Description *
              </label>
              <input
                type="text"
                required
                placeholder="Brief explanation shown to taskers when selecting this card"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3.5 text-sm text-slate-900 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* Order Types */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                Applicable Order Types
              </label>
              <p className="mt-0.5 text-xs text-slate-400">
                Choose which order categories should show this message card.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {ORDER_TYPE_OPTIONS.map((opt) => {
                  const isSelected = formData.orderTypes.includes(opt.value)
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => {
                        let nextTypes: string[]
                        if (opt.value === 'all') {
                          nextTypes = ['all']
                        } else {
                          const withoutAll = formData.orderTypes.filter((x) => x !== 'all')
                          if (isSelected) {
                            nextTypes = withoutAll.filter((x) => x !== opt.value)
                            if (nextTypes.length === 0) nextTypes = ['all']
                          } else {
                            nextTypes = [...withoutAll, opt.value]
                          }
                        }
                        setFormData({ ...formData, orderTypes: nextTypes })
                      }}
                      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors ${
                        isSelected
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Payment Policy Controls */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-800/40">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.requiresPaymentVerification}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      requiresPaymentVerification: e.target.checked,
                      paymentType: e.target.checked
                        ? formData.paymentType === 'none'
                          ? 'total'
                          : formData.paymentType
                        : 'none',
                    })
                  }
                  className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="text-sm font-bold text-slate-900 dark:text-white">
                  Requires Server-Verified Outstanding Payment
                </span>
              </label>
              <p className="mt-1 text-xs text-slate-500 pl-7">
                Under SwiftDU policy, this message will ONLY appear if payment is actually verified as outstanding.
              </p>

              {formData.requiresPaymentVerification && (
                <div className="mt-3 pl-7">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Payment Type to Verify
                  </label>
                  <select
                    value={formData.paymentType}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        paymentType: e.target.value as MessagePaymentType,
                      })
                    }
                    className="mt-1.5 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="total">Total Order Amount (Normal Orders)</option>
                    <option value="service_fee">Inquiry Service Fee (Inquiry Orders)</option>
                    <option value="items">Confirmed Food / Items (Inquiry Orders)</option>
                  </select>
                </div>
              )}
            </div>

            {/* Message Body Editor */}
            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Message Body *
                </label>
                <span className="text-xs text-slate-400">
                  Click a variable below to insert it
                </span>
              </div>

              {/* Variable Chips */}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {ALLOWED_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-100 dark:border-violet-900 dark:bg-violet-950/60 dark:text-violet-300"
                    title={v.description}
                  >
                    <Plus className="h-3 w-3" />
                    <span>{`{{${v.key}}}`}</span>
                  </button>
                ))}
              </div>

              <textarea
                ref={textareaRef}
                required
                rows={5}
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                className="mt-3 w-full rounded-2xl border border-slate-200 p-3.5 font-mono text-sm leading-relaxed text-slate-900 focus:border-violet-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />

              {!formValidation.valid && (
                <div className="mt-2 rounded-xl bg-rose-50 p-3 text-xs text-rose-800 dark:bg-rose-950/50 dark:text-rose-200">
                  <p className="font-bold">Validation Warning:</p>
                  <ul className="mt-1 list-inside list-disc space-y-0.5">
                    {formValidation.errors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Live Message Preview */}
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-950 dark:bg-emerald-950/20">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                <Eye className="h-4 w-4" />
                Live Preview (What customer receives)
              </div>
              <div className="mt-2.5 rounded-xl border border-emerald-200/60 bg-white p-3.5 shadow-sm dark:border-emerald-900/60 dark:bg-slate-900">
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800 dark:text-slate-200">
                  {sampleRenderedMessage || 'Start typing above to preview your message...'}
                </p>
              </div>
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  Template is Active and available to taskers
                </span>
              </label>
            </div>

            <DialogFooter className="mt-6 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditorOpen(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving || !formValidation.valid}
                className="rounded-xl bg-violet-600 font-semibold text-white hover:bg-violet-700"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingTemplate ? 'Save Changes' : 'Create Template'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white">
              Delete Message Template?
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm text-slate-500">
              Are you sure you want to delete &ldquo;{deleteTarget?.title}&rdquo;? Taskers will no
              longer be able to select this template.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-5 flex gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="rounded-xl bg-rose-600 font-semibold text-white hover:bg-rose-700"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
