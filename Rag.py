from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import requests

# Load embedding model
model = SentenceTransformer("all-MiniLM-L6-v2")

# Read the document
with open("data/info.text", "r") as f:
    content = f.read()

# Create chunks
chunks = content.split(".")

# Remove empty chunks
chunks = [chunk.strip() for chunk in chunks if chunk.strip()]

# Create embeddings for all chunks
embeddings = model.encode(chunks)

print("RAG Chatbot is ready!")
print("Type 'exit' to stop.\n")

while True:

    # Get user question
    query = input("You: ")

    # Exit chatbot
    if query.lower() == "exit":
        print("Goodbye!")
        break

    # Convert question into an embedding
    query_embedding = model.encode([query])

    # Calculate similarity
    similarities = cosine_similarity(
        query_embedding,
        embeddings
    )[0]

    # Get top 3 relevant chunks
    top_indices = similarities.argsort()[-3:][::-1]

    # Build context
    context = "\n".join(
        chunks[index]
        for index in top_indices
    )

    print("\nRetrieved context:")
    print(context)

    # Send context + question to local Llama
    response = requests.post(
        "http://localhost:11434/api/chat",
        json={
            "model": "llama3.2:3b",
            "messages": [
                {
                    "role": "system",
                    "content": (
                        "Answer using only the provided context. "
                        "If the answer is not in the context, say "
                        "'I don't know based on the provided information.'"
                    )
                },
                {
                    "role": "user",
                    "content": f"""
Context:
{context}

Question:
{query}
"""
                }
            ],
            "stream": False
        }
    )

    # Check for errors
    response.raise_for_status()

    result = response.json()

    print("\nAI:", result["message"]["content"])
    print()
    

