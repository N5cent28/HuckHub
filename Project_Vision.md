# Ultimate Frisbee Throwing Partner Matching PWA - Project Analysis

## Project Overview

### Problem Statement
- **Current Challenge**: Managing a network of 200+ ultimate frisbee players in Madison, WI
- **Pain Point**: Inability to efficiently message all contacts to find available throwing partners for spontaneous sessions
- **Scale Issue**: Manual coordination becomes unfeasible as the network grows

### Proposed Solution
A Progressive Web App (PWA) that facilitates spontaneous ultimate frisbee throwing partner matching through:

1. **User Registration**: Email-based signup with push notification opt-in
2. **Availability Management**: Users set general weekly availability and preferred park locations
3. **Spontaneous Matching**: Real-time matching when users indicate they're "looking for a throwing partner"
4. **Two-Tier Matching System**:
   - **Active Seekers**: Users currently looking to throw at specific times
   - **Potential Matches**: Users who marked general availability but haven't actively sought partners

## Core Features

### User Management
- Email-based authentication
- Push notification preferences
- Profile management (availability, preferred parks, skill level)
- **Instant Notifications**: Real-time push and email notifications for throwing requests
- **User Safety**: Block/report system for problematic users

### Availability System
- **General Availability**: Weekly recurring time slots
- **Park Preferences**: Multiple Madison-area locations
- **Spontaneous Requests**: Real-time "looking to throw" status with 2-hour renewal requirement

### Location Management
- **Pre-loaded Parks**: Database of Madison-area parks with coordinates
- **Radius-based Matching**: "I'll throw anywhere within X miles" option
- **Custom Locations**: Users can add their own throwing spots
- **Smart Suggestions**: Auto-add parks within user's preferred radius

### Skill Level System
- **Self-Rating**: 1-10 scale with standardized guide
- **League Level**: None, MUFA, College/Club, or UFA
- **Skill-based Matching**: Option to match only with similar skill levels
- **Skill Guide**: Clear criteria for self-rating consistency

### Matching Algorithm
- **Primary**: Match active seekers with other active seekers
- **Secondary**: Suggest users with general availability during requested times
- **Geographic**: Prioritize matches based on park preferences and radius settings
- **Notification-based**: Instant alerts when matches are available
- **Skill-based**: Optional matching by skill level and league experience

### Communication
- **On-Platform**: Initial matching and basic coordination
- **Off-Platform**: Email/phone communication for actual meetups
- **Secure Contact Sharing**: Safe method for exchanging contact information - perhaps only reveal each other's contact information once the second party accepts the invitation to throw.

## Detailed Matching System

### "Actively Looking" Status
**Definition**: User is currently seeking a throwing partner for a specific time window
**Requirements**:
- Must be renewed every 2 hours if no match is found
- Can specify time window (e.g., "next 2 hours", "this evening")
- Can specify preferred parks or radius
- Can set skill level preferences

**Renewal Process**:
- Push notification reminder at 1.5 hours
- Simple one-tap renewal
- Automatic expiration if not renewed
- Option to extend time window

### Matching Display & Interface

**Match Results Screen**:
1. **Active Seekers** (currently looking)
   - Real-time list of users actively seeking partners
   - Sortable by: distance, skill level, time availability
   - Show: name, skill level, preferred parks, time window
   - Action: "Request to Throw" button

2. **Potential Matches** (general availability)
   - Users who marked availability but aren't actively seeking
   - Sortable by: distance, skill level, general availability
   - Show: name, skill level, general availability, preferred parks
   - Action: "Ask if Available" button

**Match Details**:
- User profile summary
- Skill level and league experience
- Preferred throwing locations
- General availability patterns
- Contact sharing options

### Skill Level System

**Self-Rating Scale (1-10)**:
- **1-2**: Beginner - Learning basic throws, inconsistent catching
- **3-4**: Recreational - Can throw backhand/forehand, basic game understanding
- **5-6**: Intermediate - Consistent throws, understands strategy, plays pickup
- **7-8**: Advanced - Strong throws, good field awareness, plays league/club
- **9-10**: Elite - Tournament level, exceptional skills, plays at highest levels

