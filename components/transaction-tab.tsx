"use client";

import { useState, useEffect } from "react";
import { Transaction } from "@/app/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, ArrowUpRight, ArrowDownLeft } from "lucide-react";

export function TransactionTab() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300";
      case "pending":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300";
      case "refunded":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTypeColor = (type: string) => {
    return type === "earned"
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";
  };

  useEffect(() => {
    const fetchTransactions = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/orders');
        if (!response.ok) {
          throw new Error('Could not load transactions from server');
        }

        const orders = await response.json();
        const mapped = orders.map((order: any): Transaction => ({
          id: order._id ?? order.id,
          taskId: order._id ?? order.id,
          taskTitle: order.taskType ? `${order.taskType} task` : 'Task',
          taskDescription: order.description ?? 'No description',
          type: 'spent',
          amount: order.amount ?? 0,
          fee: order.fee ?? 0,
          status:
            order.status === 'pending'
              ? 'pending'
              : order.status === 'completed'
              ? 'completed'
              : 'refunded',
          date: new Date(order.createdAt ?? order.createdAt ?? Date.now()),
          category: order.taskType ?? 'General',
        }));

        setTransactions(mapped);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Loading your transactions...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription className="text-red-600">{error}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transaction History</CardTitle>
        <CardDescription>
          View all your completed and pending transactions
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No transactions yet
            </div>
          ) : (
            transactions.map((transaction: Transaction) => (
              <div
                key={transaction.id}
                className="border rounded-lg overflow-hidden transition-colors hover:bg-secondary/50"
              >
                {/* Summary Row */}
                <button
                  onClick={() =>
                    setExpandedId(expandedId === transaction.id ? null : transaction.id)
                  }
                  className="w-full p-4 text-left hover:bg-secondary/30 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <div
                      className={`p-2 rounded-full ${
                        transaction.type === "earned"
                          ? "bg-green-100 dark:bg-green-900"
                          : "bg-red-100 dark:bg-red-900"
                      }`}
                    >
                      {transaction.type === "earned" ? (
                        <ArrowUpRight className="w-4 h-4 text-green-600 dark:text-green-400" />
                      ) : (
                        <ArrowDownLeft className="w-4 h-4 text-red-600 dark:text-red-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{transaction.taskTitle}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(transaction.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p
                        className={`font-semibold text-sm ${getTypeColor(
                          transaction.type
                        )}`}
                      >
                        {transaction.type === "earned" ? "+" : "-"}
                        {formatCurrency(transaction.amount)}
                      </p>
                      <Badge variant="outline" className={getStatusColor(transaction.status)}>
                        {transaction.status.charAt(0).toUpperCase() +
                          transaction.status.slice(1)}
                      </Badge>
                    </div>

                    {expandedId === transaction.id ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {/* Expanded Details */}
                {expandedId === transaction.id && (
                  <div className="border-t bg-secondary/30 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground mb-1">Task Description</p>
                        <p className="font-medium">{transaction.taskDescription}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground mb-1">Category</p>
                        <p className="font-medium">{transaction.category}</p>
                      </div>
                    </div>

                    <div className="border-t pt-3 space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Amount</span>
                        <span className="font-medium">
                          {formatCurrency(transaction.amount)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Platform Fee</span>
                        <span className="font-medium text-red-600 dark:text-red-400">
                          -{formatCurrency(transaction.fee)}
                        </span>
                      </div>
                      <div className="flex justify-between bg-secondary/50 p-2 rounded font-semibold">
                        <span>Net Amount</span>
                        <span className={getTypeColor(transaction.type)}>
                          {transaction.type === "earned" ? "+" : "-"}
                          {formatCurrency(transaction.amount - transaction.fee)}
                        </span>
                      </div>
                    </div>

                    <div className="border-t pt-3 text-xs text-muted-foreground">
                      <p>Task ID: {transaction.taskId}</p>
                      <p>Transaction ID: {transaction.id}</p>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
