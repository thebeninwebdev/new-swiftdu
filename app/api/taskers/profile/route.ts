import { connectDB } from '@/lib/db';
import Tasker from '@/models/tasker';
import { NextRequest, NextResponse } from 'next/server';

export async function PATCH(req: NextRequest) {
  try {
    await connectDB();

    const taskerId = req.nextUrl.searchParams.get('id');
    const body = await req.json();

    if (!taskerId) {
      return NextResponse.json(
        { error: 'Tasker ID is required' },
        { status: 400 }
      );
    }

    const { profileImage, phone, location, bankDetails } = body;

    // Validate input
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {};

    if (profileImage !== undefined) {
      updateData.profileImage = profileImage;
    }

    if (phone !== undefined) {
      if (!phone.trim()) {
        return NextResponse.json(
          { error: 'Phone number cannot be empty' },
          { status: 400 }
        );
      }
      updateData.phone = phone;
    }

    if (location !== undefined) {
      if (!location.trim()) {
        return NextResponse.json(
          { error: 'Location cannot be empty' },
          { status: 400 }
        );
      }
      updateData.location = location;
    }

    if (bankDetails !== undefined) {
      const { bankName, accountNumber, accountName } = bankDetails;
      if (!bankName || !accountNumber || !accountName) {
        return NextResponse.json(
          { error: 'All bank details are required' },
          { status: 400 }
        );
      }
      updateData.bankDetails = {
        bankName,
        accountNumber,
        accountName,
      };
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    const updatedTasker = await Tasker.findByIdAndUpdate(taskerId, updateData, {
      new: true,
    });

    if (!updatedTasker) {
      return NextResponse.json(
        { error: 'Tasker not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(updatedTasker);
  } catch (error) {
    console.error('Error updating tasker profile:', error);
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