**League Level Categories**:
- **None**: No organized league experience
- **MUFA**: Madison Ultimate Frisbee Association
- **College/Club**: College or club team experience
- **UFA**: Ultimate Frisbee Association (highest level)

**Skill-based Matching Options**:
- **Any Skill Level**: Match with anyone
- **Similar Skill**: Within 2 points of your rating
- **Same League Level**: Only match with same league experience
- **Strict Matching**: Both skill level and league level must match

## Enhanced Features

### PWA Installation & Notifications
**Implementation**: 
- Clear installation instructions for iOS and Android
- Push notification permission handling
- Email notification fallback system
- Real-time notification delivery

**User Experience**:
- Step-by-step installation guide in profile setup
- Instant notifications when someone wants to throw
- Notification preferences in settings
- Works offline after installation

### Advanced Location Features
**Park Database**:
- Pre-loaded with Madison-area parks
- GPS coordinates for distance calculations
- Park amenities (parking, restrooms, lighting)
- User ratings and reviews

**Radius-based Matching**:
- "I'll throw anywhere within 5/10/15 miles"
- Automatic park suggestions within radius
- Dynamic radius adjustment based on availability

**Custom Locations**:
- User-submitted throwing spots
- Moderation system for new locations
- Integration with existing park database
- **No photo verification required** - text description only

### User Safety & Moderation
**Block/Report System**:
- Block specific users from seeing your profile
- Report users for inappropriate behavior
- Admin review process for reports
- Temporary suspensions for verified violations
- Permanent bans for serious offenses

**Safety Features**:
- Meet in public parks only
- Optional phone number sharing
- User verification system
- Community moderation tools

## Platform Choice Analysis: PWA vs Native App

### Why PWA is the Right Choice

**Advantages**:
- **Cross-platform**: Works on iOS, Android, and desktop
- **No app store approval**: Faster deployment and updates
- **Lower development cost**: Single codebase
- **Easy sharing**: Share via URL, no download required
- **Offline capability**: Service workers enable offline functionality
- **Push notifications**: Full notification support
- **Contact access**: Can request contact permissions
- **Location services**: Full GPS and geolocation support

**PWA Capabilities for This Project**:
- ✅ Contact access via Contacts API
- ✅ Location services and GPS
- ✅ Push notifications
- ✅ Offline data storage
- ✅ Background sync
- ✅ Share functionality

### When You Might Consider Native Apps
- If you need advanced camera features (AR, filters)
- If you need complex background processing
- If you want to leverage platform-specific UI patterns
- If you need access to device-specific hardware

**Recommendation**: Stick with PWA for MVP. You can always create native apps later if needed.

## Technical Architecture Recommendations (AI-Optimized for Vibe-Coding)

### Frontend (PWA)
- **Framework**: Next.js 14 with TypeScript (AI-friendly, great documentation)
- **PWA Features**: Next-PWA plugin for easy PWA setup
- **UI/UX**: Tailwind CSS + shadcn/ui components (rapid prototyping)
- **State Management**: Zustand (simpler than Redux for AI)
- **Maps**: Google Maps API (well-documented, AI-friendly)
- **Contacts**: Contacts API for contact integration
- **Forms**: React Hook Form + Zod validation
- **Icons**: Lucide React (consistent, AI-friendly)

### Backend
- **API**: Next.js API routes (same codebase, simpler deployment)
- **Database**: Supabase (PostgreSQL + real-time + auth + storage)
- **Authentication**: Supabase Auth (built-in email verification)
- **Push Notifications**: Supabase Edge Functions + web-push
- **Location Services**: Supabase PostGIS extension
- **Real-time**: Supabase Realtime (WebSocket alternative)

