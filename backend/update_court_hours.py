#!/usr/bin/env python3
"""
Script to update court opening hours to 24h (00:00 - 23:30)
This ensures all time slots from 00:00 to 23:30 are generated
"""

import sqlite3
import os

def update_court_hours():
    db_path = os.path.join(os.path.dirname(__file__), 'badminton_dev.db')
    
    if not os.path.exists(db_path):
        print(f"Database not found: {db_path}")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check current court hours
    cursor.execute("SELECT id, name, open_time, close_time FROM courts WHERE is_active = 1")
    courts = cursor.fetchall()
    
    print("Current court hours:")
    for court in courts:
        print(f"  Court {court[0]}: {court[1]} | {court[2]} - {court[3]}")
    
    # Update to 24h
    cursor.execute("UPDATE courts SET open_time = '00:00', close_time = '23:30' WHERE is_active = 1")
    conn.commit()
    
    print(f"\nUpdated {cursor.rowcount} courts to 24h operation (00:00 - 23:30)")
    
    # Verify
    cursor.execute("SELECT id, name, open_time, close_time FROM courts WHERE is_active = 1")
    courts = cursor.fetchall()
    
    print("\nNew court hours:")
    for court in courts:
        print(f"  Court {court[0]}: {court[1]} | {court[2]} - {court[3]}")
    
    conn.close()
    print("\nDone! Please restart the backend server to apply changes.")
    return True

if __name__ == "__main__":
    update_court_hours()
