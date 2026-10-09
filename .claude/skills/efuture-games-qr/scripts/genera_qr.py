#!/usr/bin/env python3
"""Efuture Games - genera i 5 QR: app (installazione) + 4 QR di sblocco dei giochi.

Uso:  python3 genera_qr.py CARTELLA_DI_USCITA [--repo PERCORSO_REPO] [--url URL_PUBBLICO]

- L'indirizzo pubblico viene letto da config.js (PUBLIC_URL), salvo --url.
- I codici di sblocco vengono letti da LEGGIMI.txt e verificati contro gli hash
  in hub.js: se un codice non corrisponde, lo script si ferma.
- Nella cartella di uscita crea:
    qr-app.png          QR semplice e quadrato (lo usa classifica.html)
    qr-app-card.png     cartellino "Installa l'app"
    qr-<gioco>.png      cartellino di sblocco per ogni gioco (stessi nomi di qr/)
    anteprima.png       i 5 cartellini affiancati, per vederli al volo
    proposta.html       pagina con i 5 QR affiancati, pronta da stampare
    qr.json             elenco dei QR con il link contenuto in ognuno
Dipendenze: segno, pillow  (pip install segno pillow)
"""
import argparse, os, hashlib, html, io, json, re, sys
from pathlib import Path

try:
    import segno
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("Mancano le librerie: pip install segno pillow")

GAMES = [  # stesso ordine di hub.js
    ("sysadmin", "SysAdmin Runner", "Efuture"),
    ("coretech", "CoreTech Pac", "CoreTech"),
    ("timenet", "Timenet Breakout", "Timenet"),
    ("inncloud", "inncloud Invaders", "inncloud"),
]
NAVY, ORANGE, WHITE, MUTED = "#041a2c", "#f28c1e", "#f2f6fa", "#8fb0c8"
W, H = 776, 1076


def read_config(repo):
    m = re.search(r'PUBLIC_URL:\s*"([^"]+)"', (repo / "config.js").read_text(encoding="utf-8"))
    if not m:
        sys.exit("PUBLIC_URL non trovato in config.js")
    return m.group(1)


def read_codes(repo):
    text = (repo / "LEGGIMI.txt").read_text(encoding="utf-8")
    hub = (repo / "hub.js").read_text(encoding="utf-8")
    codes = {}
    for gid, name, _ in GAMES:
        m = re.search(re.escape(name) + r"\s*\.+\s*([A-Z]{3}-\d{4})", text)
        if not m:
            sys.exit(f"Codice di {name} non trovato in LEGGIMI.txt")
        code = m.group(1)
        h = hashlib.sha256(("efg:" + code.replace("-", "").upper()).encode()).hexdigest()
        hm = re.search(r"id:'" + gid + r"'.*?hash:'([0-9a-f]{64})'", hub, re.S)
        if not hm or hm.group(1) != h:
            sys.exit(f"Il codice {code} di {name} NON corrisponde all'hash in hub.js: QR non generati.")
        codes[gid] = code
    return codes


def qr_image(data, box):
    q = segno.make(data, error="h")  # correzione alta: regge il logo al centro
    buf = io.BytesIO()
    q.save(buf, kind="png", scale=20, border=0, dark=NAVY, light="white")
    buf.seek(0)
    return Image.open(buf).convert("RGB").resize((box, box), Image.NEAREST)


