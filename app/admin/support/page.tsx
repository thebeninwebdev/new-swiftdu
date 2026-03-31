'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  MessageSquare,
  Search,
  User,
  Eye,
  CheckCircle,
  XCircle,
  Send,
  AlertCircle
} from 'lucide-react'

interface SupportTicket {
  _id: string
  userId: string
  userName: string
  userEmail: string
  subject: string
  message: string
  category: string
  priority: 'low' | 'medium' | 'high' | 'urgent'
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  adminResponse?: string
  adminRespondedAt?: string
  createdAt: string
  updatedAt: string
}

export default function AdminSupportPage() {
  const router = useRouter()
  const [admin, setAdmin] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [isFetching, setIsFetching] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null)
  const [responseMessage, setResponseMessage] = useState('')
  const [isResponding, setIsResponding] = useState(false)

  // Auth check
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data, error } = await authClient.getSession()
        if (error || !data?.user) {
          router.push('/login')
          return
        }
        // TODO: Add admin role check
        setAdmin(data.user)
      } catch {
        router.push('/login')
      } finally {
        setIsLoading(false)
      }
    }
    checkAuth()
  }, [router])

  // Fetch tickets
  const fetchTickets = useCallback(async () => {
    setIsFetching(true)
    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        search: searchTerm,
        status: statusFilter,
        priority: priorityFilter
      })

      const res = await fetch(`/api/admin/support?${params}`)
      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to load support tickets')
        return
      }

      setTickets(data.tickets)
      setTotalPages(data.totalPages)
    } catch {
      toast.error('Failed to load support tickets')
    } finally {
      setIsFetching(false)
    }
  }, [currentPage, searchTerm, statusFilter, priorityFilter])

  useEffect(() => {
    if (admin) fetchTickets()
  }, [admin, fetchTickets])

  // Handle ticket actions
  const handleTicketAction = async (ticketId: string, action: 'start' | 'resolve' | 'close') => {
    try {
      const res = await fetch(`/api/admin/support/${ticketId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Action failed')
        return
      }

      toast.success(
        action === 'start' ? 'Started working on ticket' :
        action === 'resolve' ? 'Ticket resolved' :
        'Ticket closed'
      )

      // Refresh tickets list
      fetchTickets()
    } catch {
      toast.error('Something went wrong')
    }
  }

  // Handle response submission
  const handleResponse = async () => {
    if (!selectedTicket || !responseMessage.trim()) return

    setIsResponding(true)
    try {
      const res = await fetch(`/api/admin/support/${selectedTicket._id}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: responseMessage }),
      })

      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to send response')
        return
      }

      toast.success('Response sent successfully')
      setResponseMessage('')
      setSelectedTicket(null)

      // Refresh tickets list
      fetchTickets()
    } catch {
      toast.error('Something went wrong')
    } finally {
      setIsResponding(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'in_progress':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'resolved':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'closed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      case 'high':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
      case 'low':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <AlertCircle className="w-4 h-4" />
      case 'in_progress':
        return <MessageSquare className="w-4 h-4" />
      case 'resolved':
        return <CheckCircle className="w-4 h-4" />
      case 'closed':
        return <XCircle className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  if (!admin) return null

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Support Tickets</h1>
              <p className="text-muted-foreground mt-1">Manage and respond to user support requests</p>
            </div>
            <Badge variant="secondary" className="px-3 py-1">
              Admin Panel
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tickets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>

              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value ?? "all")}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>

              <Select value={priorityFilter} onValueChange={(value) => setPriorityFilter(value ?? "all")}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                </SelectContent>
              </Select>

              <Button onClick={() => setCurrentPage(1)} disabled={isFetching}>
                {isFetching ? 'Loading...' : 'Apply Filters'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tickets List */}
        <div className="space-y-4">
          {tickets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-muted-foreground">No support tickets found</p>
              </CardContent>
            </Card>
          ) : (
            tickets.map((ticket) => (
              <Card key={ticket._id} className="overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4 flex-1">
                      <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                        <User className="w-6 h-6 text-primary" />
                      </div>

                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold">{ticket.subject}</h3>
                          <Badge className={getPriorityColor(ticket.priority)}>
                            {ticket.priority.toUpperCase()}
                          </Badge>
                          <div className="flex items-center">
                            {getStatusIcon(ticket.status)}
                            <Badge className={getStatusColor(ticket.status)}>
                              {ticket.status.replace('_', ' ').toUpperCase()}
                            </Badge>
                          </div>
                        </div>

                        <p className="text-sm text-muted-foreground mb-2">
                          From {ticket.userName} • {new Date(ticket.createdAt).toLocaleDateString()}
                        </p>

                        <p className="text-sm mb-3 line-clamp-2">{ticket.message}</p>

                        <div className="text-xs text-muted-foreground">
                          <span>Category: {ticket.category}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-2 ml-4">
                      <Dialog>
                        <DialogTrigger>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedTicket(ticket)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>{ticket.subject}</DialogTitle>
                            <DialogDescription>
                              Support ticket from {ticket.userName}
                            </DialogDescription>
                          </DialogHeader>

                          <div className="space-y-4">
                            <div>
                              <h4 className="font-medium mb-2">User Details</h4>
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <p className="text-muted-foreground">Name</p>
                                  <p>{ticket.userName}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Email</p>
                                  <p>{ticket.userEmail}</p>
                                </div>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-medium mb-2">Ticket Details</h4>
                              <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                                <div>
                                  <p className="text-muted-foreground">Priority</p>
                                  <Badge className={getPriorityColor(ticket.priority)}>
                                    {ticket.priority.toUpperCase()}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Status</p>
                                  <Badge className={getStatusColor(ticket.status)}>
                                    {ticket.status.replace('_', ' ').toUpperCase()}
                                  </Badge>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Category</p>
                                  <p>{ticket.category}</p>
                                </div>
                                <div>
                                  <p className="text-muted-foreground">Created</p>
                                  <p>{new Date(ticket.createdAt).toLocaleString()}</p>
                                </div>
                              </div>
                            </div>

                            <div>
                              <h4 className="font-medium mb-2">Message</h4>
                              <div className="bg-muted/50 p-4 rounded-lg">
                                <p className="text-sm">{ticket.message}</p>
                              </div>
                            </div>

                            {ticket.adminResponse && (
                              <div>
                                <h4 className="font-medium mb-2">Previous Response</h4>
                                <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                                  <p className="text-sm">{ticket.adminResponse}</p>
                                  <p className="text-xs text-muted-foreground mt-2">
                                    Responded on {new Date(ticket.adminRespondedAt!).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                            )}

                            {ticket.status !== 'closed' && (
                              <div>
                                <h4 className="font-medium mb-2">Send Response</h4>
                                <Textarea
                                  placeholder="Type your response here..."
                                  value={responseMessage}
                                  onChange={(e) => setResponseMessage(e.target.value)}
                                  className="min-h-25"
                                />
                                <Button
                                  onClick={handleResponse}
                                  disabled={!responseMessage.trim() || isResponding}
                                  className="mt-2"
                                >
                                  {isResponding ? 'Sending...' : 'Send Response'}
                                  <Send className="w-4 h-4 ml-2" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>

                      {ticket.status === 'open' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTicketAction(ticket._id, 'start')}
                        >
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                      )}

                      {ticket.status === 'in_progress' && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTicketAction(ticket._id, 'resolve')}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </Button>
                      )}

                      {(ticket.status === 'open' || ticket.status === 'in_progress') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleTicketAction(ticket._id, 'close')}
                        >
                          <XCircle className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center mt-8 space-x-2">
            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>

            <span className="px-4 py-2 text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </span>

            <Button
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}