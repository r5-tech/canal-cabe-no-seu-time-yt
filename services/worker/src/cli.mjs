// Uso: npm run cli -- <comando>
//   status | fila | sincronizar | processar | aprovar 2026-w48-07 | aprovar-semana 2026-w48 | rejeitar 2026-w48-07 | publicar | retentar 2026-w48-07 | erro 2026-w48-07
import { aprovar, aprovarSemana, comando, marcarPublicados, processarProximo, publicarAprovados, rejeitar, sincronizar } from "./acoes.mjs";

const [cmd, arg] = process.argv.slice(2);
const semHtml = (s) => s.replace(/<[^>]+>/g, "");

switch (cmd) {
  case "sincronizar":
    sincronizar();
    break;
  case "processar":
    sincronizar();
    { let n = 0; while (await processarProximo({ forcar: true })) n++; console.log(n ? `${n} processado(s)` : "nada na fila"); }
    break;
  case "aprovar":
    console.log(await aprovar(arg));
    break;
  case "aprovar-semana":
    console.log(semHtml(await aprovarSemana(arg)));
    break;
  case "rejeitar":
    console.log(await rejeitar(arg));
    break;
  case "publicar":
    await publicarAprovados();
    marcarPublicados();
    break;
  default:
    console.log(semHtml(await comando(`/${cmd ?? "ajuda"} ${arg ?? ""}`.trim())));
}
