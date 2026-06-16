import os
from dotenv import load_dotenv

load_dotenv()

# Twilio WhatsApp Configuration
ACCOUNT_SID = os.getenv('TWILIO_ACCOUNT_SID')
AUTH_TOKEN = os.getenv('TWILIO_AUTH_TOKEN')
WHATSAPP_NUMBER = os.getenv('TWILIO_WHATSAPP_NUMBER')  # e.g., 'whatsapp:+1234567890'

# Training Configuration
TRAINING_DAYS = ['monday', 'friday']
TRAINING_TIMES = {
    'monday': '19:00',
    'friday': '19:00'
}