### Why This Stack for AI Development
- **Single Codebase**: Next.js full-stack reduces context switching
- **Supabase**: Handles auth, database, real-time, and storage out-of-the-box
- **TypeScript**: Better AI code generation and error catching
- **Tailwind + shadcn**: Rapid UI development with consistent components
- **Well-documented**: All tools have excellent AI training data

### Matching Algorithm
- **Real-time**: Supabase Realtime subscriptions
- **Geographic**: PostGIS geospatial queries
- **Temporal**: Time slot overlap detection
- **Preference**: User compatibility scoring
- **Contact Priority**: Boost matches with existing contacts
- **Skill Matching**: Filter by skill level and league experience

## Implementation Phases (AI-Optimized Bite-Size Steps)

### Phase 1: Foundation Setup (Week 1)
**Goal**: Get basic app running with authentication
**Deliverables**:
- Next.js 14 project setup with TypeScript
- Supabase project and database schema
- Basic authentication (email signup/login)
- Simple landing page
- PWA configuration

**AI-Friendly Tasks**:
- Project initialization with create-next-app
- Supabase setup and schema creation
- Basic auth components
- PWA manifest and service worker

### Phase 2: User Profile System (Week 2)
**Goal**: Complete user onboarding and profile management
**Deliverables**:
- User profile creation form
- Skill level self-rating system
- League level selection
- Basic availability setting
- Profile editing capabilities

**AI-Friendly Tasks**:
- Form components with validation
- Database schema for user profiles
- Skill level guide implementation
- Profile management UI

### Phase 3: Location System (Week 3)
**Goal**: Implement location-based features
**Deliverables**:
- Madison parks database
- Radius-based location selection
- Custom location submission
- Location-based matching foundation
- Google Maps integration (skip for now)

**AI-Friendly Tasks**:
- Park data seeding script
- Location selection components
- Geospatial database queries
- Maps integration

### Phase 4: Basic Matching (Week 4)
**Goal**: Core matching functionality
**Deliverables**:
- "Actively looking" status system
- Basic matching algorithm
- Match results display
- Contact integration
- 2-hour renewal system

**AI-Friendly Tasks**:
- Matching algorithm implementation
- Real-time status updates
- Contact API integration
- Match display components

### Phase 5: Communication & Safety (Week 5)
**Goal**: User interaction and safety features
**Deliverables**:
- Request to throw system
- Block/report functionality
- Contact sharing mechanism
- Push notifications

**AI-Friendly Tasks**:
- Communication flow components
- Safety feature implementation
- Notification system
- User moderation tools

### Phase 6: Polish & Launch (Week 6)
**Goal**: Production-ready app
**Deliverables**:
- UI/UX polish
- Performance optimization
- Error handling
- Analytics setup
- Beta testing with your network

**AI-Friendly Tasks**:
- UI component refinement
- Performance optimization
- Error boundary implementation
- Analytics integration

## Wireframes & User Flow

### Main App Flow
```
Landing Page → Sign Up/Login → Profile Setup → Dashboard → Find Matches
```

### Key Screens

#### 1. Landing Page
```
┌─────────────────────────────────────┐
│  🥏 ThrowsPWA - Madison Ultimate    │
│                                     │
│  Find throwing partners in Madison  │
│                                     │
│  [Sign Up] [Login]                  │
│                                     │
│  Features:                          │
│  • Real-time matching               │
│  • Skill-based pairing              │
│  • Location-based suggestions       │
│  • Contact integration              │
└─────────────────────────────────────┘
```

#### 2. Profile Setup
```
┌─────────────────────────────────────┐
│  Complete Your Profile              │
│                                     │
│  Skill Level: [1-10] ⭐⭐⭐⭐⭐      │
│  League Level: [Dropdown]           │
│                                     │
│  General Availability:              │
│  ☐ Mon 6-8pm  ☐ Tue 6-8pm          │
│  ☐ Wed 6-8pm  ☐ Thu 6-8pm          │
│  ☐ Fri 6-8pm  ☐ Sat 10am-2pm       │
│  ☐ Sun 10am-2pm                     │
│                                     │
│  Preferred Parks:                   │
│  [Add Parks] [Radius: 5 miles]      │
│                                     │
│  [Save Profile]                     │
└─────────────────────────────────────┘
```

