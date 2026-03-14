import requests
r = requests.post("http://localhost:8000/seed")
print(r.json())