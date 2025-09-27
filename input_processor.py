import sys
import json
from agentic_ai import input_processor

if __name__ == "__main__":
    if len(sys.argv) > 1:
        complaint_text = sys.argv[1]
        try:
            result = input_processor(complaint_text)
            # Convert the ResponseSchema object to dict for JSON serialization
            if result:
                print(json.dumps(result.model_dump()))
            else:
                print(json.dumps({"error": "No result returned"}))
        except Exception as e:
            print(json.dumps({"error": str(e)}))
    else:
        print(json.dumps({"error": "No complaint text provided"}))