#### 3. Dashboard
```
┌─────────────────────────────────────┐
│  🥏 ThrowsPWA          [Profile] ⚙️ │
│                                     │
│  [I'm Looking to Throw]             │
│                                     │
│  Recent Matches:                    │
│  • John (Skill 7) - 2 hours ago     │
│  • Sarah (Skill 5) - Yesterday      │
│                                     │
│  [Find Matches] [My Availability]   │
│                                     │
│  Quick Stats:                       │
│  • 12 successful throws this month  │
│  • 3 new connections                │
└─────────────────────────────────────┘
```

#### 4. Match Results
```
┌─────────────────────────────────────┐
│  ← Back to Dashboard                │
│                                     │
│  Active Seekers (3)                 │
│  ┌─────────────────────────────────┐ │
│  │ Mike (Skill 7, MUFA)            │ │
│  │ Looking: Next 2 hours           │ │
│  │ Parks: Vilas, Elver             │ │
│  │ [Request to Throw]              │ │
│  └─────────────────────────────────┘ │
│                                     │
│  Potential Matches (8)              │
│  ┌─────────────────────────────────┐ │
│  │ Sarah (Skill 5, College)        │ │
│  │ Available: Mon/Wed 6-8pm        │ │
│  │ Parks: Any within 3 miles       │ │
│  │ [Ask if Available]              │ │
│  └─────────────────────────────────┘ │
│                                     │
│  [Filter by Skill] [Filter by Park] │
└─────────────────────────────────────┘
```

#### 5. Match Details
```
┌─────────────────────────────────────┐
│  ← Back to Matches                  │
│                                     │
│  Mike's Profile                     │
│  ┌─────────────────────────────────┐ │
│  │ Skill Level: 7/10 ⭐⭐⭐⭐⭐⭐⭐   │ │
│  │ League: MUFA                    │ │
│  │ Experience: 5 years             │ │
│  │                                 │ │
│  │ Preferred Parks:                │ │
│  │ • Vilas Park (0.2 miles)        │ │
│  │ • Elver Park (1.1 miles)        │ │
│  │                                 │ │
│  │ General Availability:           │ │
│  │ Mon/Wed/Fri 6-8pm               │ │
│  │                                 │ │
│  │ [Request to Throw]              │ │
│  │ [Block User] [Report]           │ │
│  └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### User Flow Diagram
```
Start
  ↓
Landing Page
  ↓
Sign Up/Login
  ↓
Profile Setup
  ↓
Dashboard
  ↓
