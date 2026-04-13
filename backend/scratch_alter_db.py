import sqlite3

db_path = "app.db"

def add_column(cursor, table, col_name, col_def):
    try:
        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col_name} {col_def}")
        print(f"Added {col_name} to {table}")
    except sqlite3.OperationalError as e:
        if "duplicate column" in str(e):
            print(f"Column {col_name} already exists in {table}")
        else:
            print(f"Error adding {col_name}: {e}")

try:
    with sqlite3.connect(db_path) as conn:
        cursor = conn.cursor()
        add_column(cursor, "mini_groups", "teacher_time_off_overrides", "TEXT DEFAULT '{}'")
        add_column(cursor, "mini_groups", "selected_teacher_ids", "TEXT DEFAULT '[]'")
        add_column(cursor, "mini_groups", "selected_class_ids", "TEXT DEFAULT '[]'")
        add_column(cursor, "mini_groups", "selected_room_ids", "TEXT DEFAULT '[]'")
        conn.commit()
    print("Migration successful.")
except Exception as e:
    print(f"Migration failed: {e}")
