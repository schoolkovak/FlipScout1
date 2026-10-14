#!/usr/bin/env python3
"""Similarity gate and publish guard for the Aced question bank.

The official ACT reference tests are NEVER stored in this repository. Point --ref at a
private directory holding the extracted reference text (files named t<N>_<section>.txt).

  gate   Compare generated units (JSON) against the reference tests. Each unit gets
         PASS / REVIEW / REJECT with the evidence behind it. REVIEW units go to an
         independent human/agent review; REJECT units must be rewritten from scratch.
  guard  Scan every text file under a directory (the publishable site) and fail if any
         distinctive reference word sequence appears. Run before every publish.
  calibrate  Print the similarity that unrelated official passages have with each other,
         which is the baseline the thresholds are set against.

Checks (all lexical/statistical; they are safeguards, not guarantees):
  shared8   distinctive 8-word sequences shared with the reference (exact reuse)
  contain6  share of the unit's distinctive 6-grams found in the reference (near-verbatim)
  cosine    TF-IDF cosine vs. sliding windows of each reference section (paraphrase/topic)
  terms     overlap of the 25 most distinctive terms (scenario/setup similarity)
  numbers   shared non-trivial numbers with a matching reference window (numeric setups)
  choices   long answer-choice strings that occur verbatim in the reference
"""
import argparse, json, math, os, re, sys
from collections import Counter, defaultdict

STOP = set("""a about above after again against all am an and any are as at be because been before being below between
both but by can could did do does doing down during each few for from further had has have having he her here hers herself
him himself his how i if in into is it its itself just me more most my myself no nor not now of off on once only or other our
ours ourselves out over own same she should so some such than that the their theirs them themselves then there these they this
those through to too under until up very was we were what when where which while who whom why will with would you your yours
yourself yourselves also one two three may might must shall upon within without whether""".split())

BOILER = re.compile(r"(©.*?reserved\.|page \d+ of \d+\S*|go on to the next page|do your figuring here|end of test \d|"
                    r"stop! do not turn the page.*|qu0\d+\S*|no change)", re.I)


def norm(text):
    text = text.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')
    text = re.sub(r"<[^>]+>", " ", text)            # strip HTML from generated units
    text = re.sub(r"\{\d+\|([^}]*)\}", r"\1", text)  # English underline markup {n|text}
    text = BOILER.sub(" ", text.lower())
    return re.findall(r"[a-z0-9]+(?:'[a-z]+)?|\d+(?:\.\d+)?", text)


def stem(w):
    for suf in ("ingly", "edly", "ing", "ed", "ies", "es", "ly", "s"):
        if len(w) > len(suf) + 3 and w.endswith(suf):
            return w[: -len(suf)] + ("y" if suf == "ies" else "")
    return w


def content(words):
    return [stem(w) for w in words if w not in STOP and not w.isdigit() and len(w) > 2]


def ngrams(words, n):
    return {" ".join(words[i:i + n]) for i in range(len(words) - n + 1)}


def numbers(words):
    out = set()
    for w in words:
        try:
            v = float(w)
        except ValueError:
            continue
        if v > 12 and v not in (100, 1000, 2000):
            out.add(w)
    return out


