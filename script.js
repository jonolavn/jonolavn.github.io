/* Simple Spotify Timestamp Player
   - Paste an OAuth access token (with scopes: user-read-playback-state, user-modify-playback-state, streaming) into the token input.
   - Click a track's "Play from timestamp" to transfer playback to this browser and start at the chosen position_ms.
   - NOTE: The user account must be a Spotify Premium account for playback to work.
*/

/* SONGS: name, description (passer til), spotify track uri (full uri or spotify:track:ID), startMs */
const SONGS = [
  { title: "Toto — Rosanna", desc: "Noen kule kristne pga gospel lignende", uri: "spotify:track:37BTh5g05cxBIRYMbw8g2T", startMs: 50000 },
  { title: "Coldplay — Adventure of a Lifetime", desc: "Feel good - hvem som helst", uri: "spotify:track:69uxyAqqPIsUyTO8txoP2M", startMs: 25000 },
  { title: "Toploader — Dancing in the Moonlight", desc: "Feel good - hvem som helst", uri: "spotify:track:3Fzlg5r1IjhLk2qRw667od", startMs: 4000 },
  { title: "Portugal. The Man — Feel It Still", desc: "Feel good - hvem som helst", uri: "spotify:track:6QgjcU0zLnzq5OrUoSZ3OK", startMs: 0 },
  { title: "Coolio — Gangsta's Paradise", desc: "Ironisk til som har masse integritet...", uri: "spotify:track:1DIXPcTDzTj8ZMHt3PDt8p", startMs: 0 },
  { title: "Toto — Hold the Line", desc: "Feel good - hvem som helst", uri: "spotify:track:4aVuWgvD0X63hcOCnZtNFA", startMs: 0 },
  { title: "The Weeknd — Blinding Lights", desc: "Feel good - hvem som helst", uri: "spotify:track:0VjIjW4GlUZAMYd2vXMi3b", startMs: 60000 },
  { title: "Ram Jam — Black Betty", desc: "En rocka fyr", uri: "spotify:track:6kooDsorCpWVMGc994XjWN", startMs: 0 },
  { title: "Coldplay — Magic", desc: "En forelska fyr", uri: "spotify:track:23khhseCLQqVMCIT1WMAns", startMs: 13000 },
  { title: "Wenche Myhre — La meg være ung", desc: "En gammal person", uri: "spotify:track:2qHHVzSTIjzYUy4UeFnzu1", startMs: 0 },
  { title: "Shaggy — It Wasn't Me", desc: "En player", uri: "spotify:track:3WkibOpDF7cQ5xntM1epyf", startMs: 0 },
  { title: "Little Richard — Tutti Frutti", desc: "En morsom eller veldig seriøs fyr", uri: "spotify:track:2iXcvnD3d1gfLBum0cE5Eg", startMs: 0 },
  { title: "Mr. President — Coco Jamboo", desc: "En morsom eller veldig seriøs fyr", uri: "spotify:track:5fRvePkRGdpn2nKacG7I6d", startMs: 0 },
];

const songsContainer = document.getElementById("songs");
const tokenInput = document.getElementById("token");

// render UI
function renderSongs() {
  SONGS.forEach((s, idx) => {
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `
      <div class="info">
        <div class="title">${s.title}</div>
        <div class="subtitle">${s.desc} — start ${msToTime(s.startMs)}</div>
      </div>
      <div class="controls">
        <button data-idx="${idx}" class="play">Play from timestamp</button>
        <a class="link" href="https://open.spotify.com/track/${spotifyIdFromUri(s.uri)}" target="_blank" rel="noopener noreferrer">Open in Spotify</a>
      </div>
    `;
    songsContainer.appendChild(el);
  });
}
renderSongs();

function msToTime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2,"0")}`;
}
function spotifyIdFromUri(uri) {
  // accepts spotify:track:ID or full open.spotify.com/track/ID
  if (!uri) return "";
  if (uri.includes("spotify:track:")) return uri.split("spotify:track:")[1];
  const m = uri.match(/track\/([A-Za-z0-9]+)/);
  return m ? m[1] : uri;
}

/* Spotify player handling */
let spotifyPlayer = null;
let deviceId = null;

window.onSpotifyWebPlaybackSDKReady = () => {
  // We'll create the player once the user provides a token and clicks play.
  // Buttons are attached below.
};

async function createPlayerAndConnect(token) {
  if (spotifyPlayer) return spotifyPlayer;

  spotifyPlayer = new Spotify.Player({
    name: "Jukebox Player",
    getOAuthToken: cb => { cb(token); }
  });

  // Error handling
  spotifyPlayer.addListener('initialization_error', ({message}) => { console.error(message); });
  spotifyPlayer.addListener('authentication_error', ({message}) => { console.error('auth error', message); alert('Auth error: token invalid/expired'); });
  spotifyPlayer.addListener('account_error', ({message}) => { console.error('account error', message); alert('Account error: likely not Premium'); });
  spotifyPlayer.addListener('playback_error', ({message}) => { console.error('playback error', message); });

  // Ready
  spotifyPlayer.addListener('ready', ({ device_id }) => {
    deviceId = device_id;
    console.log('Device ready with id', device_id);
  });

  spotifyPlayer.addListener('not_ready', ({ device_id }) => {
    console.log('Device went offline', device_id);
  });

  await spotifyPlayer.connect();
  return spotifyPlayer;
}

// On click - transfer and play at timestamp
document.addEventListener("click", async (ev) => {
  const btn = ev.target.closest("button.play");
  if (!btn) return;
  const idx = Number(btn.dataset.idx);
  const song = SONGS[idx];
  const rawToken = tokenInput.value.trim();
  if (!rawToken) { alert("Please paste an access token first."); return; }
  btn.disabled = true;
  btn.textContent = "Starting…";

  try {
    // create/connect player
    await createPlayerAndConnect(rawToken);

    if (!deviceId) {
      await new Promise(r => setTimeout(r, 600)); // give SDK a moment
      if (!deviceId) throw new Error("Device ID not available yet — try again in a second");
    }

    // Transfer playback to this device (so our device is the active device)
    await fetch("https://api.spotify.com/v1/me/player", {
      method: "PUT",
      headers: { Authorization: `Bearer ${rawToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ device_ids: [deviceId], play: false })
    });

    // Start playing the track with position_ms
    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${rawToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ uris: [song.uri], position_ms: song.startMs })
    });

    btn.textContent = "Playing ✓";
    setTimeout(()=>btn.textContent = "Play from timestamp", 2000);
  } catch (err) {
    console.error(err);
    alert("Error: " + (err.message || err));
    btn.textContent = "Play from timestamp";
  } finally {
    btn.disabled = false;
  }
});
