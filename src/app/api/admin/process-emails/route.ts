// API endpoint to process pending emails
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    // You should add authentication here to ensure only authorized users can trigger this
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.CRON_SECRET; // Add this to your .env file
    
    if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('Processing pending emails...');
    const { processPendingEmails } = await import('@/lib/email-service');
    const sentCount = await processPendingEmails();
    
    return NextResponse.json({ 
      success: true, 
      emailsSent: sentCount,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in email processing endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process emails' }, 
      { status: 500 }
    );
  }
}

// Optional: GET endpoint to check email queue status
export async function GET(request: NextRequest) {
  try {
    // Add basic auth here too
    const authHeader = request.headers.get('authorization');
    const expectedKey = process.env.CRON_SECRET;
    
    if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // This would require additional database queries to get queue stats
    return NextResponse.json({ 
      message: 'Email queue status endpoint',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Error in email status endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to get email status' }, 
      { status: 500 }
    );
  }
}