[I'm Looking to Throw] → Set Time Window → Find Matches
  ↓
Match Results → Match Details → Request to Throw
  ↓
Contact Sharing → Off-Platform Communication
  ↓
Meet & Throw → Rate Experience
  ↓
Back to Dashboard
```

## AI Development Strategy

### Bite-Size Approach Benefits
- **Easier AI Context**: Smaller, focused tasks
- **Faster Iteration**: Quick wins and feedback
- **Better Testing**: Each phase can be tested independently
- **Reduced Risk**: Issues caught early
- **Easier Debugging**: Smaller codebase to troubleshoot

### Recommended AI Prompts Structure
1. **Phase-specific prompts**: Focus on one phase at a time
2. **Component-based development**: Build one component per AI session
3. **Feature-complete iterations**: Each phase should be fully functional
4. **Testing integration**: Include testing in each phase

### Quality Assurance Checkpoints
- **End of Phase 1**: App runs, auth works
- **End of Phase 2**: Users can create profiles
- **End of Phase 3**: Location features work
- **End of Phase 4**: Basic matching functions
- **End of Phase 5**: Full user interaction
- **End of Phase 6**: Production-ready app


## Technical Challenges & Solutions

### 1. PWA Installation & Notifications
**Challenge**: Cross-platform PWA installation and notification delivery
**Solutions**:
- Clear installation instructions for both platforms
- Progressive enhancement for notification features
- Fallback to email notifications
- Service worker for offline functionality

### 2. Location Management
**Challenge**: Managing dynamic park database and custom locations
**Solutions**:
- Admin panel for park management
- User-submitted location moderation
- Geocoding service for address validation
- Text-based location verification

### 3. Radius-based Matching
**Challenge**: Efficiently querying users within geographic radius
**Solutions**:
- PostGIS for geospatial queries
- Cached radius calculations
- Smart indexing on location data
- Background processing for radius updates

### 4. Real-Time Matching & Notifications
**Challenge**: Ensuring timely notifications and availability updates
**Solutions**:
- Push notification optimization
- Background sync capabilities
- Smart notification batching
- Offline capability for viewing matches
- **2-hour renewal reminders**

### 5. Privacy & Safety
**Challenge**: Secure contact sharing and user safety
**Solutions**:
- Email-based initial communication
- Optional phone number sharing with privacy controls
- User verification system
- **Block/report mechanisms**
- Meet in public parks only

### 6. Skill-based Matching
**Challenge**: Ensuring consistent skill level self-ratings
**Solutions**:
- Clear, detailed skill level guide
- Community feedback on accuracy
- Optional skill verification through mutual connections
- Regular skill level updates

## Success Metrics

### User Engagement
- Daily active users
- Match success rate
- User retention (weekly/monthly)
- Time from request to match
- **Contact integration adoption rate**
- **Custom location submissions**
- **Skill level distribution**

### Community Health
- Number of successful meetups
- User satisfaction scores
- Spam/abuse reports
- Network growth rate
- **Location diversity**: Number of different parks used
- **Skill level matching success rate**

## Next Steps

1. **Phase 1 Setup**: Initialize Next.js project with Supabase
2. **Database Design**: Create user profiles and matching tables
3. **Location Research**: Map all Madison-area parks and get coordinates
4. **Phase 1 Implementation**: Build authentication and basic app structure
5. **Phase 2 Implementation**: User profile system with skill levels
6. **Phase 3 Implementation**: Location features and park database
7. **Phase 4 Implementation**: Core matching functionality
8. **Phase 5 Implementation**: Communication and safety features
9. **Phase 6 Implementation**: Polish and launch preparation
10. **Beta Testing**: Launch with your existing network
11. **Iteration**: Gather feedback and improve based on usage patterns

## AI Development Workflow

### Recommended Approach
1. **Start with Phase 1**: Get the foundation working first
2. **Test each phase**: Ensure each phase is fully functional before moving on
3. **Use AI for each component**: Break down each phase into individual components
4. **Iterate quickly**: Make small changes and test frequently
5. **Document issues**: Keep track of what works and what doesn't

### Sample AI Prompts for Each Phase
- **Phase 1**: "Create a Next.js 14 app with Supabase authentication and PWA setup"
- **Phase 2**: "Build a user profile form with skill level rating and availability selection"
- **Phase 3**: "Implement location selection with Madison parks database and radius matching"
- **Phase 4**: "Create a matching system that shows active seekers and potential matches"
- **Phase 5**: "Add communication features including request to throw and block/report"
- **Phase 6**: "Polish the UI and add performance optimizations"

## Conclusion

This PWA addresses a real community need in Madison's ultimate frisbee scene. The key to success will be:
- Starting with your existing network
- Focusing on simplicity and ease of use
- Building trust through safety features
- Iterating based on user feedback
- **Leveraging existing relationships through contact integration**
- **Making location management as seamless as possible**
- **Ensuring user safety through block/report systems**
- **Providing flexible skill-based matching options**

The technical challenges are manageable, and the community-focused approach gives you a strong foundation for growth. The PWA approach is perfect for this use case, offering all the functionality you need while being easier to develop and deploy than native apps.