class Reference:
    def __init__(self, ref_dir):
        self.sections = {}
        for f in sorted(os.listdir(ref_dir)):
            m = re.match(r"t(\d)_(english|math|reading|science)\.txt$", f)
            if m:
                self.sections[(int(m.group(1)), m.group(2))] = norm(open(os.path.join(ref_dir, f), encoding="utf-8").read())
        if not self.sections:
            sys.exit(f"no reference files t<N>_<section>.txt found in {ref_dir}")
        # Official forms reuse items verbatim, so "appears in 2 tests" does NOT mean boilerplate.
        # Generic = words used in every one of the reference tests (directions, stem vocabulary,
        # math conventions such as "standard (x,y) coordinate plane"). An n-gram is ignored only
        # when it appears in 3+ tests or when all of its content words are generic.
        words_by_test = defaultdict(set)
        by_test = defaultdict(lambda: defaultdict(set))
        for (t, sec), words in self.sections.items():
            words_by_test[t] |= set(words)
            for n in (6, 8):
                by_test[n][t] |= ngrams(words, n)
        tests = list(words_by_test)
        self.generic = set.intersection(*words_by_test.values()) if len(tests) > 1 else set()
        self.distinct = {}
        for n in (6, 8):
            count = Counter(g for grams in by_test[n].values() for g in grams)
            self.distinct[n] = {g for g, c in count.items() if c < 3 and not self.is_generic(g)}
        self.fulltext = {k: " ".join(v) for k, v in self.sections.items()}
        # sliding windows for cosine / term / number checks
        self.windows = []
        for (t, sec), words in self.sections.items():
            size, step = (90, 45) if sec == "math" else (260, 130)
            for i in range(0, max(1, len(words) - size // 2), step):
                w = words[i:i + size]
                self.windows.append({"test": t, "sec": sec, "at": i, "words": w, "terms": Counter(content(w)), "nums": numbers(w)})
        df = Counter()
        for w in self.windows:
            df.update(set(w["terms"]))
        self.N = len(self.windows)
        self.idf = {t: math.log((1 + self.N) / (1 + c)) + 1 for t, c in df.items()}
        for w in self.windows:
            w["vec"] = self.vec(w["terms"])

    def is_generic(self, gram):
        toks = [w for w in gram.split() if w not in STOP and not re.fullmatch(r"\d+(\.\d+)?", w)]
        return all(w in self.generic for w in toks)

    def idf_of(self, t):
        return self.idf.get(t, math.log(1 + self.N) + 1)

    def vec(self, terms):
        v = {t: (1 + math.log(c)) * self.idf_of(t) for t, c in terms.items()}
        n = math.sqrt(sum(x * x for x in v.values())) or 1.0
        return {t: x / n for t, x in v.items()}

    def top_terms(self, terms, k=25):
        return {t for t, _ in sorted(terms.items(), key=lambda kv: -(1 + math.log(kv[1])) * self.idf_of(kv[0]))[:k]}

    def compare(self, text, sec=None):
        words = norm(text)
        res = {}
        g8 = ngrams(words, 8) & self.distinct[8]
        res["shared8"] = sorted(g8)[:10]
        g6 = ngrams(words, 6)
        res["contain6"] = round(len(g6 & self.distinct[6]) / max(1, len(g6)), 4)
        terms = Counter(content(words))
        v = self.vec(terms)
        mine_top = self.top_terms(terms)
        nums = numbers(words)
        best = {"cosine": 0.0}
        best_terms = {"terms": 0.0}
        best_nums = {"shared": []}
        for w in self.windows:
            cos = sum(x * w["vec"].get(t, 0.0) for t, x in v.items())
            if cos > best["cosine"]:
                best = {"cosine": round(cos, 4), "test": w["test"], "sec": w["sec"], "at": w["at"]}
            tt = self.top_terms(w["terms"])
            jac = len(mine_top & tt) / max(1, len(mine_top | tt))
            if jac > best_terms["terms"]:
                best_terms = {"terms": round(jac, 4), "test": w["test"], "sec": w["sec"], "at": w["at"], "common": sorted(mine_top & tt)}
            shared = nums & w["nums"]
            if len(shared) > len(best_nums["shared"]) and cos > 0.12:
                best_nums = {"shared": sorted(shared), "test": w["test"], "sec": w["sec"], "at": w["at"], "cosine": round(cos, 4)}
        res.update(best_match=best, cosine=best["cosine"], terms=best_terms, numbers=best_nums)
        return res


TH = {  # thresholds; calibrated against cross-test similarity of unrelated official passages (see `calibrate`)
    "contain6_review": 0.02, "contain6_reject": 0.06,
    "numbers_review": 3,
    "choice_review_len": 18, "choice_reject_len": 30,
}
# Unrelated official passages reach cosine p99 ~0.24 (reading) / ~0.30 (science); math windows are short and
# share vocabulary heavily (p50 ~0.31), so math relies more on 8-grams and numeric fingerprints.
TH_SEC = {
    "english": {"cosine_review": 0.30, "cosine_reject": 0.45, "terms_review": 0.20, "terms_reject": 0.35},
    "reading": {"cosine_review": 0.28, "cosine_reject": 0.42, "terms_review": 0.18, "terms_reject": 0.33},
    "science": {"cosine_review": 0.36, "cosine_reject": 0.50, "terms_review": 0.24, "terms_reject": 0.40},
    "math":    {"cosine_review": 0.62, "cosine_reject": 0.82, "terms_review": 0.45, "terms_reject": 0.65},
}


def unit_text(u):
    parts = [u.get("title", ""), u.get("passage", "")]
    for fig in u.get("figures", []) or []:
        parts.append(json.dumps(fig))
    for it in u.get("items", []):
        parts.append(it.get("q", ""))
        parts.extend(it.get("c", []))
    return "\n".join(parts)


def verdict(r, choice_hits, sec=None):
    reasons, level = [], "PASS"
    ts = TH_SEC.get(sec or r["best_match"].get("sec"), TH_SEC["english"])

    def bump(lv, why):
        nonlocal level
        order = ["PASS", "REVIEW", "REJECT"]
        if order.index(lv) > order.index(level):
            level = lv
        reasons.append(why)

    if r["shared8"]:
        bump("REJECT", f"{len(r['shared8'])} distinctive 8-word sequence(s) copied from reference")
    if r["contain6"] >= TH["contain6_reject"]:
        bump("REJECT", f"contain6 {r['contain6']}")
    elif r["contain6"] >= TH["contain6_review"]:
        bump("REVIEW", f"contain6 {r['contain6']}")
    if r["cosine"] >= ts["cosine_reject"]:
        bump("REJECT", f"cosine {r['cosine']} vs test {r['best_match'].get('test')} {r['best_match'].get('sec')}")
    elif r["cosine"] >= ts["cosine_review"]:
        bump("REVIEW", f"cosine {r['cosine']} vs test {r['best_match'].get('test')} {r['best_match'].get('sec')}")
    tj = r["terms"].get("terms", 0)
    if tj >= ts["terms_reject"]:
        bump("REJECT", f"scenario terms overlap {tj}: {r['terms'].get('common')}")
    elif tj >= ts["terms_review"]:
        bump("REVIEW", f"scenario terms overlap {tj}: {r['terms'].get('common')}")
    if len(r["numbers"].get("shared", [])) >= TH["numbers_review"]:
        bump("REVIEW", f"shared numbers {r['numbers']['shared']} with a similar reference window")
    for c, ln in choice_hits:
        bump("REJECT" if ln >= TH["choice_reject_len"] else "REVIEW", f"answer choice found verbatim in reference: {c[:60]}")
    return level, reasons


def cmd_gate(args):
    ref = Reference(args.ref)
    units = []
    for path in args.bank:
        data = json.load(open(path, encoding="utf-8"))
        units.extend(data if isinstance(data, list) else data.get("units", [data]))
    alltext = " ".join(ref.fulltext.values())
    report = []
    for u in units:
        r = ref.compare(unit_text(u), u.get("sec"))
        hits = []
        for it in u.get("items", []):
            for c in it.get("c", []):
                cn = " ".join(norm(c))
                if len(cn) >= TH["choice_review_len"] and cn in alltext:
                    hits.append((c, len(cn)))
        # per-item check catches a copied item hiding inside an original passage
        item_flags = []
        for it in u.get("items", []):
            ir = ref.compare(it.get("q", "") + "\n" + "\n".join(it.get("c", [])))
            if ir["shared8"] or ir["contain6"] >= TH["contain6_reject"]:
                item_flags.append({"item": it.get("n"), "shared8": ir["shared8"], "contain6": ir["contain6"]})
        level, reasons = verdict(r, hits, u.get("sec"))
        if item_flags:
            level = "REJECT"
            reasons.append(f"item-level copy detected: {item_flags}")
        report.append({"id": u.get("id"), "sec": u.get("sec"), "status": level, "reasons": reasons, "metrics": {
            "contain6": r["contain6"], "cosine": r["cosine"], "best": r["best_match"], "terms": r["terms"], "numbers": r["numbers"]}})
    summary = Counter(x["status"] for x in report)
    out = {"summary": dict(summary), "thresholds": {"global": TH, "section": TH_SEC}, "units": report}
    if args.out:
        json.dump(out, open(args.out, "w"), indent=1)
    print(json.dumps(out["summary"]))
    for x in report:
        if x["status"] != "PASS":
            print(x["status"], x["id"], "|", "; ".join(x["reasons"]))
    return 1 if summary.get("REJECT") else 0


def cmd_guard(args):
    ref = Reference(args.ref)
    bad = []
    for root, _, files in os.walk(args.site):
        if "/tools" in root or "/node_modules" in root:
            continue
        for f in files:
            if not f.endswith((".js", ".html", ".json", ".md", ".css", ".txt")):
                continue
            p = os.path.join(root, f)
            words = norm(open(p, encoding="utf-8", errors="ignore").read())
            hit = ngrams(words, 8) & ref.distinct[8]
            if hit:
                bad.append((p, sorted(hit)[:5]))
    if bad:
        for p, h in bad:
            print("REFERENCE TEXT FOUND:", p, h)
        return 1
    print(f"publish guard: clean ({args.site})")
    return 0


def cmd_calibrate(args):
    ref = Reference(args.ref)
    vals = defaultdict(list)
    for w in ref.windows:
        best = 0.0
        tbest = 0.0
        top = ref.top_terms(w["terms"])
        for o in ref.windows:
            if o["test"] == w["test"] or o["sec"] != w["sec"]:
                continue
            best = max(best, sum(x * o["vec"].get(t, 0.0) for t, x in w["vec"].items()))
            ot = ref.top_terms(o["terms"])
            tbest = max(tbest, len(top & ot) / max(1, len(top | ot)))
        vals[(w["sec"], "cos")].append(best)
        vals[(w["sec"], "terms")].append(tbest)
    for k, v in sorted(vals.items()):
        v.sort()
        q = lambda p: round(v[min(len(v) - 1, int(p * len(v)))], 3)
        print(k, "n", len(v), "p50", q(.5), "p90", q(.9), "p99", q(.99), "max", round(v[-1], 3))


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    g = sub.add_parser("gate"); g.add_argument("--ref", required=True); g.add_argument("--out"); g.add_argument("bank", nargs="+")
    s = sub.add_parser("guard"); s.add_argument("--ref", required=True); s.add_argument("site")
    c = sub.add_parser("calibrate"); c.add_argument("--ref", required=True)
    a = ap.parse_args()
    sys.exit({"gate": cmd_gate, "guard": cmd_guard, "calibrate": cmd_calibrate}[a.cmd](a))


if __name__ == "__main__":
    main()
