import requests
import json

def test_metadata_extraction(id_token):
    # URL to test
    test_url = "https://www.example.com"
    
    try:
        # Make request to the function
        response = requests.post(
            'https://us-central1-curate-f809d.cloudfunctions.net/extract_metadata',
            headers={
                'Content-Type': 'application/json',
                'Authorization': f'Bearer {id_token}'
            },
            json={'url': test_url}
        )
        
        print(f"Status code: {response.status_code}")
        print("Response:")
        print(json.dumps(response.json(), indent=2))
        
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    # Get the ID token from command line argument
    import sys
    if len(sys.argv) < 2:
        print("Please provide an ID token as argument")
        sys.exit(1)
    
    id_token = sys.argv[1]
    test_metadata_extraction(id_token) 