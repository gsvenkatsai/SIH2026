import os
from dotenv import load_dotenv
from groq import Groq

load_dotenv()

api_key = os.getenv("GROQ_API_KEY")
client = Groq(api_key=api_key)

for model_id in ["groq/compound-mini", "qwen/qwen3.6-27b", "openai/gpt-oss-20b"]:
    try:
        response = client.chat.completions.create(
            model=model_id,
            messages=[
                {"role": "system", "content": "You are a helpful assistant. Output JSON only."},
                {"role": "user", "content": "Respond with: {\"status\": \"ok\", \"model\": \"" + model_id + "\"}"}
            ],
            response_format={"type": "json_object"}
        )
        print(f"✓ Success with model {model_id}: {response.choices[0].message.content}")
        break
    except Exception as e:
        print(f"x Failed with model {model_id}: {e}")
