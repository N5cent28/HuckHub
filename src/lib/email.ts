import * as nodemailer from 'nodemailer';

// Simple email service using nodemailer
// You can use Gmail, SendGrid, or any SMTP provider

export async function sendMatchRequestEmail({
  to,
  fromName,
  fromEmail,
  message,
  targetName
}: {
  to: string;
  fromName: string;
  fromEmail: string;
  message?: string;
  targetName: string;
}) {
  // For now, we'll just log the email details
  // To enable real emails, set up SMTP credentials in .env.local
  
  const emailContent = {
    to,
    subject: `🥏 New throwing partner request from ${fromName}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <title>New Throwing Partner Request</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
            .content { background: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; }
            .message-box { background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0; }
            .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 10px 5px; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🥏 HuckHub</h1>
              <h2>New Throwing Partner Request</h2>
            </div>
            
            <div class="content">
              <p>Hi ${targetName},</p>
              
              <p><strong>${fromName}</strong> wants to throw with you!</p>
              
              ${message ? `
                <div class="message-box">
                  <h3>Personal Message:</h3>
                  <p>"${message}"</p>
                </div>
              ` : ''}
              
              <p>To respond to this request:</p>
              <ol>
                <li>Log into HuckHub at <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://huckhub.netlify.app'}">${process.env.NEXT_PUBLIC_APP_URL || 'https://huckhub.netlify.app'}</a></li>
                <li>Go to your dashboard to see pending requests</li>
                <li>Accept or decline the request</li>
              </ol>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://huckhub.netlify.app'}/dashboard" class="button">View Request in HuckHub</a>
              </div>
              
              <div class="footer">
                <p>This request was sent through HuckHub - Madison's ultimate frisbee community.</p>
                <p>If you don't want to receive these emails, you can update your notification preferences in your profile.</p>
              </div>
            </div>
          </div>
        </body>
      </html>
    `
  };

  // Check if SMTP is configured
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587');

  if (smtpUser && smtpPass) {
    // Send real email
    try {
      console.log('📧 Attempting to send email with SMTP...');
      console.log('📧 SMTP Config:', {
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        user: smtpUser,
        // Don't log the actual password for security
        passLength: smtpPass.length
      });

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465, // true for 465, false for other ports
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      // Test the connection first
      console.log('📧 Testing SMTP connection...');
      await transporter.verify();
      console.log('✅ SMTP connection verified successfully');

      console.log('📧 Sending email...');
      const result = await transporter.sendMail(emailContent);
      console.log('✅ Email sent successfully!');
      console.log('📧 Message ID:', result.messageId);
      console.log('📧 Response:', result.response);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Email sending failed:');
      console.error('❌ Error type:', error instanceof Error ? error.constructor.name : typeof error);
      console.error('❌ Error message:', error instanceof Error ? error.message : String(error));
      console.error('❌ Full error:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  } else {
    // Just log the email (for development)
    console.log('📧 Email would be sent:');
    console.log('   To:', to);
    console.log('   From:', fromName, '(', fromEmail, ')');
    console.log('   Subject:', emailContent.subject);
    console.log('   Message:', message || 'No message');
    console.log('');
    console.log('💡 To enable real emails, add SMTP credentials to .env.local:');
    console.log('   SMTP_USER=your-email@gmail.com');
    console.log('   SMTP_PASS=your-app-password');
    console.log('   SMTP_HOST=smtp.gmail.com');
    console.log('   SMTP_PORT=587');
    
    return { success: true, logged: true };
  }
}
