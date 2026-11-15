"""Tests for file-graph. Run: python3 -m unittest discover -s tests -v (from the skill root)."""
import csv
import io
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import build_graph as bg  # noqa: E402

C1 = "11111111-1111-4111-8111-111111111111"
C2 = "22222222-2222-4222-8222-222222222222"
P1 = "01990000-0000-7000-8000-000000000001"


def payload(**over):
    d = {
        "schema": "file-graph/v1", "generated_at": "2026-10-12T00:00:00Z", "source": "test", "pattern": "*",
        "totals": {"all_files": 6, "matched": 6, "truncated": False},
        "files": [
            {"id": "f1", "n": "maxey0.csv", "sz": 100, "mt": "text/csv", "at": "2026-10-01T00:00:00Z", "sf": "chat", "c": [C1], "p": None},
            {"id": "f2", "n": "Maxey0-SCWs.tsx", "sz": 2048, "mt": "", "at": "2026-10-02T00:00:00Z", "sf": "chat", "c": [C1], "p": None},
            {"id": "f3", "n": "page_block.tsx", "sz": 10, "mt": None, "at": "2026-10-03T00:00:00Z", "sf": "session", "c": [C2], "p": None},
            {"id": "f4", "n": "honeycombs.pdf", "sz": 5, "mt": "application/pdf", "at": "2026-07-02T00:00:00Z", "sf": "project", "c": [], "p": P1},
            {"id": "f5", "n": "old.tsx", "sz": 1, "mt": None, "at": "2026-06-01T00:00:00Z", "sf": "chat", "c": [], "p": None},
            {"id": "f6", "n": "</script><img src=x onerror=alert(1)>.txt", "sz": 1, "mt": None, "at": None, "sf": "chat", "c": ["33333333-3333-4333-8333-333333333333"], "p": None},
        ],
        "convs": {C1: {"n": "SCW chat", "u": "2026-10-12T00:00:00Z", "p": P1, "a": False},
                  C2: {"n": "Session chat", "u": None, "p": None, "a": True}},
        "projects": {P1: "AgenticNodeNetwork"},
    }
    d.update(over)
    return d


class Matching(unittest.TestCase):
    def check(self, pat, names, expected):
        m = bg.compile_pattern(pat)
        self.assertEqual([n for n in names if m(n)], expected, pat)

    NAMES = ["maxey0.csv", "Maxey0-SCWs.tsx", "my_maxey0.csv", "a.TSX", "b.tsx.bak", "img_01.png", "img_1.png", "x(1).pdf", "a.b"]

    def test_exact_or_partial_is_substring(self):
        self.check("maxey0.csv", self.NAMES, ["maxey0.csv", "my_maxey0.csv"])

    def test_prefix_glob_case_insensitive_and_anchored(self):
        self.check("maxey0*", self.NAMES, ["maxey0.csv", "Maxey0-SCWs.tsx"])

    def test_extension_glob_anchored_at_end(self):
        self.check("*.tsx", self.NAMES, ["Maxey0-SCWs.tsx", "a.TSX"])

    def test_question_mark_is_one_char(self):
        self.check("img_??.png", self.NAMES, ["img_01.png"])

    def test_regex_metacharacters_are_literal(self):
        self.check("*(1).pdf", self.NAMES, ["x(1).pdf"])
        self.check("a.b", self.NAMES, ["a.b"])  # '.' is not 'any char'
        self.check("?.b", self.NAMES, ["a.b"])

    def test_empty_and_star_match_all(self):
        for p in ("", "*", "  "):
            self.check(p, self.NAMES, self.NAMES)

    @unittest.skipUnless(shutil.which("node"), "node not installed")
    def test_parity_with_collector_js(self):
        js = (ROOT / "scripts" / "collect.js").read_text()
        start = js.index("const compile = (p) => {")
        end = js.index("};", js.index("return (n) => n.toLowerCase().includes(needle);")) + 2
        pats = ["maxey0.csv", "maxey0*", "*.tsx", "img_??.png", "*(1).pdf", "a.b", "?.b", "", "*"]
        prog = js[start:end] + f"\nconst P={json.dumps(pats)},N={json.dumps(self.NAMES)};" \
               "console.log(JSON.stringify(P.map(p=>N.filter(compile(p)))));"
        out = json.loads(subprocess.run(["node", "-e", prog], capture_output=True, text=True, check=True).stdout)
        py = [[n for n in self.NAMES if bg.compile_pattern(p)(n)] for p in pats]
        self.assertEqual(out, py)


