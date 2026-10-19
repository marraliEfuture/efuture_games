#!/usr/bin/env python3
"""DarkSignal - legge e modifica i dati di https://darksignal.efuture.it/.
Uso:
  ds.py prova [--js]                          controlla il sito e cerca le API
  ds.py get /percorso [-q k=v ...] [-o file]  legge
  ds.py post|put|patch|delete /percorso [--json '{...}' | --form k=v ...] [--si]
Le scritture senza --si mostrano solo cosa verrebbe inviato.
Accesso: variabili DARKSIGNAL_URL, DARKSIGNAL_TOKEN, DARKSIGNAL_COOKIE, DARKSIGNAL_HEADER."""
import argparse, http.cookiejar, json, os, re, ssl, sys, time
import urllib.error, urllib.parse, urllib.request

BASE = os.environ.get("DARKSIGNAL_URL", "https://darksignal.efuture.it").rstrip("/")
TIPICI = ["/robots.txt", "/sitemap.xml", "/api", "/api/", "/api/v1", "/api/docs", "/openapi.json",
          "/swagger.json", "/swagger", "/docs", "/redoc", "/graphql", "/login", "/health"]


def apri(args):
    ca = os.environ.get("SSL_CERT_FILE") or os.environ.get("REQUESTS_CA_BUNDLE")
    if not ca and os.path.exists("/root/.ccr/ca-bundle.crt"):
        ca = "/root/.ccr/ca-bundle.crt"
    jar = http.cookiejar.MozillaCookieJar(args.cookie_jar) if args.cookie_jar else http.cookiejar.CookieJar()
    if args.cookie_jar and os.path.exists(args.cookie_jar):
        jar.load(ignore_discard=True)
    opener = urllib.request.build_opener(
        urllib.request.HTTPSHandler(context=ssl.create_default_context(cafile=ca)),
        urllib.request.HTTPCookieProcessor(jar))
    return opener, jar


def intestazioni():
    h = {"User-Agent": "efuture-games-darksignal", "Accept": "application/json, text/html;q=0.9, */*;q=0.5"}
    if os.environ.get("DARKSIGNAL_TOKEN"):
        h["Authorization"] = "Bearer " + os.environ["DARKSIGNAL_TOKEN"]
    if os.environ.get("DARKSIGNAL_COOKIE"):
        h["Cookie"] = os.environ["DARKSIGNAL_COOKIE"]
    if ":" in os.environ.get("DARKSIGNAL_HEADER", ""):
        k, v = os.environ["DARKSIGNAL_HEADER"].split(":", 1)
        h[k.strip()] = v.strip()
    return h


def url_di(percorso, query=()):
    u = percorso if percorso.startswith("http") else BASE + "/" + percorso.lstrip("/")
    if query:
        u += ("&" if "?" in u else "?") + urllib.parse.urlencode([tuple(q.split("=", 1)) for q in query])
    return u


def richiesta(opener, metodo, url, corpo=None, tipo=None):
    h = intestazioni()
    if tipo:
        h["Content-Type"] = tipo
    req = urllib.request.Request(url, data=corpo, headers=h, method=metodo)
    try:
        r = opener.open(req, timeout=30)
        return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()
    except urllib.error.URLError as e:
        msg = str(e.reason)
        if "403" in msg or "Tunnel" in msg:
            msg += "  -> il proxy dell'ambiente blocca il dominio: aggiungilo agli Allowed domains"
        print(f"ERRORE di connessione verso {url}: {msg}", file=sys.stderr)
        sys.exit(2)


def mostra(stato, h, corpo, uscita=None, breve=False):
    tipo = h.get("Content-Type", "")
    print(f"HTTP {stato}  {tipo}  {len(corpo)} byte")
    if uscita:
        with open(uscita, "wb") as f:
            f.write(corpo)
        print(f"salvato in {uscita}")
        return
    testo = corpo.decode("utf-8", "replace")
    if "json" in tipo:
        try:
            testo = json.dumps(json.loads(testo), ensure_ascii=False, indent=2)
        except ValueError:
            pass
    print(testo[:600] if breve else testo[:20000])
    if not breve and len(testo) > 20000:
        print(f"... (tagliato: {len(testo)} caratteri, usa -o per salvare tutto)")


