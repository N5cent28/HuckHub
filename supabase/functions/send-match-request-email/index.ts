import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { requesterName, requesterEmail, targetEmail, targetName, message, seekingSessionId } = await req.json()

    if (!requesterName || !requesterEmail || !targetEmail || !targetName) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get target user's profile for more context
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('full_name, skill_level, league_level')
      .eq('email', targetEmail)
      .single()

    // Create email content
    const subject = `🥏 New throwing partner request from ${requesterName}`
    
    const emailHtml = `
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
            .profile-info { background: #e5f3ff; padding: 15px; border-radius: 6px; margin: 15px 0; }
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
              
              <p><strong>${requesterName}</strong> wants to throw with you!</p>
              
              ${targetProfile ? `
                <div class="profile-info">
                  <h3>Your Profile Summary:</h3>
                  <p><strong>Name:</strong> ${targetProfile.full_name || 'Not set'}</p>
                  <p><strong>Skill Level:</strong> ${targetProfile.skill_level || 'Not set'}/10</p>
                  <p><strong>League:</strong> ${targetProfile.league_level || 'Not set'}</p>
                </div>
              ` : ''}
              
              ${message ? `
                <div class="message-box">
                  <h3>Personal Message:</h3>
                  <p>"${message}"</p>
                </div>
              ` : ''}
              
              <p>To respond to this request:</p>
              <ol>
                <li>Log into HuckHub at <a href="${Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://your-app.com'}">${Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://your-app.com'}</a></li>
                <li>Go to your dashboard to see pending requests</li>
                <li>Accept or decline the request</li>
              </ol>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${Deno.env.get('NEXT_PUBLIC_APP_URL') || 'https://your-app.com'}/dashboard" class="button">View Request in HuckHub</a>
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

    // Send email using Supabase's built-in email service
    const { error } = await supabase.functions.invoke('send-email', {
      body: {
        to: targetEmail,
        subject: subject,
        html: emailHtml,
        from: 'HuckHub <noreply@huckhub.com>'
      }
    })

    if (error) {
      console.error('Error sending email:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to send email' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in send-match-request-email:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
