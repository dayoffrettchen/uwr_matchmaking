# Training Signup System

A WhatsApp-based training signup system for Monday and Friday sessions.

## Features
- Accept training signups via WhatsApp
- Track players for Monday and Friday sessions
- Generate attendance lists after signup closes

## Setup

1. Install dependencies: `pip install -r requirements.txt`
2. Configure WhatsApp integration (see config.example.py)
3. Run the bot: `python main.py`

## Usage

Players send a message to the bot:
- `signup monday` - Sign up for Monday training
- `signup friday` - Sign up for Friday training
- `list` - Show all signed-up players
