import sys
import os
from sqlalchemy.orm import Session

# Add the parent directory to sys.path to allow importing from app
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.db.database import SessionLocal
from app.db.models import User

def promote_to_admin(identifier: str):
    db: Session = SessionLocal()
    try:
        # Find user by phone or cnic
        user = db.query(User).filter(
            (User.phone == identifier) | (User.cnic == identifier)
        ).first()

        if not user:
            print(f"[-] Error: No user found with phone or CNIC: {identifier}")
            return

        # Check if already admin
        if user.role == "admin":
            print(f"[*] User {user.name} is already an admin.")
            return

        # Update role
        old_role = user.role
        user.role = "admin"
        db.commit()
        
        print(f"[+] Success! User '{user.name}' has been promoted from '{old_role}' to 'admin'.")
        print("    You can now log in and access the Admin Panel.")
    finally:
        db.close()

if __name__ == "__main__":
    print("=== Admin Promotion Tool ===")
    identifier = input("Enter the Phone number or CNIC of the user to promote: ").strip()
    
    # Strip non-numeric chars (similar to register logic)
    import re
    identifier = re.sub(r'[^0-9]', '', identifier)
    
    if not identifier:
        print("[-] Invalid input.")
    else:
        promote_to_admin(identifier)
