from flask import Flask, request
from twilio.rest import Client
from config import ACCOUNT_SID, AUTH_TOKEN, WHATSAPP_NUMBER, TRAINING_DAYS
import json
import os

app = Flask(__name__)

# Initialize Twilio client
client = Client(ACCOUNT_SID, AUTH_TOKEN)

# In-memory storage (use database for production)
signups = {
    'monday': set(),
    'friday': set()
}

def send_whatsapp_message(to_number, message):
    """Send a WhatsApp message"""
    client.messages.create(
        from_=WHATSAPP_NUMBER,
        body=message,
        to=to_number
    )

def process_message(from_number, message_body):
    """Process incoming messages and respond"""
    message = message_body.strip().lower()
    
    if message.startswith('signup'):
        parts = message.split()
        if len(parts) > 1:
            day = parts[1]
            if day in TRAINING_DAYS:
                signups[day].add(from_number)
                response = f"✅ You've signed up for {day.capitalize()} training!"
            else:
                response = f"❌ Invalid day. Please use: {', '.join(TRAINING_DAYS)}"
        else:
            response = f"📝 Please specify a day: signup monday OR signup friday"
    
    elif message == 'list':
        monday_count = len(signups['monday'])
        friday_count = len(signups['friday'])
        response = f"📋 Current Signups:\n\nMonday: {monday_count} players\nFriday: {friday_count} players"
    
    elif message == 'list monday':
        players = list(signups['monday'])
        if players:
            response = f"🏃 Monday Players ({len(players)}):\n" + "\n".join([f"- {p}" for p in players])
        else:
            response = "No players signed up for Monday yet."
    
    elif message == 'list friday':
        players = list(signups['friday'])
        if players:
            response = f"🏃 Friday Players ({len(players)}):\n" + "\n".join([f"- {p}" for p in players])
        else:
            response = "No players signed up for Friday yet."
    
    elif message == 'help':
        response = """📚 Available Commands:
• signup monday - Sign up for Monday
• signup friday - Sign up for Friday
• list - Show player counts
• list monday - Show all Monday players
• list friday - Show all Friday players
• help - Show this message"""
    
    else:
        response = "❓ Unknown command. Type 'help' for available commands."
    
    send_whatsapp_message(from_number, response)

@app.route('/whatsapp', methods=['POST'])
def whatsapp_webhook():
    """Handle incoming WhatsApp messages"""
    incoming_msg = request.values.get('Body', '')
    from_number = request.values.get('From', '')
    
    process_message(from_number, incoming_msg)
    
    return ('', 204)

if __name__ == '__main__':
    port = int(os.getenv('FLASK_PORT', 5000))
    app.run(debug=True, port=port)
