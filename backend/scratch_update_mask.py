from database import SessionLocal
from models import ConstraintSettings

db = SessionLocal()
cs = db.query(ConstraintSettings).filter(ConstraintSettings.mini_group_id == None).first()
if cs:
    cs.constraint_mask = 273707317229
    db.commit()
    print("Database updated to Default Mask: 273707317229")
else:
    print("No ConstraintSettings found in DB.")
db.close()