def font(repo, name, size):
    for p in (repo / "fonts" / name, Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf")):
        try:
            return ImageFont.truetype(str(p), size)
        except OSError:
            pass
    return ImageFont.load_default()


def centered(d, y, text, f, fill):
    w = d.textlength(text, font=f)
    d.text(((W - w) / 2, y), text, font=f, fill=fill)


def card(repo, data, title, logo_path, lines, code):
    img = Image.new("RGB", (W, H), NAVY)
    d = ImageDraw.Draw(img)
    centered(d, 40, "EFUTURE GAMES", font(repo, "ibm-plex-mono-latin-600-normal.woff2", 44), ORANGE)
    centered(d, 98, title, font(repo, "ibm-plex-mono-latin-600-normal.woff2", 40), WHITE)
    d.rounded_rectangle((40, 170, W - 40, 866), radius=28, fill="white")
    q = qr_image(data, 592)
    img.paste(q, ((W - 592) // 2, 222))
    if logo_path and logo_path.exists():
        lg = Image.open(logo_path).convert("RGBA").resize((116, 116), Image.LANCZOS)
        cx, cy = W // 2, 222 + 296
        d.rounded_rectangle((cx - 66, cy - 66, cx + 66, cy + 66), radius=24, fill="white")
        img.paste(lg, (cx - 58, cy - 58), lg)
    f = font(repo, "ibm-plex-mono-latin-400-normal.woff2", 28)
    for i, t in enumerate(lines):
        centered(d, 896 + i * 50, t, f, MUTED)
    if code:
        centered(d, 996, code, font(repo, "ibm-plex-mono-latin-600-normal.woff2", 64), ORANGE)
    return img


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--repo", default=os.environ.get("EFG_REPO") or str(next((p for p in Path(__file__).resolve().parents if (p / "config.js").exists()), Path.cwd())))
    ap.add_argument("--url")
    a = ap.parse_args()
    repo, out = Path(a.repo), Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    base = (a.url or read_config(repo)).rstrip("/") + "/"
    codes = read_codes(repo)

    items = []
    app_url = base + "?installa=1"
    segno.make(app_url, error="m").save(str(out / "qr-app.png"), scale=10, border=2, dark=NAVY, light="white")
    card(repo, app_url, "Installa l'app", repo / "icons" / "icon-192.png",
         ["Inquadra con la fotocamera", "e aggiungi l'app alla Home"], None).save(out / "qr-app-card.png")
    items.append({"file": "qr-app-card.png", "titolo": "App – installazione", "stand": "ingresso / ledwall",
                  "link": app_url, "codice": None})
    for gid, name, sponsor in GAMES:
        url = base + "?sblocca=" + codes[gid]
        card(repo, url, "Sblocca " + name, repo / "games" / gid / "icons" / "icon-192.png",
             ["Inquadra con la fotocamera", "oppure inserisci il codice"], codes[gid]).save(out / f"qr-{gid}.png")
        items.append({"file": f"qr-{gid}.png", "titolo": name, "stand": "Stand " + sponsor,
                      "link": url, "codice": codes[gid]})

    # verifica: rileggo ogni QR generato e controllo il link (se zxing-cpp è installato)
    try:
        import zxingcpp
        for it in items + [{"file": "qr-app.png", "link": app_url}]:
            got = [r.text for r in zxingcpp.read_barcodes(Image.open(out / it["file"]))]
            if got != [it["link"]]:
                sys.exit(f"Verifica fallita su {it['file']}: letto {got}")
        verified = True
    except ImportError:
        verified = False

    figs = "\n".join(
        f'<figure><img src="{html.escape(i["file"])}" alt="QR {html.escape(i["titolo"])}">'
        f'<figcaption><b>{html.escape(i["titolo"])}</b> · {html.escape(i["stand"])}<br><code>{html.escape(i["link"])}</code></figcaption></figure>'
        for i in items)
    (out / "proposta.html").write_text(f"""<!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>QR Efuture Games</title>
<style>
@page{{size:A4;margin:10mm}}
body{{margin:0;padding:16px;font-family:system-ui,sans-serif;background:#fff;color:{NAVY}}}
h1{{font-size:18px;margin:0 0 4px}} p{{font-size:13px;margin:0 0 14px;color:#355}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px}}
figure{{margin:0;break-inside:avoid;text-align:center}}
figure img{{width:100%;display:block;border-radius:10px}}
figcaption{{font-size:12px;margin-top:6px}} code{{font-size:10px;word-break:break-all;color:#557}}
@media print{{p.hint{{display:none}} .grid{{grid-template-columns:1fr 1fr}}}}
</style></head><body>
<h1>Efuture Games – i 5 QR</h1>
<p class="hint">App + 4 QR di sblocco. Stampa con Ctrl/Cmd + P e ritaglia i cartellini.</p>
<div class="grid">
{figs}
</div></body></html>
""", encoding="utf-8")
    strip = Image.new("RGB", (W * 5 + 40, H), "white")
    for n, it in enumerate(items):
        strip.paste(Image.open(out / it["file"]), (n * (W + 10), 0))
    strip.resize((strip.width // 2, strip.height // 2), Image.LANCZOS).save(out / "anteprima.png")
    (out / "qr.json").write_text(json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8")
    for i in items:
        print(f'{i["file"]:<18} {i["titolo"]:<22} {i["link"]}')
    print("verifica lettura QR:", "OK" if verified else "saltata (pip install zxing-cpp per attivarla)")
    print("cartella:", out.resolve())


if __name__ == "__main__":
    main()
