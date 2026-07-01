# Private Journal

This single-page app uses Firebase Authentication and Firestore to create a private journal experience.

## Setup
1. Create a Firebase project at https://console.firebase.google.com/.
2. Enable Email/Password authentication in Authentication > Sign-in method.
3. Create a Firestore database.
4. Replace the placeholder values in index.html with your Firebase config.
5. Deploy the security rules from firebase-rules.txt in Firestore Rules.

## Run locally
Open index.html in a browser, or serve the folder with a static server such as:

```bash
python3 -m http.server 8000
```

Then visit http://localhost:8000.
