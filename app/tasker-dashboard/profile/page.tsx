'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getTaskerId } from '@/lib/utils'

interface TaskerProfile {
  _id: string
  userId: string
  phone: string
  location: string
  profileImage?: string
  studentId: string
  isVerified: boolean
  rating: number
  completedTasks: number
  bankDetails: {
    bankName: string
    accountNumber: string
    accountName: string
  }
}

export default function ProfilePage() {
  const [taskerId, setTaskerId] = useState<string | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [isBankEditing, setIsBankEditing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: string; text: string } | null>(
    null
  )
  const [profile, setProfile] = useState<TaskerProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    phone: '',
    location: '',
    profileImage: '',
  })

  const [bankData, setBankData] = useState({
    bankName: '',
    accountNumber: '',
    accountName: '',
  })

  const loadProfile = useCallback(async (id: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/taskers?taskerId=${id}`)
      if (!response.ok) {
        throw new Error('Failed to fetch profile')
      }

      const { tasker } = await response.json()

      setProfile(tasker)
      setFormData({
        phone: tasker.phone,
        location: tasker.location,
        profileImage: tasker.profileImage || '',
      })
      setBankData(tasker.bankDetails)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    getTaskerId().then((id) => {
      if (id) setTaskerId(id)
    }).catch((err) => {
      console.error('Failed to get tasker ID', err)
    })
  }, [])

  // Fetch profile data
  useEffect(() => {
    if (!taskerId) return

    void loadProfile(taskerId)
  }, [loadProfile, taskerId])

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/taskers/profile?id=${taskerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setMessage({ type: 'error', text: errorData.error })
        return
      }

      setMessage({ type: 'success', text: 'Profile updated successfully!' })
      setIsEditing(false)

      if (taskerId) {
        await loadProfile(taskerId)
      }
    } catch (error) {
      console.error('Update error:', error)
      setMessage({ type: 'error', text: 'Failed to update profile' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBankUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/taskers/profile?id=${taskerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankDetails: bankData }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        setMessage({ type: 'error', text: errorData.error })
        return
      }

      setMessage({
        type: 'success',
        text: 'Bank details updated successfully!',
      })
      setIsBankEditing(false)

      if (taskerId) {
        await loadProfile(taskerId)
      }
    } catch (error) {
      console.error('Update error:', error)
      setMessage({ type: 'error', text: 'Failed to update bank details' })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading profile...</p>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          Failed to load profile. Please try again.
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground mt-2">
            Manage your profile information and preferences
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Profile Overview */}
        <Card className="p-6 mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-linear-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                <span className="text-white text-3xl font-bold">
                  {profile?.phone?.charAt(0).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-2xl font-bold">Tasker Profile</h2>
                <p className="text-muted-foreground">ID: {profile?.studentId}</p>
                <div className="flex gap-4 mt-2">
                  <div>
                    <p className="text-sm text-muted-foreground">Rating</p>
                    <p className="font-bold">
                      {profile?.rating?.toFixed(1)} / 5.0
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Completed Tasks
                    </p>
                    <p className="font-bold">{profile?.completedTasks}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p
                      className={`font-bold ${
                        profile?.isVerified
                          ? 'text-green-600'
                          : 'text-orange-600'
                      }`}
                    >
                      {profile?.isVerified ? 'Verified' : 'Pending'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Personal Information */}
        <Card className="p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Personal Information</h3>
            {!isEditing && (
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
              >
                Edit
              </Button>
            )}
          </div>

          {isEditing ? (
            <form onSubmit={handleProfileUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Phone Number
                </label>
                <Input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData({ ...formData, phone: e.target.value })
                  }
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Location
                </label>
                <Input
                  type="text"
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  placeholder="e.g., Main Campus, Student Center"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Profile Image URL
                </label>
                <Input
                  type="url"
                  value={formData.profileImage}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      profileImage: e.target.value,
                    })
                  }
                  placeholder="https://example.com/image.jpg"
                  className="w-full"
                />
              </div>


              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Phone Number</p>
                <p className="font-medium">{profile.phone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Location</p>
                <p className="font-medium">{profile.location}</p>
              </div>
            </div>
          )}
        </Card>

        {/* Bank Details */}
        <Card className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Bank Details</h3>
            {!isBankEditing && (
              <Button
                variant="outline"
                onClick={() => setIsBankEditing(true)}
              >
                Edit
              </Button>
            )}
          </div>

          {isBankEditing ? (
            <form onSubmit={handleBankUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Bank Name
                </label>
                <Input
                  type="text"
                  value={bankData?.bankName}
                  onChange={(e) =>
                    setBankData({ ...bankData, bankName: e.target.value })
                  }
                  placeholder="e.g., Central Bank"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Account Number
                </label>
                <Input
                  type="text"
                  value={bankData.accountNumber}
                  onChange={(e) =>
                    setBankData({
                      ...bankData,
                      accountNumber: e.target.value,
                    })
                  }
                  placeholder="1234567890"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">
                  Account Name
                </label>
                <Input
                  type="text"
                  value={bankData.accountName}
                  onChange={(e) =>
                    setBankData({ ...bankData, accountName: e.target.value })
                  }
                  placeholder="Full Name as per bank"
                  className="w-full"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsBankEditing(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Bank Name</p>
                <p className="font-medium">{profile?.bankDetails?.bankName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Account Number</p>
                <p className="font-medium">
                  ****
                  {profile?.bankDetails?.accountNumber.slice(-4)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Account Name</p>
                <p className="font-medium">{profile?.bankDetails?.accountName}</p>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
