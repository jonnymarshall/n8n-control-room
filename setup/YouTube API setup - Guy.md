# Getting YouTube uploads automated

Prepared 2026-11-02 for Guy. Status: not started, message not yet sent. Kept here so it can be re-sent or walked through on a call.

---

Hey Guy,

I want to take the manual YouTube upload off your plate. Once this is set up, our system will upload each episode with its title, description, chapters and thumbnail, then hand us back the video link. It only has to be done once.

I can't do this part for you because it has to be created inside the Google account that owns the YouTube channel. I'm not asking for your password and I won't need it. Everything below happens in Google's own settings pages.

It takes about 15 minutes, and I'm happy to do it with you on a screenshare if that's easier. If you'd rather do it solo, here is the exact path.

## Step 1. Open the Google Cloud Console

Go to **console.cloud.google.com** and sign in with the Google account that owns or manages the Guy's Take channel. This is a different site from YouTube, but it's the same Google login. Accept the terms if it asks.

## Step 2. Create a project

In the top bar, open the project dropdown and choose **New project**. Name it **Guy's Take Publishing**. Create it, then make sure it is the selected project.

## Step 3. Turn on the YouTube API

Left menu, **APIs and Services**, then **Library**. Search for **YouTube Data API v3**. Open it and click **Enable**.

## Step 4. Set up the consent screen

**APIs and Services**, then **OAuth consent screen**.

- If it asks for a user type: choose **Internal** if this is a Google Workspace account, or **External** if it's a normal Gmail account. If you're not sure, choose External.
- App name: **Guy's Take Publishing**. Fill in your email for the support and developer contact fields.
- Scopes: add these two:
  - `https://www.googleapis.com/auth/youtube.upload`
  - `https://www.googleapis.com/auth/youtube`
- Save. If you chose External, add your own email under **Test users**.

## Step 5. Create the key

**APIs and Services**, then **Credentials**, then **Create credentials**, then **OAuth client ID**.

- Application type: **Web application**.
- Name: **n8n**.
- Under **Authorised redirect URIs**, click Add and paste this exactly:

```
https://vmi3181229.contaboserver.net/rest/oauth2-credential/callback
```

- Click Create.
- Copy the **Client ID** and **Client secret** and send them to me. These are app keys, not your password. Please don't post them in the group chat; email or a direct message is fine.

## Step 6. Publish the app

Back on the **OAuth consent screen** page, click **Publish app**. This is the step that stops the connection from expiring every week. If Google says the app needs verification, don't submit anything, just tell me and we'll finish it together.

## Step 7. The final click, together

The very last step needs you signed into Google while we're inside our automation tool. It is a single **Allow** click. That's the part I'd like to do on a quick call or screenshare.

## What you will see

Google may warn that it hasn't verified this app. That's expected for a private tool like ours. Click **Advanced**, then **Go to Guy's Take Publishing**.

You are only granting permission to upload videos. It cannot delete videos, read your email, or change your password, and you can revoke it at any time at **myaccount.google.com/permissions**.

## If you'd rather not do the clicking

That's completely fine. Give me 15 minutes on a call and I'll walk you through it, or share your screen and I'll tell you exactly where to click.

Thanks,
Jonny
