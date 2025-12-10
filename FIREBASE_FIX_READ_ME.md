# Troubleshooting Firebase Connection

## 1. Domain Not Authorized (If this persists)
If you have added `lambent-kleicha-0bede4.netlify.app` to **Authorized Domains** and still see the error:

1. **Wait 2 minutes.** Propagation can take a moment.
2. **Refresh the page.**
3. **Check Project ID.** Ensure you added the domain to the project `mytodoapp-bf6d9`, not a different project.
4. **Check for Typos.** The domain must be exact.

## 2. Permission Denied (Database Error)
Once login works, you will likely see a "Permission Denied" error because your current rules block writes.

**How to Fix:**
1. Go to [Firebase Console](https://console.firebase.google.com/) > Firestore Database > Rules.
2. Delete the existing rules.
3. Paste the following:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /appData/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 3. API Key
If you see `auth/api-key-not-valid`, ensure `services/firebase.ts` contains the **Web API Key** from Project Settings (starts with `AIza`), NOT the App ID (starts with `1:`).