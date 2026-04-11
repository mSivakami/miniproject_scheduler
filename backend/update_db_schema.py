import sqlite3
import os

db_path = os.path.join(os.path.dirname(__file__), 'app.db')

def update_schema():
    print(f"Connecting to database at {db_path}...")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    try:
        print("Adding 'short_name' to 'classrooms' table...")
        cursor.execute("ALTER TABLE classrooms ADD COLUMN short_name TEXT")
        print("Successfully added 'short_name' to 'classrooms'.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("'short_name' already exists in 'classrooms'.")
        else:
            print(f"Error adding column to 'classrooms': {e}")

    try:
        print("Adding 'short_name' to 'rooms' table...")
        cursor.execute("ALTER TABLE rooms ADD COLUMN short_name TEXT")
        print("Successfully added 'short_name' to 'rooms'.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("'short_name' already exists in 'rooms'.")
        else:
            print(f"Error adding column to 'rooms': {e}")

    conn.commit()
    conn.close()
    print("Database schema update complete.")

if __name__ == "__main__":
    update_schema()
