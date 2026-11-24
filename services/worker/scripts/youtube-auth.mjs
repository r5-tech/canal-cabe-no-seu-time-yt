// Gera o YT_REFRESH_TOKEN uma única vez. Rode no SEU computador (precisa de navegador):
//   YT_CLIENT_ID=... YT_CLIENT_SECRET=... node scripts/youtube-auth.mjs
// Depois copie o refresh token para o .env da VPS.
import http from "node:http";

const { YT_CLIENT_ID, YT_CLIENT_SECRET } = process.env;
if (!YT_CLIENT_ID || !YT_CLIENT_SECRET) {
  console.error("Defina YT_CLIENT_ID e YT_CLIENT_SECRET");
  process.exit(1);
}
const PORTA = 53682;
const REDIRECT = `http://127.0.0.1:${PORTA}`;
const url =
  "https://accounts.google.com/o/oauth2/v2/auth?" +
  new URLSearchParams({
    client_id: YT_CLIENT_ID,
    redirect_uri: REDIRECT,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/youtube", // upload + playlist da semana,
    access_type: "offline",
    prompt: "consent",
  });

console.log("\n1) Abra no navegador e autorize com a conta do canal:\n\n" + url + "\n");

http
  .createServer(async (req, res) => {
    const code = new URL(req.url, REDIRECT).searchParams.get("code");
    if (!code) return res.end("sem code");
    const r = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: YT_CLIENT_ID,
        client_secret: YT_CLIENT_SECRET,
        redirect_uri: REDIRECT,
        grant_type: "authorization_code",
      }),
    });
    const j = await r.json();
    res.end(j.refresh_token ? "Pronto! Pode fechar esta aba." : "Falhou, veja o terminal.");
    if (j.refresh_token) console.log("2) Coloque no .env:\n\nYT_REFRESH_TOKEN=" + j.refresh_token + "\n");
    else console.error(j);
    process.exit(j.refresh_token ? 0 : 1);
  })
  .listen(PORTA, "127.0.0.1");
