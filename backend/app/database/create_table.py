from app.models import parent_models
from app.models import child_models

from app.database.parent_db import engine as parent_engine
from app.database.child_db import engine as child_engine


def create_tables():
    parent_models.ParentBase.metadata.create_all(bind=parent_engine)
    child_models.ChildBase.metadata.create_all(bind=child_engine)

    print("✅ Tables created")