# 🎲 Monopoly Online — Multiplayer

A full-featured multiplayer Monopoly game for 2–4 players. Built with Node.js, Express, and Socket.io.

## 🚀 Deploy to Render.com (Free)

### Step 1 — Push to GitHub
1. Create a new repo at github.com
2. Upload this entire folder (drag & drop all files keeping the folder structure)
3. Commit

### Step 2 — Deploy on Render
1. Go to [render.com](https://render.com) → Sign up free
2. Click **New +** → **Web Service**
3. Connect your GitHub repo
4. Render auto-detects settings from `render.yaml` — just click **Deploy**

### That's it! 🎉
Your game will be live at `https://monopoly-online-xxxx.onrender.com`

Players share the link: `https://your-app.onrender.com/room/ROOMCODE`

---

## 💻 Run Locally

```bash
npm install
npm start
# Open http://localhost:3000
```

## How to Play

1. Open the app → **Create New Game**
2. Enter your name, pick a token and color
3. Copy the invite URL and send to friends
4. Host clicks **Start Game** when everyone's in (min 2 players)
5. Take turns rolling dice, buying properties, building houses!
6. Last player standing wins 🏆

## Project Structure

```
monopoly/
├── src/
│   ├── server.js       ← Express + Socket.io server
│   ├── gameEngine.js   ← All game logic
│   └── gameData.js     ← Board spaces, cards, constants
├── public/
│   ├── index.html
│   ├── css/style.css
│   └── js/
│       ├── app.js          ← Client-side game logic
│       └── boardRenderer.js ← Draws the board
├── package.json
└── render.yaml         ← Render.com deploy config
```
