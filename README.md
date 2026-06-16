# Training Signup Bot - Vercel Deployment

WhatsApp training signup bot hosted on Vercel. Players can sign up for Monday and Friday training sessions.

## Features

✅ **WhatsApp Commands:**
- `signup monday` - Sign up for Monday training
- `signup friday` - Sign up for Friday training  
- `list` - View player counts
- `list monday` - View all Monday players
- `list friday` - View all Friday players
- `help` - Show available commands

✅ **REST API:**
- `GET /api/list?day=monday` - Get Monday players as JSON
- `GET /api/list?day=friday` - Get Friday players as JSON
- `POST /api/whatsapp` - Twilio webhook endpoint

## Setup

### 1. Prerequisites
- Node.js 16+
- Vercel account (free tier works)
- Twilio account with WhatsApp enabled

### 2. Clone & Install

```bash
git clone <repo-url>
cd uwr_matchmaking
npm install
```

### 3. Environment Variables

Create `.env.local` file:

```
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890
```

Get these from your Twilio dashboard.

### 4. Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Follow the prompts and add your environment variables in the Vercel dashboard.

### 5. Configure Twilio Webhook

In your Twilio console, set the webhook URL to:

```
https://your-project.vercel.app/api/whatsapp
```

## Project Structure

```
├── api/
│   ├── whatsapp.ts     # Twilio webhook handler
│   └── list.ts         # REST API endpoint for getting signups
├── src/
│   └── bot.ts          # Bot logic and message processing
├── package.json
├── tsconfig.json
└── vercel.json
```

## Local Development

```bash
vercel dev
```

This starts a local development server at `http://localhost:3000`

## Database Notes

⚠️ **Current Implementation:** In-memory storage (resets on deployment)

For persistent storage, integrate:
- **MongoDB** - Use MongoDB Atlas (free tier available)
- **PostgreSQL** - Use Vercel Postgres
- **Firebase** - Use Firestore
- **Supabase** - PostgreSQL with real-time

## Testing

Use Twilio's WhatsApp sandbox:
1. Go to Twilio Console → Programmable Messaging → WhatsApp
2. Send a message from your personal WhatsApp to the sandbox number
3. Bot responds to your commands

## License

MIT
