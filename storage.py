import json
import os
from datetime import datetime

class TrainingStorage:
    """Handle persistent storage of training signups"""
    
    def __init__(self, filename='signups.json'):
        self.filename = filename
        self.signups = self._load_signups()
    
    def _load_signups(self):
        """Load signups from file"""
        if os.path.exists(self.filename):
            with open(self.filename, 'r') as f:
                return json.load(f)
        return {
            'monday': [],
            'friday': []
        }
    
    def _save_signups(self):
        """Save signups to file"""
        with open(self.filename, 'w') as f:
            json.dump(self.signups, f, indent=2)
    
    def add_signup(self, day, phone_number, name=None):
        """Add a player signup"""
        if day not in self.signups:
            return False
        
        entry = {
            'phone': phone_number,
            'name': name or phone_number,
            'timestamp': datetime.now().isoformat()
        }
        
        # Avoid duplicates
        if entry not in self.signups[day]:
            self.signups[day].append(entry)
            self._save_signups()
        
        return True
    
    def get_signups(self, day):
        """Get all signups for a day"""
        return self.signups.get(day, [])
    
    def get_count(self, day):
        """Get signup count for a day"""
        return len(self.signups.get(day, []))
    
    def clear_signups(self, day):
        """Clear all signups for a day"""
        if day in self.signups:
            self.signups[day] = []
            self._save_signups()
