# Environment Variables for Production

## Required Environment Variables

Set these in your Netlify dashboard under Site Settings > Environment Variables:

### Supabase Configuration
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (for server-side operations)

### Email Configuration (if using nodemailer)
- `SMTP_HOST` - Your SMTP server host
- `SMTP_PORT` - SMTP port (usually 587)
- `SMTP_USER` - Your SMTP username
- `SMTP_PASS` - Your SMTP password
- `FROM_EMAIL` - Email address to send from

### Optional
- `CUSTOM_KEY` - Any custom key you might need

## Current Supabase Configuration
Based on your code, you're using:
- URL: `https://ybxytftngwibgbkvnect.supabase.co`
- Make sure to set the proper anon key and service role key in Netlify
