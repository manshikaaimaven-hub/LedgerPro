from sqlalchemy import create_engine, text
from app.config import settings

def create_database_if_not_exists(db_name: str):
    # Connect to the default 'postgres' database to run CREATE DATABASE
    admin_url = (
        f"postgresql+psycopg2://"
        f"{settings.DB_USER}:"
        f"{settings.DB_PASS}@"
        f"{settings.DB_HOST}:"
        f"{settings.DB_PORT}/postgres"
    )

    engine = create_engine(admin_url)

    with engine.connect() as conn:
        conn.execute(text("COMMIT")) 

        exists = conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = :db_name"),
            {"db_name": db_name},
        ).scalar()

        if not exists:
            conn.execute(text(f'CREATE DATABASE "{db_name}"'))
            print(f"✅ Created database: {db_name}")
        else:
            print(f"ℹ️ Database already exists: {db_name}")

def create_all_databases():
    create_database_if_not_exists(settings.PARENT_DB_NAME)
    create_database_if_not_exists(settings.CHILD_DB_NAME)