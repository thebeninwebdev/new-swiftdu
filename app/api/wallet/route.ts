import { connectDB } from '@/lib/db';
import Wallet from '@/models/wallet';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    await connectDB();

    const taskerId = req.nextUrl.searchParams.get('taskerId');

    if (!taskerId) {
      return NextResponse.json(
        { error: 'taskerId is required' },
        { status: 400 }
      );
    }

    let wallet = await Wallet.findOne({ taskerId });

    // Create wallet if it doesn't exist
    if (!wallet) {
      wallet = new Wallet({
        taskerId,
        totalEarnings: 0,
        currentBalance: 0,
        totalWithdrawn: 0,
        transactions: [],
      });
      await wallet.save();
    }

    return NextResponse.json(wallet);
  } catch (error) {
    console.error('Error fetching wallet:', error);
    return NextResponse.json(
      { error: 'Failed to fetch wallet' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectDB();

    const { taskerId, type, amount, description, orderId } = await req.json();

    if (!taskerId || !type || !amount || !description) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (type !== 'credit' && type !== 'debit') {
      return NextResponse.json(
        { error: 'Invalid transaction type' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Amount must be greater than 0' },
        { status: 400 }
      );
    }

    let wallet = await Wallet.findOne({ taskerId });

    if (!wallet) {
      wallet = new Wallet({
        taskerId,
        totalEarnings: 0,
        currentBalance: 0,
        totalWithdrawn: 0,
        transactions: [],
      });
    }

    // Add transaction
    const transaction = {
      type,
      amount,
      description,
      orderId: orderId || undefined,
      timestamp: new Date(),
    };

    wallet.transactions.push(transaction);

    // Update balances
    if (type === 'credit') {
      wallet.totalEarnings += amount;
      wallet.currentBalance += amount;
    } else {
      wallet.totalWithdrawn += amount;
      wallet.currentBalance -= amount;
    }

    // Ensure balance doesn't go negative
    if (wallet.currentBalance < 0) {
      return NextResponse.json(
        { error: 'Insufficient balance' },
        { status: 400 }
      );
    }

    await wallet.save();

    return NextResponse.json(wallet, { status: 201 });
  } catch (error) {
    console.error('Error creating wallet transaction:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}
