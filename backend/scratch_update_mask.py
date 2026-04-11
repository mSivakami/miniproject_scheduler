from database import SessionLocal
from models import ConstraintSettings

db = SessionLocal()
cs = db.query(ConstraintSettings).filter(ConstraintSettings.mini_group_id == None).first()
if cs:
    cs.constraint_mask = 366503876543
    db.commit()
    print("Database updated to Default Mask: 366503876543")
else:
    print("No ConstraintSettings found in DB.")
db.close()
