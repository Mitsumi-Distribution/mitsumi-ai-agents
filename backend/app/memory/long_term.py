from langchain_postgres import PGVector

from app.core.config import settings


def get_vector_store() -> PGVector:
    # Embeddings are intentionally deferred for first pass.
    # Wire this into rag ingestion/retrieval in phase 4.
    return PGVector(
        connection=settings.POSTGRES_URL.replace("+asyncpg", ""),
        embeddings=None,  # type: ignore[arg-type]
        collection_name="memory_embeddings",
    )
