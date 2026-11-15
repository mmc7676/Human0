"""Headless UI test: plays full games as the user through the real page (assets/mahjong.html)."""
import sys, pathlib
from playwright.sync_api import sync_playwright
page_url = (pathlib.Path(__file__).resolve().parent.parent/'assets/mahjong.html').as_uri()
errors = []
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox'])
    for level, w, h in [('beginner', 1280, 900), ('intermediate', 390, 844), ('advanced', 1280, 900)]:
        pg = b.new_page(viewport={'width': w, 'height': h})
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.goto(page_url)
        pg.click(f'[data-lv={level}]'); pg.click('[data-sp="350"]'); pg.click('#go')
        if level == 'beginner': pg.screenshot(path='tests/shot_charleston.png')
        for _ in range(3):  # first charleston
            pg.evaluate("""()=>{const m=window.__mj;const h=m.G.players[0].hand.filter(t=>t.k!=='J').slice(0,3);h.forEach(t=>m.clickTile(t.id));}""")
            pg.click('#aPass')
        pg.click('#aYes')
        if pg.query_selector('#aPass'):
            for _ in range(3):
                pg.evaluate("""()=>{const m=window.__mj;m.G.players[0].hand.filter(t=>t.k!=='J').slice(0,3).forEach(t=>m.clickTile(t.id));}""")
                pg.click('#aPass')
        pg.click('#aCour')
        assert pg.evaluate('window.__mj.G.allTileCount()') == 152
        games = 0
        for step in range(4000):
            mode = pg.evaluate('window.__mj.ui.mode')
            if mode == 'over':
                games += 1
                if level == 'beginner' and games == 1: pg.screenshot(path='tests/shot_result.png')
                break
            if mode == 'discard':
                if step == 40 and level == 'beginner': pg.screenshot(path='tests/shot_play.png')
                if pg.query_selector('#aMJ'): pg.click('#aMJ'); continue
                if pg.query_selector('#aSwap'): pg.click('#aSwap')
                tid = pg.evaluate("()=>{const g=window.__mj.G;return g.chooseDiscard(0,{style:'coach'}).id}")
                pg.click(f'[data-id="{tid}"]'); pg.click('#aDisc')
            elif mode == 'call':
                if level == 'intermediate' and step == 0: pg.screenshot(path='tests/shot_call.png')
                if pg.query_selector('#aCallMJ'): pg.click('#aCallMJ')
                elif pg.query_selector('[data-sz]'): pg.click('[data-sz]')
                else: pg.click('#aPassCall')
            else:
                pg.wait_for_timeout(120)
        assert pg.evaluate('window.__mj.ui.mode') == 'over', f'{level}: game did not finish'
        assert pg.evaluate('window.__mj.G.allTileCount()') == 152
        res = pg.evaluate('JSON.stringify(window.__mj.G.result)')
        print('PASS UI', level, f'{w}x{h}', res[:90])
        if level == 'intermediate': pg.screenshot(path='tests/shot_mobile.png', full_page=True)
        pg.close()
    b.close()
if errors: print('PAGE ERRORS', errors); sys.exit(1)
print('UI tests passed, no page errors')
