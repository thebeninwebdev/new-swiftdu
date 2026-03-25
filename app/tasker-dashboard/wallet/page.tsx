'use client'

import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface Transaction {
  type: 'credit' | 'debit'
  amount: number
  description: string
  timestamp: string
}

interface WalletData {
  totalEarnings: number
  currentBalance: number
  totalWithdrawn: number
  transactions: Transaction[]
}

export default function WalletPage() {
  const [taskerId, setTaskerId] = useState<string | null>(null)
  const [withdrawalAmount, setWithdrawalAmount] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  )
  const [data, setData] = useState<WalletData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const getTaskerId = async () => {
      try {
        const session = await fetch('/api/auth/session').then((r) => r.json())
        if (session?.user?.id) {
          setTaskerId(session.user.id)
        }
      } catch (error) {
        console.error('Error fetching session:', error)
      }
    }
    getTaskerId()
  }, [])

  // Fetch wallet data
  useEffect(() => {
    if (!taskerId) return

    const fetchWallet = async () => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await fetch(`/api/wallet?taskerId=${taskerId}`)
        if (!response.ok) {
          throw new Error('Failed to fetch wallet data')
        }
        const result = await response.json()
        setData(result)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setIsLoading(false)
      }
    }

    fetchWallet()
  }, [taskerId])

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    const amount = parseFloat(withdrawalAmount)

    if (amount <= 0) {
      setMessage({ type: 'error', text: 'Amount must be greater than 0' })
      setIsSubmitting(false)
      return
    }

    if (data && amount > data.currentBalance) {
      setMessage({ type: 'error', text: 'Insufficient balance' })
      setIsSubmitting(false)
      return
    }

    try {
      const response = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskerId,
          type: 'debit',
          amount,
          description: `Withdrawal of $${amount.toFixed(2)}`,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setMessage({ type: 'error', text: errorData.error })
        return
      }

      setMessage({
        type: 'success',
        text: 'Withdrawal request submitted successfully!',
      })
      setWithdrawalAmount('')
      // Refetch wallet data
      if (taskerId) {
        const response = await fetch(`/api/wallet?taskerId=${taskerId}`)
        if (response.ok) {
          const result = await response.json()
          setData(result)
        }
      }
    } catch (error) {
      console.error('Withdrawal error:', error)
      setMessage({ type: 'error', text: 'Failed to process withdrawal' })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading wallet information...</p>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load wallet information. Please try again.
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Your Wallet
          </h1>
          <p className="text-muted-foreground">
            Track your earnings and manage withdrawals
          </p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 bg-gradient-to-br from-green-50 to-green-100 border-green-200">
            <p className="text-sm text-green-600 font-medium">Total Earnings</p>
            <p className="text-4xl font-bold text-green-900 mt-2">
              ${data.totalEarnings.toFixed(2)}
            </p>
          </Card>
          <Card className="p-6 bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <p className="text-sm text-blue-600 font-medium">Current Balance</p>
            <p className="text-4xl font-bold text-blue-900 mt-2">
              ${data.currentBalance.toFixed(2)}
            </p>
          </Card>
          <Card className="p-6 bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <p className="text-sm text-orange-600 font-medium">
              Total Withdrawn
            </p>
            <p className="text-4xl font-bold text-orange-900 mt-2">
              ${data.totalWithdrawn.toFixed(2)}
            </p>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Withdrawal Form */}
          <div className="lg:col-span-1">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Request Withdrawal</h2>

              {message && (
                <div
                  className={`p-3 rounded-lg mb-4 text-sm ${
                    message.type === 'success'
                      ? 'bg-green-50 text-green-700 border border-green-200'
                      : 'bg-red-50 text-red-700 border border-red-200'
                  }`}
                >
                  {message.text}
                </div>
              )}

              <form onSubmit={handleWithdraw} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Withdrawal Amount
                  </label>
                  <div className="flex items-center">
                    <span className="text-lg font-semibold mr-2">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={data.currentBalance}
                      value={withdrawalAmount}
                      onChange={(e) => setWithdrawalAmount(e.target.value)}
                      placeholder="0.00"
                      className="flex-1 px-3 py-2 rounded-md border border-border bg-background"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Max: ${data.currentBalance.toFixed(2)}
                  </p>
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting || !withdrawalAmount}
                  className="w-full"
                >
                  {isSubmitting ? 'Processing...' : 'Request Withdrawal'}
                </Button>
              </form>

              <div className="mt-6 pt-6 border-t border-border">
                <h3 className="font-semibold mb-3">Bank Details</h3>
                <p className="text-sm text-muted-foreground">
                  Withdrawals are processed to your registered bank account
                </p>
                <Button variant="outline" className="w-full mt-3">
                  View Bank Details
                </Button>
              </div>
            </Card>
          </div>

          {/* Transaction History */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h2 className="text-xl font-bold mb-4">Transaction History</h2>

              {data.transactions.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No transactions yet. Complete errands to start earning!
                </p>
              ) : (
                <div className="space-y-3">
                  {data.transactions
                    .slice()
                    .reverse()
                    .map((transaction, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-sm">
                            {transaction.description}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(transaction.timestamp).toLocaleDateString()}
                          </p>
                        </div>
                        <p
                          className={`font-bold text-sm ${
                            transaction.type === 'credit'
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}
                        >
                          {transaction.type === 'credit' ? '+' : '-'}$
                          {transaction.amount.toFixed(2)}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