class CsvParsing(unittest.TestCase):
    def test_split_name_size(self):
        self.assertEqual(bg.split_name_size("view-1.png363.8 KB"), ("view-1.png", 372531))
        self.assertEqual(bg.split_name_size("archive.zip3 MB"), ("archive.zip", 3 * 1024 ** 2))
        self.assertEqual(bg.split_name_size("notes.txt42 B"), ("notes.txt", 42))
        self.assertEqual(bg.split_name_size("cohan_last.pdf"), ("cohan_last.pdf", None))  # no size in copy
        self.assertEqual(bg.split_name_size("2 KB"), ("2 KB", None))  # never leave an empty name

    def write_csv(self, rows):
        tmp = Path(tempfile.mkdtemp()) / "u.csv"
        with tmp.open("w", encoding="utf-8-sig", newline="") as fh:
            w = csv.writer(fh)
            w.writerow(["Name", "Uploaded", "Surface", "Location"])
            w.writerows(rows)
        return tmp

    def test_load_csv_groups_without_urls(self):
        p = self.write_csv([
            ["view-1.png363.8 KB", "12-Oct-26", "Chat", "1 chat"],
            ["two.txt1 KB", "1-Oct-26", "Chat", "2 chats"],
            ["gone.pdf", "28-Jun-26", "CodeCowork", "—"],
            ["honeycombs.pdf6.4 MB", "2-Jul-26", "Project", "AgenticNodeNetwork"],
        ])
        src = bg.load_csv(p)
        self.assertFalse(src["has_urls"])
        self.assertEqual(len(src["files"]), 4)
        self.assertEqual(src["files"][0]["created"], "2026-10-12")
        self.assertEqual(src["files"][2]["surface"], "session")
        self.assertTrue(all(c["url"] is None for c in src["chats"].values()))
        self.assertEqual([p["name"] for p in src["projects"].values()], ["AgenticNodeNetwork"])
        m = bg.build_model(src, "*.pdf")
        self.assertEqual(m["stats"]["matched"], 2)
        self.assertEqual(m["stats"]["unlinked"], 1)

    def test_csv_wrong_columns_rejected(self):
        tmp = Path(tempfile.mkdtemp()) / "bad.csv"
        tmp.write_text("a,b\n1,2\n")
        with self.assertRaises(bg.InputError):
            bg.load_csv(tmp)


class CollectorModel(unittest.TestCase):
    def load(self, d):
        p = Path(tempfile.mkdtemp()) / "data.json"
        p.write_text(json.dumps(d))
        return bg.load_collector(p)

    def test_urls_and_links(self):
        m = bg.build_model(self.load(payload()), "*.tsx")
        self.assertEqual(m["stats"]["matched"], 3)
        self.assertEqual(set(m["chats"]), {C1, C2})
        self.assertEqual(m["chats"][C1]["url"], f"https://claude.ai/chat/{C1}")
        self.assertIn(P1, m["projects"])  # reached via the chat's project
        self.assertEqual(m["projects"][P1]["url"], f"https://claude.ai/project/{P1}")
        self.assertEqual(m["stats"]["unlinked"], 1)  # old.tsx
        self.assertTrue(m["chats"][C2]["archived"])

    def test_missing_title_still_linked(self):
        m = bg.build_model(self.load(payload()), "*.txt")
        (cid,) = m["chats"]
        self.assertEqual(m["chats"][cid]["title"], "(title not returned)")
        self.assertEqual(m["chats"][cid]["url"], f"https://claude.ai/chat/{cid}")

    def test_double_encoded_string_accepted(self):
        p = Path(tempfile.mkdtemp()) / "data.json"
        p.write_text(json.dumps(json.dumps(payload())))
        self.assertEqual(len(bg.load_collector(p)["files"]), 6)

    def test_wrong_schema_rejected(self):
        with self.assertRaises(bg.InputError):
            self.load(payload(schema="other/v0"))

    def test_html_embedding_cannot_break_out(self):
        m = bg.build_model(self.load(payload()), "*")
        html = bg.render_html(m, ROOT / "scripts" / "graph_template.html")
        data = html.split('<script id="fg-data" type="application/json">', 1)[1].split("</script>", 1)[0]
        self.assertNotIn("<", data)
        self.assertEqual(len(json.loads(data)["files"]), 6)  # round-trips intact
        self.assertNotIn("/*__FILE_GRAPH_DATA__*/", html)

    def test_cli_exit_codes(self):
        p = Path(tempfile.mkdtemp())
        (p / "d.json").write_text(json.dumps(payload()))
        out = p / "g.html"
        with redirect_stdout(io.StringIO()):
            self.assertEqual(bg.main(["--data", str(p / "d.json"), "--pattern", "maxey0*", "--out", str(out)]), 0)
            self.assertTrue(out.stat().st_size > 1000)
            self.assertEqual(bg.main(["--data", str(p / "d.json"), "--pattern", "*.nope", "--out", str(out)]), 3)
            self.assertTrue(out.exists())
        (p / "bad.json").write_text("{nope")
        import contextlib
        with contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(bg.main(["--data", str(p / "bad.json")]), 2)

    def test_print_lists_urls(self):
        m = bg.build_model(self.load(payload()), "maxey0*")
        buf = io.StringIO()
        bg.print_matches(m, buf)
        self.assertIn(f"https://claude.ai/chat/{C1}", buf.getvalue())
        self.assertTrue(buf.getvalue().startswith("2 of 6 files match 'maxey0*'"))


if __name__ == "__main__":
    unittest.main()
