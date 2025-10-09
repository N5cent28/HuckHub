import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { to, testMessage } = await req.json();
    
    if (!to) {
      return NextResponse.json({ error: "Email address required" }, { status: 400 });
    }

    console.log('🧪 Testing email to:', to);
    
    const { sendMatchRequestEmail } = await import('@/lib/email');
    
    const result = await sendMatchRequestEmail({
      to,
      fromName: 'HuckHub Test',
      fromEmail: 'test@huckhub.com',
      message: testMessage || 'This is a test email from HuckHub!',
      targetName: 'Test User'
    });
    
    if (result.success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Test email sent successfully',
        messageId: result.messageId 
      });
    } else {
      return NextResponse.json({ 
        success: false, 
        error: result.error 
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Test email error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}
