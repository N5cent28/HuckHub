# ThrowsPWA Setup Instructions

## Phase 1: Foundation Setup Complete ✅

### What's Been Set Up
- ✅ Next.js 14 project with TypeScript
- ✅ Tailwind CSS for styling
- ✅ Supabase client configuration
- ✅ PWA configuration with next-pwa
- ✅ Basic authentication pages (signup, login, callback)
- ✅ Landing page with branding
- ✅ Basic dashboard page
- ✅ Database schema (SQL file ready)

### Next Steps

#### 1. Set Up Supabase Project
1. Go to [supabase.com](https://supabase.com) and create a new project
2. Copy your project URL and anon key
3. Update `.env.local` with your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
   ```

#### 2. Set Up Database
1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `database/schema.sql`
4. Run the SQL to create all tables and policies

#### 3. Create PWA Icons
1. Create 192x192 and 512x512 PNG icons
2. Save them as `public/icon-192x192.png` and `public/icon-512x512.png`
3. Use the frisbee/ultimate theme for consistency

#### 4. Test the App
1. Run `npm run dev`
2. Visit `http://localhost:3000`
3. Test signup/login flow
4. Verify PWA installation prompt

### Current Features
- Landing page with feature overview
- User authentication (signup/login)
- Email confirmation flow
- Basic dashboard
- PWA manifest and configuration
- Responsive design

### Ready for Phase 2
The foundation is complete and ready for Phase 2: User Profile System. The next phase will add:
- User profile creation form
- Skill level self-rating system
- League level selection
- Basic availability setting
- Profile editing capabilities