def prova(opener, js):
    stato, h, corpo = richiesta(opener, "GET", BASE + "/")
    html = corpo.decode("utf-8", "replace")
    titolo = re.search(r"<title[^>]*>(.*?)</title>", html, re.S | re.I)
    print(f"{BASE}/  ->  HTTP {stato}  {h.get('Content-Type', '')}  titolo: {titolo.group(1).strip() if titolo else '-'}")
    for k in ("Server", "X-Powered-By", "Set-Cookie", "WWW-Authenticate", "Location"):
        if k in h:
            print(f"  {k}: {h[k][:120]}")
    if re.search(r"type=[\"']password", html, re.I):
        print("  la pagina contiene un modulo di login")
    script = sorted(set(re.findall(r"<script[^>]+src=[\"']([^\"']+)", html, re.I)))
    if script:
        print("  script: " + ", ".join(script[:15]))
    print("\nindirizzi tipici:")
    for p in TIPICI:
        s, hh, c = richiesta(opener, "GET", BASE + p)
        print(f"  {s}  {p:16} {hh.get('Content-Type', '')[:40]}  {len(c)} byte")
    if js:
        trovati = set()
        for s in script[:15]:
            _, _, c = richiesta(opener, "GET", urllib.parse.urljoin(BASE + "/", s))
            trovati |= set(re.findall(r"[\"'`](/api/[A-Za-z0-9_\-/{}.:]*)", c.decode("utf-8", "replace")))
        print("\npercorsi /api trovati nel JavaScript:")
        for t in sorted(trovati):
            print("  " + t)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("azione", choices=["prova", "get", "post", "put", "patch", "delete"])
    ap.add_argument("percorso", nargs="?", default="/")
    ap.add_argument("-q", "--query", action="append", default=[], help="parametro k=v (ripetibile)")
    ap.add_argument("-o", "--uscita", help="salva la risposta in questo file")
    ap.add_argument("--json", help="corpo JSON (testo o @file)")
    ap.add_argument("--form", action="append", default=[], help="campo di modulo k=v (ripetibile)")
    ap.add_argument("--si", action="store_true", help="esegui davvero la scrittura")
    ap.add_argument("--js", action="store_true", help="con prova: cerca i percorsi /api nei file JavaScript")
    ap.add_argument("--cookie-jar", help="file dove tenere i cookie tra una richiesta e l'altra")
    ap.add_argument("--pausa", type=float, default=0, help="secondi di attesa prima della richiesta")
    args = ap.parse_args()

    opener, jar = apri(args)
    if args.pausa:
        time.sleep(args.pausa)
    if args.azione == "prova":
        prova(opener, args.js)
    else:
        corpo = tipo = None
        if args.json:
            testo = open(args.json[1:], encoding="utf-8").read() if args.json.startswith("@") else args.json
            json.loads(testo)  # controlla che sia JSON valido
            corpo, tipo = testo.encode("utf-8"), "application/json"
        elif args.form:
            corpo = urllib.parse.urlencode([tuple(f.split("=", 1)) for f in args.form]).encode()
            tipo = "application/x-www-form-urlencoded"
        url = url_di(args.percorso, args.query)
        metodo = args.azione.upper()
        if metodo != "GET" and not args.si:
            print(f"PROVA (niente inviato): {metodo} {url}")
            if corpo:
                print(corpo.decode("utf-8")[:5000])
            print("Aggiungi --si, dopo la conferma dell'utente, per inviarla davvero.")
            return
        mostra(*richiesta(opener, metodo, url, corpo, tipo), uscita=args.uscita)
    if args.cookie_jar:
        jar.save(ignore_discard=True)


if __name__ == "__main__":
    main()
