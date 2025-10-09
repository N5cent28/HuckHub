# HuckHub

A PWA for finding throwing partners in Madison, WI's ultimate frisbee community.

## About

HuckHub is a Progressive Web App (PWA) that connects ultimate frisbee players in Madison, Wisconsin. Find throwing partners, discover local parks, and stay connected with the ultimate community.

## Features

- 🏃‍♂️ Find throwing partners nearby
- 🗺️ Discover ultimate-friendly parks and locations
- 📱 Install as a PWA on mobile devices
- 🔔 Real-time notifications for matches
- 👤 User profiles and preferences

## Tech Stack

- **Frontend**: Next.js 15 with React 19
- **Database**: Supabase
- **Styling**: Tailwind CSS
- **PWA**: next-pwa
- **Deployment**: Netlify

## Getting Started

### Development

1. Clone the repository:
```bash
git clone https://github.com/N5cent28/HuckHub.git
cd HuckHub
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your Supabase credentials
```

4. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the app.

### Production Deployment

This app is configured for deployment on Netlify. See `ENVIRONMENT_VARIABLES.md` for required environment variables.

## Contributing

This is a personal project for the Madison ultimate frisbee community. Feel free to submit issues or suggestions!

## License

MIT License
