import * as twilio from 'twilio';
import * as dotenv from 'dotenv';

dotenv.config();

const accountSid = process.env.TWILIO_ACCOUNT_SID!;
const authToken = process.env.TWILIO_AUTH_TOKEN!;
const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER!;

const client = twilio(accountSid, authToken);

interface SignupEntry {
  phone: string;
  name: string;
  timestamp: string;
}

export const signups: { [key: string]: SignupEntry[] } = {
  monday: [],
  friday: []
};

export async function sendWhatsAppMessage(toNumber: string, message: string) {
  return await client.messages.create({
    from: whatsappNumber,
    body: message,
    to: toNumber
  });
}

export async function processMessage(fromNumber: string, messageBody: string) {
  const message = messageBody.trim().toLowerCase();
  let response = '';

  if (message.startsWith('signup')) {
    const parts = message.split(/\s+/);
    if (parts.length > 1) {
      const day = parts[1];
      if (['monday', 'friday'].includes(day)) {
        const existingIndex = signups[day].findIndex(entry => entry.phone === fromNumber);
        if (existingIndex === -1) {
          signups[day].push({
            phone: fromNumber,
            name: '',
            timestamp: new Date().toISOString()
          });
          response = `✅ You've signed up for ${day.charAt(0).toUpperCase() + day.slice(1)} training!`;
        } else {
          response = `⚠️ You're already signed up for ${day.charAt(0).toUpperCase() + day.slice(1)}!`;
        }
      } else {
        response = '❌ Invalid day. Please use: signup monday OR signup friday';
      }
    } else {
      response = '📝 Please specify a day: signup monday OR signup friday';
    }
  } else if (message === 'list') {
    const mondayCount = signups.monday.length;
    const fridayCount = signups.friday.length;
    response = `📋 Current Signups:\n\nMonday: ${mondayCount} players\nFriday: ${fridayCount} players`;
  } else if (message === 'list monday') {
    if (signups.monday.length > 0) {
      const players = signups.monday.map(p => `- ${p.phone}`).join('\n');
      response = `🏃 Monday Players (${signups.monday.length}):\n${players}`;
    } else {
      response = 'No players signed up for Monday yet.';
    }
  } else if (message === 'list friday') {
    if (signups.friday.length > 0) {
      const players = signups.friday.map(p => `- ${p.phone}`).join('\n');
      response = `🏃 Friday Players (${signups.friday.length}):\n${players}`;
    } else {
      response = 'No players signed up for Friday yet.';
    }
  } else if (message === 'help') {
    response = `📚 Available Commands:\n• signup monday - Sign up for Monday\n• signup friday - Sign up for Friday\n• list - Show player counts\n• list monday - Show all Monday players\n• list friday - Show all Friday players\n• help - Show this message`;
  } else {
    response = '❓ Unknown command. Type \'help\' for available commands.';
  }

  await sendWhatsAppMessage(fromNumber, response);
}
