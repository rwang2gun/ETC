#!/usr/bin/env python3
"""위플 가계부(Weple Money) CSV → 보정 리포트(HTML) 생성기.

위플 가계부 앱의 "Export CSV File"로 내보낸 파일을 읽어, 가계 현금흐름을
왜곡하는 항목들을 보정한 뒤 월별 리포트(단일 HTML, 차트 내장)를 만듭니다.

보정 규칙(아래 CONFIG 에서 수정 가능):
  1. 카드대금 납부      → 자산이동(이체)로 보고 소비에서 제외
  2. 페이코(복지포인트) → 회사 복지비. 가계 현금과 분리한 '별도 장부'로 집계
  3. 충전형 페이카드    → 충전(내역에 '충전'/'와이페이')은 이체, 실제 사용액만 소비
  4. 수동 중복 제거     → 같은 지출을 두 번 입력한 건을 DEDUP 목록으로 제거

사용법:
  python weple_report.py weple_YYYYMMDD.csv                # CSV 안의 모든 달
  python weple_report.py weple.csv -m 2026-04 2026-05      # 특정 달만
  python weple_report.py weple.csv -m 2026-05 -o out.html  # 출력 경로 지정

차트는 matplotlib + koreanize-matplotlib 가 있으면 PNG로 내장되고,
없으면 표 안의 CSS 막대만으로 표시됩니다(스크립트는 그대로 동작).
"""
from __future__ import annotations
import argparse
import base64
import csv
import io
import sys
from collections import defaultdict

# ─────────────────────────────────────────────────────────────────────────────
# CONFIG ── 가계 상황에 맞게 수정하세요
# ─────────────────────────────────────────────────────────────────────────────
# CSV 컬럼 순서: 사용자,거래일,수입/지출,금액,분류,하위 분류,내역,지불,카드,메모
COL = dict(user=0, date=1, type=2, amount=3, cat=4, subcat=5, desc=6, pay=7, asset=8, memo=9)

REGULAR_INCOME = {"월급", "아동수당"}          # '정기수입'으로 볼 수입 분류
CARDBILL_CAT   = {"카드대금"}                  # 카드대금 납부(이체) 분류
SAVING_CATS    = {"저축/적금", "청약", "주식투자", "투자", "대출상환"}  # 자산형성(참고 표시)

# 지출 그룹 구분: 고정(매달 비슷한 의무성) / 저축·투자 / 나머지는 변동
# 교육(학원비)은 매달 금액이 바뀌어 변동으로 둠 — 고정으로 보려면 아래에 "교육" 추가
FIXED_CATS     = {"주거/공과금", "보험", "통신비", "용돈", "주담대상환"}  # 고정지출 분류
GROUP_FIXED, GROUP_VAR, GROUP_SAVE = "고정", "변동", "저축·투자"
def group_of(cat: str) -> str:
    if cat in SAVING_CATS:
        return GROUP_SAVE
    if cat in FIXED_CATS:
        return GROUP_FIXED
    return GROUP_VAR

# 페이코(복지포인트): 별도 장부로 분리
PAYCO_ASSETS   = {"페이코(복지)카드"}          # 복지포인트로 결제되는 자산명
def is_payco_income(r) -> bool:                 # 복지포인트 지급으로 볼 수입
    return r[COL["type"]] == "수입" and ("페이코" in r[COL["desc"]] or r[COL["cat"]] == "복지포인트")

# 충전형 선불 페이카드: 충전 거래(이체)는 소비에서 제외, 실제 사용만 소비로 인정
def is_charge(r) -> bool:
    d = r[COL["desc"]]
    return r[COL["type"]] == "지출" and ("충전" in d or d in {"와이페이"})

# 수동 중복 제거: (거래일, 내역, 금액[정수]) 가 일치하면 1건을 소비에서 제거
DEDUP = {
    ("2026-05-03", "김용호-건설비용", 500000),  # 5/1 아버님건축비용과 동일한 돈(이중입력)
}

# 거래 단위 제외: (거래일, 내역, 금액) → 사유. 소비에서 빼고 '제외'로 표시(이체·정정 등)
EXCLUDE_TX = {
    ("2025-12-02", "주식", 10000000): "기존자산→투자전환(이체)",  # 남은 자산을 투자금으로 전환
}
# 금액 정정: (거래일, 내역, 잘못된금액) → 올바른금액
AMOUNT_FIX = {
    ("2025-11-26", "", 33000): 330000,  # 11월 용돈 33만원을 3.3만원으로 오입력
}

# 분류 재지정: (거래일, 내역) → 새 분류 (잘못 들어간 분류 바로잡기)
RECLASSIFY = {
    ("2026-05-01", "김수희-아버님건축비용"): "경조사",  # 어버이날 선물 겸 → 경조사
}
# 내역 키워드 → 새 분류 (매달 반복되는 항목을 분리). 내역에 키워드가 들어가면 적용.
RECLASSIFY_DESC = {
    "주택담보대출": "주담대상환",  # 주거/공과금에서 주담대 상환을 따로 분리
}
# 분류 병합: {원분류: 합칠분류} — 한 분류를 다른 분류에 통째로 합침
CATEGORY_MERGE = {
    "선물": "경조사",  # 선물을 경조사에 합침
}
def reclassify(r) -> str:
    key = (r[COL["date"]], r[COL["desc"]])
    if key in RECLASSIFY:
        cat = RECLASSIFY[key]
    else:
        cat = r[COL["cat"]]
        for kw, c in RECLASSIFY_DESC.items():
            if kw in r[COL["desc"]]:
                cat = c
                break
    return CATEGORY_MERGE.get(cat, cat)

# 통과성('대신 결제 후 송금받음') 자동 탐지: 같은 달 일회성 수입과 ±오차 내 금액의
# 지출이 있으면 주석으로 표시(자동 상쇄는 하지 않음)
PASSTHROUGH_TOLERANCE = 5000
# ─────────────────────────────────────────────────────────────────────────────


def won(n: int) -> str:
    return f"{n:,}"


def amt(s: str) -> int:
    return int(s.replace(",", "").replace('"', "") or 0)


def load(path: str):
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.reader(f))
    if not rows:
        sys.exit("빈 파일입니다.")
    header, data = rows[0], [r for r in rows[1:] if len(r) > COL["asset"]]
    return header, data


def is_dup(r) -> bool:
    return (r[COL["date"]], r[COL["desc"]], amt(r[COL["amount"]])) in DEDUP


def analyze(data, ym: str) -> dict:
    """한 달(ym='YYYY-MM') 보정 집계."""
    d = [r for r in data if r[COL["date"]].startswith(ym)]
    house = defaultdict(int)                          # 분류별 실가계소비
    items = defaultdict(lambda: defaultdict(int))     # 분류 → 내역 → 금액
    pay = defaultdict(int)                            # 복지포인트 사용(분류별)
    assets = defaultdict(lambda: defaultdict(int))    # 자산 → 분류 → 금액(포함 소비)
    asset_excl = defaultdict(lambda: defaultdict(int))  # 자산 → 사유 → 금액(제외)
    cardbill = charge = saving = dup = 0
    for r in d:
        if r[COL["type"]] != "지출":
            continue
        a = amt(r[COL["amount"]])
        a = AMOUNT_FIX.get((r[COL["date"]], r[COL["desc"]], a), a)  # 금액 정정
        asset = r[COL["asset"]]
        why = EXCLUDE_TX.get((r[COL["date"]], r[COL["desc"]], a))
        if why:
            asset_excl[asset][why] += a; continue
        if is_dup(r):
            dup += a; asset_excl[asset]["이중입력"] += a; continue
        if r[COL["cat"]] in CARDBILL_CAT:
            cardbill += a; asset_excl[asset]["카드대금(이체)"] += a; continue
        if is_charge(r):
            charge += a; asset_excl[asset]["충전(이체)"] += a; continue
        if asset in PAYCO_ASSETS:
            pay[r[COL["cat"]]] += a; asset_excl[asset]["복지포인트(별도)"] += a; continue
        cat = reclassify(r)
        house[cat] += a
        items[cat][r[COL["desc"]] or "(내역없음)"] += a
        assets[asset][cat] += a
        if cat in SAVING_CATS:
            saving += a

    reg = sum(amt(r[COL["amount"]]) for r in d
              if r[COL["type"]] == "수입" and r[COL["cat"]] in REGULAR_INCOME)
    payin = sum(amt(r[COL["amount"]]) for r in d if is_payco_income(r))
    oneoff = [(r[COL["date"]], r[COL["cat"]], amt(r[COL["amount"]]), r[COL["desc"]])
              for r in d if r[COL["type"]] == "수입"
              and r[COL["cat"]] not in REGULAR_INCOME and not is_payco_income(r)]

    # 통과성 의심: 일회성 수입과 같은 금액의 지출 찾기(표시용)
    exp_idx = [(amt(r[COL["amount"]]), r[COL["cat"]], r[COL["desc"]])
               for r in d if r[COL["type"]] == "지출"]
    passthrough = []
    for dt, c, v, m in oneoff:
        hit = [e for e in exp_idx if e[0] > 0 and abs(e[0] - v) <= PASSTHROUGH_TOLERANCE]
        if hit:
            passthrough.append((v, m, hit[0]))

    real = sum(house.values())
    groups = defaultdict(int)
    for c, v in house.items():
        groups[group_of(c)] += v
    return dict(ym=ym, house=dict(house), real=real, reg=reg,
                groups=dict(groups), items={c: dict(v) for c, v in items.items()},
                assets={a: dict(c) for a, c in assets.items()},
                asset_excl={a: dict(c) for a, c in asset_excl.items()},
                oneoff=sum(x[2] for x in oneoff),
                oneoff_list=sorted(oneoff, key=lambda x: -x[2]),
                payspend=sum(pay.values()), payin=payin,
                cardbill=cardbill, charge=charge, saving=saving, dup=dup,
                passthrough=passthrough)


def build_chart(stats: list) -> str | None:
    """월별 대시보드 PNG를 base64로 반환. matplotlib 없으면 None."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        try:
            import koreanize_matplotlib  # noqa: F401  (한글 폰트)
        except Exception:
            print("  [경고] koreanize-matplotlib 미설치 → 차트 한글이 깨질 수 있습니다.", file=sys.stderr)
        import matplotlib.pyplot as plt
        import numpy as np
        plt.rcParams["axes.unicode_minus"] = False
    except Exception:
        print("  [정보] matplotlib 미설치 → 차트 이미지 없이 생성합니다.", file=sys.stderr)
        return None

    labels = [s["ym"][5:] + "월" for s in stats]
    n = len(stats)
    fig = plt.figure(figsize=(13, 5.2 + 2.6 * (n > 0)))
    fig.suptitle("가계부 리포트 (복지·충전·카드대금·중복 보정)", fontsize=15, fontweight="bold")

    ax1 = fig.add_subplot(2, 2, 1)
    x = np.arange(n); bw = 0.25
    reg = [s["reg"] for s in stats]; one = [s["oneoff"] for s in stats]; real = [s["real"] for s in stats]
    ax1.bar(x - bw, [v / 1e4 for v in reg], bw, label="정기수입", color="#4a86e8")
    ax1.bar(x, [v / 1e4 for v in one], bw, label="일회성유입", color="#9ec5ff")
    ax1.bar(x + bw, [v / 1e4 for v in real], bw, label="실가계소비", color="#e06666")
    ax1.set_xticks(x); ax1.set_xticklabels(labels); ax1.set_ylabel("만원")
    ax1.set_title("정기수입 vs 실가계소비"); ax1.legend(fontsize=9)

    ax2 = fig.add_subplot(2, 2, 2)
    bal = [(s["reg"] - s["real"]) / 1e4 for s in stats]
    ax2.bar(labels, bal, color=["#cc0000" if b < 0 else "#1a8754" for b in bal], width=0.5)
    ax2.axhline(0, color="#333", lw=0.8); ax2.set_ylabel("만원")
    ax2.set_title("월 수지 (정기수입 빼기 실가계소비)")
    for i, b in enumerate(bal):
        ax2.text(i, b, f"{b:.0f}만", ha="center", va="top" if b < 0 else "bottom",
                 fontsize=11, fontweight="bold")

    ax3 = fig.add_subplot(2, 1, 2)
    allc = defaultdict(int)
    for s in stats:
        for c, v in s["house"].items():
            allc[c] += v
    top = [c for c, _ in sorted(allc.items(), key=lambda x: -x[1])[:12]]
    y = np.arange(len(top)); h = 0.8 / max(n, 1)
    colors = ["#4a86e8", "#e06666", "#6aa84f", "#f1c232", "#8e7cc3", "#76a5af"]
    for j, s in enumerate(stats):
        vals = [s["house"].get(c, 0) / 1e4 for c in top]
        ax3.barh(y + (n / 2 - j - 0.5) * h, vals, h,
                 label=labels[j], color=colors[j % len(colors)])
    ax3.set_yticks(y); ax3.set_yticklabels(top); ax3.invert_yaxis()
    ax3.set_xlabel("만원"); ax3.set_title("분류별 실가계소비 TOP 12"); ax3.legend()

    plt.tight_layout(rect=[0, 0, 1, 0.97])
    buf = io.BytesIO(); plt.savefig(buf, format="png", dpi=130, bbox_inches="tight")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode()


def _cls(n): return "neg" if n < 0 else "pos"


_GTAG = {GROUP_FIXED: "gfix", GROUP_VAR: "gvar", GROUP_SAVE: "gsave"}


def _gbadge(cat: str) -> str:
    g = group_of(cat)
    return f'<span class="gt {_GTAG[g]}">{g}</span>'


def _cat_accordion(s):
    """큰 카테고리별 드롭다운(<details>) — 펼치면 내역 목록."""
    if not s["house"]:
        return '<p style="color:#9aa3ad;font-size:13.5px">소비 내역 없음</p>'
    mx = max(s["house"].values()); real = s["real"]; out = []
    for c, v in sorted(s["house"].items(), key=lambda x: -x[1]):
        its = sorted(s["items"].get(c, {}).items(), key=lambda x: -x[1])
        rows = "".join(f'<tr><td>{d}</td><td class="num">{won(a)}</td></tr>' for d, a in its) \
            or '<tr><td colspan="2" style="color:#9aa3ad">내역 없음</td></tr>'
        out.append(f'''<details class="acc">
          <summary><span class="accbar" style="width:{v / mx * 100:.0f}%"></span>
            {_gbadge(c)} <span class="accname">{c}</span>
            <span class="accamt">{won(v)}원 · {v / real * 100:.0f}%</span></summary>
          <div class="accbody"><table><tbody>{rows}</tbody></table></div>
        </details>''')
    return "\n".join(out)


def build_trend_chart(trend: list) -> str | None:
    """최근 N개월 그룹별(고정/변동/저축) 추세 라인차트 → base64. 없으면 None."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        try:
            import koreanize_matplotlib  # noqa: F401
        except Exception:
            pass
        import matplotlib.pyplot as plt
        plt.rcParams["axes.unicode_minus"] = False
    except Exception:
        return None
    labels = [s["ym"][5:] + "월" for s in trend]
    series = {
        "고정지출": ([s["groups"].get(GROUP_FIXED, 0) / 1e4 for s in trend], "#4a86e8"),
        "변동지출": ([s["groups"].get(GROUP_VAR, 0) / 1e4 for s in trend], "#e06666"),
        "저축·투자": ([s["groups"].get(GROUP_SAVE, 0) / 1e4 for s in trend], "#6aa84f"),
        "실가계소비": ([s["real"] / 1e4 for s in trend], "#999999"),
    }
    fig, ax = plt.subplots(figsize=(9, 4.6))
    for name, (vals, col) in series.items():
        ls = "--" if name == "실가계소비" else "-"
        ax.plot(labels, vals, marker="o", label=name, color=col, linestyle=ls, linewidth=2)
        for x, y in zip(labels, vals):
            ax.annotate(f"{y:.0f}", (x, y), textcoords="offset points", xytext=(0, 6),
                        ha="center", fontsize=8, color=col)
    ax.set_ylabel("만원"); ax.set_title(f"최근 {len(trend)}개월 그룹별 지출 추세")
    ax.legend(fontsize=9); ax.grid(axis="y", alpha=0.3)
    import io as _io
    buf = _io.BytesIO(); plt.tight_layout(); plt.savefig(buf, format="png", dpi=130)
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode()


def _trend_cells(vals: list) -> str:
    """월별 금액 span들 + 추세 화살표 span (전월 대비, 그리드 셀)."""
    cells = "".join(f'<span class="tnum">{won(v) if v else "·"}</span>' for v in vals)
    return cells + f'<span class="tnum tarr">{_trend_arrow(vals[-2], vals[-1])}</span>'


def build_trend_section(trend: list) -> str:
    """최근 N개월 항목별(분류) 지출 추세 — 라인차트 + 분류별 드롭다운(내역 추이)."""
    if len(trend) < 2:
        return ""
    labels = [s["ym"] for s in trend]
    n = len(trend)
    gcols = "minmax(0,1fr) " + " ".join(["1fr"] * n) + " 58px"
    chart = build_trend_chart(trend)
    chart_html = (f'<div class="chart"><img alt="추세" src="data:image/png;base64,{chart}"></div>'
                  if chart else "")

    allcats = set()
    for s in trend:
        allcats |= set(s["house"])

    # 헤더 행
    head = (f'<div class="trendhead" style="grid-template-columns:{gcols}">'
            f'<span>분류</span>' + "".join(f'<span class="tnum">{m[5:]}월</span>' for m in labels)
            + '<span class="tnum">추세</span></div>')

    body = ""
    for group in (GROUP_FIXED, GROUP_VAR, GROUP_SAVE):
        cats = [c for c in allcats if group_of(c) == group]
        if not cats:
            continue
        sub = [sum(s["house"].get(c, 0) for c in cats) for s in trend]
        body += (f'<div class="trendgrp {_GTAG[group]}" style="grid-template-columns:{gcols}">'
                 f'<span><b>{group}</b></span>{_trend_cells(sub)}</div>')
        for c in sorted(cats, key=lambda c: -sum(s["house"].get(c, 0) for s in trend)):
            vals = [s["house"].get(c, 0) for s in trend]
            # 내역 × 월 매트릭스 (상위 10건)
            its = set()
            for s in trend:
                its |= set(s["items"].get(c, {}))
            tot = {it: sum(s["items"].get(c, {}).get(it, 0) for s in trend) for it in its}
            ordered = sorted(its, key=lambda it: -tot[it])
            irows = ""
            for it in ordered[:10]:
                iv = [s["items"].get(c, {}).get(it, 0) for s in trend]
                irows += (f'<div class="tirow" style="grid-template-columns:{gcols}">'
                          f'<span>{it}</span>'
                          + "".join(f'<span class="tnum">{won(v) if v else "·"}</span>' for v in iv)
                          + '<span></span></div>')
            if len(ordered) > 10:
                rv = [sum(s["items"].get(c, {}).get(it, 0) for it in ordered[10:]) for s in trend]
                irows += (f'<div class="tirow" style="grid-template-columns:{gcols}">'
                          f'<span>외 {len(ordered)-10}건</span>'
                          + "".join(f'<span class="tnum">{won(v) if v else "·"}</span>' for v in rv)
                          + '<span></span></div>')
            body += (f'<details class="tacc"><summary style="grid-template-columns:{gcols}">'
                     f'<span><span class="tarrow">▸</span> {c}</span>{_trend_cells(vals)}</summary>'
                     f'<div class="tibody">{irows or "<div class=tirow><span>내역 없음</span></div>"}</div></details>')

    return f'''<section><h2>📈 최근 {n}개월 항목별 지출 추세
      <span style="color:var(--mut);font-size:13px">({labels[0]} ~ {labels[-1]})</span></h2>
    {chart_html}
    <div class="trendtbl">{head}{body}</div>
    <p style="font-size:12.5px;color:#9aa3ad;margin:10px 0 0">▸ 분류를 누르면 내역별 월 추이가 펼쳐집니다. 화살표는 <b>전월 대비</b> 증감({labels[-2][5:]}월→{labels[-1][5:]}월), 굵은 줄은 그룹 소계.</p></section>'''


def _var_cats(s) -> dict:
    """변동지출 분류별 합계."""
    return {c: v for c, v in s["house"].items() if group_of(c) == GROUP_VAR}


def build_var_chart(stats: list) -> str | None:
    """변동지출 구성 도넛(월별 1개) → base64. matplotlib 없으면 None."""
    try:
        import matplotlib
        matplotlib.use("Agg")
        try:
            import koreanize_matplotlib  # noqa: F401
        except Exception:
            pass
        import matplotlib.pyplot as plt
    except Exception:
        return None
    months = [s for s in stats if _var_cats(s)]
    if not months:
        return None
    n = len(months)
    fig, axes = plt.subplots(1, n, figsize=(5.4 * n, 5.2))
    if n == 1:
        axes = [axes]
    palette = ["#e06666", "#f6b26b", "#ffd966", "#93c47d", "#76a5af", "#6fa8dc",
               "#8e7cc3", "#c27ba0", "#dd7e6b", "#b6d7a8", "#a4c2f4", "#d5a6bd"]
    for ax, s in zip(axes, months):
        vc = _var_cats(s)
        top = sorted(vc.items(), key=lambda x: -x[1])
        labels = [c for c, _ in top]
        vals = [v for _, v in top]
        total = sum(vals)
        wedges, _ = ax.pie(vals, startangle=90, counterclock=False,
                           colors=[palette[i % len(palette)] for i in range(len(vals))],
                           wedgeprops=dict(width=0.42, edgecolor="white"))
        ax.set_title(f"{s['ym']} 변동지출\n{total/1e4:.0f}만원", fontsize=12, fontweight="bold")
        leg = [f"{c}  {v/1e4:.0f}만 ({v/total*100:.0f}%)" for c, v in top]
        ax.legend(wedges, leg, loc="center", fontsize=8, frameon=False,
                  bbox_to_anchor=(0.5, -0.06), ncol=2)
    import io as _io
    buf = _io.BytesIO(); plt.tight_layout(); plt.savefig(buf, format="png", dpi=130, bbox_inches="tight")
    plt.close(fig)
    return base64.b64encode(buf.getvalue()).decode()


def build_var_section(stats: list) -> str:
    """변동지출 구성 — 도넛 그래프(분류별 세부 내역은 아래 드롭다운에서 확인)."""
    if not any(_var_cats(s) for s in stats):
        return ""
    chart = build_var_chart(stats)
    if not chart:
        return ""
    return (f'<section><h2>🍔 변동지출 구성</h2>'
            f'<div class="chart"><img alt="변동지출" src="data:image/png;base64,{chart}"></div>'
            f'<p style="font-size:12.5px;color:#9aa3ad;margin:6px 0 0">분류별 세부 내역은 아래 '
            f'‘분류별 실가계소비’에서 항목을 눌러 확인하세요.</p></section>')


def build_asset_section(stats: list) -> str:
    """자산별 지출 드롭다운 — 자산을 누르면 분류별 지출 + 제외분(이체·복지·중복)."""
    if not any(s.get("assets") or s.get("asset_excl") for s in stats):
        return ""
    multi = len(stats) > 1
    blocks = ""
    for s in stats:
        assets = s["assets"]; excl = s["asset_excl"]
        names = set(assets) | set(excl)
        if not names:
            continue
        incl_tot = {a: sum(assets.get(a, {}).values()) for a in names}
        mx = max(incl_tot.values()) or 1
        if multi:
            blocks += f'<h3 style="font-size:14px;margin:14px 0 6px">{s["ym"]}</h3>'
        for a in sorted(names, key=lambda x: -incl_tot[x]):
            inc = incl_tot[a]
            cats = assets.get(a, {})
            catrows = "".join(
                f'<tr><td>{_gbadge(c)} {c}</td><td class="num">{won(v)}</td></tr>'
                for c, v in sorted(cats.items(), key=lambda x: -x[1])
            ) or '<tr><td colspan="2" style="color:#9aa3ad">포함된 소비 없음</td></tr>'
            exnote = ""
            if excl.get(a):
                ex = " · ".join(f"{why} {won(v)}"
                                for why, v in sorted(excl[a].items(), key=lambda x: -x[1]))
                exnote = f'<div class="exnote">제외(이체·별도장부): {ex}</div>'
            blocks += f'''<details class="acc">
              <summary><span class="accbar" style="width:{inc / mx * 100:.0f}%"></span>
                <span class="accname">{a}</span>
                <span class="accamt">{won(inc)}원 포함</span></summary>
              <div class="accbody"><table><tbody>{catrows}</tbody></table>{exnote}</div>
            </details>'''
    return (f'<section><h2>💳 자산별 지출 <span style="color:var(--mut);font-size:13px">'
            f'(포함 = 실가계소비 / 제외 = 이체·복지·중복)</span></h2>'
            f'<p style="font-size:12.5px;color:#9aa3ad;margin:-4px 0 10px">▸ 자산을 누르면 분류별 지출이 펼쳐집니다</p>'
            f'{blocks}</section>')


def _oneoff_rows(s):
    if not s["oneoff_list"]:
        return '<tr><td colspan="4" style="color:#9aa3ad">없음</td></tr>'
    return "\n".join(f'<tr><td>{d}</td><td>{c}</td><td class="num">{won(v)}</td><td>{m or "-"}</td></tr>'
                     for d, c, v, m in s["oneoff_list"])


def _card(s):
    bal = s["reg"] - s["real"]
    g = s["groups"]
    grp = (f'<div class="kv muted"><span>└ 고정지출</span><span>{won(g.get(GROUP_FIXED,0))}원</span></div>'
           f'<div class="kv muted"><span>└ 변동지출</span><span>{won(g.get(GROUP_VAR,0))}원</span></div>')
    if g.get(GROUP_SAVE):
        grp += f'<div class="kv muted"><span>└ 저축·투자</span><span>{won(g[GROUP_SAVE])}원</span></div>'
    if s["dup"]:
        grp += f'<div class="kv muted"><span>└ 중복 제거됨</span><span>-{won(s["dup"])}원</span></div>'
    return f'''<div class="card"><h3>{s["ym"]}</h3>
      <div class="kv"><span>정기수입</span><b>{won(s["reg"])}원</b></div>
      <div class="kv"><span>일회성 유입</span><b>{won(s["oneoff"])}원</b></div>
      <div class="kv"><span>실가계소비</span><b class="exp">{won(s["real"])}원</b></div>
      {grp}
      <div class="kv balance {_cls(bal)}"><span>수지(정기−실가계소비)</span><b>{won(bal)}원</b></div>
    </div>'''


def _month_detail(s) -> str:
    """한 달의 '분류별 실가계소비'(드롭다운) + 복지포인트 + 일회성 유입 + 통과성 주석."""
    detail = f'''<section><h2><span class="tag">{s["ym"]}</span> 분류별 실가계소비
        <span style="color:var(--mut);font-size:13px">({won(s["real"])}원)</span></h2>
        <p style="font-size:12.5px;color:#9aa3ad;margin:-4px 0 10px">▸ 분류를 누르면 세부 내역이 펼쳐집니다</p>
        {_cat_accordion(s)}'''
    if s["payin"] or s["payspend"]:
        bal = s["payin"] - s["payspend"]
        detail += f'''<div class="wfbox"><b>복지포인트(페이코) 별도</b> ·
              지급 {won(s["payin"])} / 사용 {won(s["payspend"])} /
              잔여 {'+' if bal >= 0 else ''}{won(bal)}원</div>'''
    detail += f'''<h3 style="font-size:14px;margin:14px 0 6px">일회성 유입 ({won(s["oneoff"])}원, 복지포인트 제외)</h3>
        <table><thead><tr><th>날짜</th><th>분류</th><th class="num">금액</th><th>내역</th></tr></thead>
        <tbody>{_oneoff_rows(s)}</tbody></table>'''
    if s["passthrough"]:
        items = "".join(
            f'<li>수입 {won(v)}원 (<b>{m}</b>) ↔ 비슷한 지출 {won(hit[0])}원 [{hit[1]}/{hit[2]}] '
            f'— 통과성 가능(자동 상쇄 안 함)</li>'
            for v, m, hit in s["passthrough"])
        detail += f'<div class="note pt"><b>🔎 통과성 의심(주석)</b><ul class="tips">{items}</ul></div>'
    return detail + "</section>"


def build_month_body(s, chart_b64: str | None, trend: list | None) -> str:
    """한 달치 본문(요약 카드 + 차트 + 추세 + 변동도넛 + 분류상세 + 자산별)."""
    cards = f'<div class="cards">{_card(s)}</div>'
    chart = (f'<div class="chart"><img alt="차트" src="data:image/png;base64,{chart_b64}"></div>'
             if chart_b64 else "")
    trend_section = build_trend_section(trend) if trend else ""
    return (cards + chart + trend_section + build_var_section([s])
            + _month_detail(s) + build_asset_section([s]))


NOTE_HTML = '''<div class="note"><b>보정 방법</b><br>
① 카드대금 납부 = 이체로 제외 &nbsp; ② 페이코(복지포인트) = 별도 장부 분리<br>
③ 충전형 페이카드 = 충전 이체·실제 사용만 소비 &nbsp; ④ 이중입력 수동 제거<br>
→ <b>실가계소비 = 현금 + 신용카드 + 충전카드 실사용</b> 기준. 통과성 거래는 상쇄하지 않고 주석으로 표시.</div>'''

TIPS_HTML = '''<section><h2>🔧 작성 개선 제안</h2><ul class="tips">
<li><b>카드대금 결제 → ‘이체’</b>로 기록(현금→카드). 개별 결제만 한 번 잡혀 중복이 사라집니다.</li>
<li><b>복지포인트 → 별도 자산</b>으로 두고 지급은 충전, 사용은 차감. 가계 현금과 섞지 않기.</li>
<li><b>충전형 페이카드 → 충전은 ‘이체’</b>, 실제 결제만 소비, 잔액은 자산 유지.</li>
<li><b>같은 지출을 두 사람이 각자 입력</b>하지 않도록 입력 규칙 맞추기.</li>
</ul></section>
<div class="foot">통과성·자산성 항목은 차감하지 않고 주석으로만 표시했습니다. 규칙은 weple_report.py 상단 CONFIG에서 수정하세요.</div>'''


def _doc(period: str, src_name: str, inner: str, extra_css: str = "") -> str:
    return f'''<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>위플 가계부 리포트</title>
<style>{STYLE}{extra_css}</style></head><body><div class="wrap">
<h1>📊 위플 가계부 리포트 · {period}</h1>
<div class="sub">원본: {src_name} · weple_report.py 자동 생성</div>
{NOTE_HTML}
{inner}
{TIPS_HTML}
</div></body></html>'''


def build_html(stats: list, chart_b64: str | None, src_name: str, trend: list | None = None) -> str:
    period = stats[0]["ym"] if len(stats) == 1 else f'{stats[0]["ym"]} ~ {stats[-1]["ym"]}'
    inner = "".join(build_month_body(s, chart_b64, trend) for s in stats)
    return _doc(period, src_name, inner)


def build_tabbed_html(payloads: list, src_name: str) -> str:
    """월별 본문을 탭(CSS only)으로 묶은 단일 HTML. payloads=[(s, chart_b64, trend), ...]."""
    months = [p[0]["ym"] for p in payloads]
    inputs = "".join(
        f'<input type="radio" name="wtab" class="wtabin" id="t_{ym}"{" checked" if i == 0 else ""}>'
        for i, ym in enumerate(months))
    labels = "".join(f'<label for="t_{ym}">{ym[2:4]}.{ym[5:7]}</label>' for ym in months)
    panels = "".join(
        f'<div class="wpanel" id="p_{ym}">{build_month_body(s, chart, trend)}</div>'
        for (s, chart, trend), ym in zip(payloads, months))
    rules = "\n".join(
        f'#t_{ym}:checked~.tabbar label[for="t_{ym}"]{{background:var(--ink);color:#fff;border-color:var(--ink)}}'
        f' #t_{ym}:checked~.panels #p_{ym}{{display:block}}'
        for ym in months)
    extra = ('.wtabin{display:none}'
             '.tabbar{display:flex;gap:6px;overflow-x:auto;padding:4px 0 14px;-webkit-overflow-scrolling:touch}'
             '.tabbar label{flex:0 0 auto;cursor:pointer;padding:8px 15px;border:1px solid var(--line);'
             'border-radius:999px;background:#fff;font-size:13px;font-weight:600;color:var(--mut);white-space:nowrap}'
             '.wpanel{display:none}\n' + rules)
    inner = f'{inputs}<div class="tabbar">{labels}</div><div class="panels">{panels}</div>'
    return _doc(f'{months[0]} ~ {months[-1]}', src_name, inner, extra_css=extra)


STYLE = '''
:root{--blue:#4a86e8;--red:#e06666;--ink:#1f2933;--mut:#6b7684;--line:#e5e8eb;--bg:#f5f6f8}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);line-height:1.55;
 font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif}
.wrap{max-width:880px;margin:0 auto;padding:20px 16px 60px}
h1{font-size:23px;margin:8px 0 4px} .sub{color:var(--mut);font-size:13px;margin-bottom:18px}
.note{background:#fff7e6;border:1px solid #ffe1a8;border-radius:10px;padding:12px 14px;font-size:13.5px;margin:14px 0}
.note b{color:#b26a00} .note.pt{background:#eef4ff;border-color:#c9daf8} .note.pt b{color:#1c4587}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:18px 0}
.card{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px} .card h3{margin:0 0 10px;font-size:16px}
.kv{display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:14px}
.kv span{color:var(--mut)} .kv b{font-variant-numeric:tabular-nums} .kv .exp{color:var(--red)}
.balance{margin-top:6px;border-top:1px dashed var(--line);padding-top:8px} .balance b{font-size:16px}
.pos b{color:#1a8754} .neg b{color:#cc0000} .muted span{font-size:12.5px;color:#9aa3ad}
.chart{background:#fff;border:1px solid var(--line);border-radius:14px;padding:10px;margin:18px 0}
.chart img{width:100%;height:auto;border-radius:8px}
section{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:16px 0}
section h2{font-size:18px;margin:0 0 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.tag{font-size:12px;font-weight:600;color:#fff;background:var(--blue);padding:2px 8px;border-radius:999px}
table{width:100%;border-collapse:collapse;font-size:13.5px}
th,td{padding:7px 8px;border-bottom:1px solid var(--line);text-align:left}
th{color:var(--mut);font-weight:600;font-size:12.5px}
td.num,th.num{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
.barcell{width:34%} .bar{display:inline-block;height:9px;border-radius:5px;background:var(--blue)}
.gt{font-size:10.5px;font-weight:600;color:#fff;padding:1px 6px;border-radius:999px;margin-right:3px;vertical-align:middle}
.gt.gfix{background:#4a86e8} .gt.gvar{background:#e06666} .gt.gsave{background:#6aa84f}
details.acc{position:relative;border:1px solid var(--line);border-radius:10px;margin:7px 0;background:#fff;overflow:hidden}
details.acc>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:7px;padding:11px 14px;font-size:14px;position:relative}
details.acc>summary::-webkit-details-marker{display:none}
details.acc>summary::before{content:"▸";color:#9aa3ad;font-size:11px;transition:transform .15s;flex:0 0 auto}
details.acc[open]>summary::before{transform:rotate(90deg)}
details.acc>summary:hover{background:#fafbfc}
.accbar{position:absolute;left:0;bottom:0;height:3px;background:var(--blue);opacity:.5}
.accname{font-weight:500}
.accamt{margin-left:auto;color:var(--mut);font-variant-numeric:tabular-nums;white-space:nowrap;font-size:13px}
details.acc .accbody{padding:2px 14px 12px 32px}
details.acc .accbody table{font-size:13px}
details.acc .accbody td{border-bottom:1px solid #f0f2f4;padding:5px 6px}
details.acc .accbody td:last-child{color:var(--ink)}
.exnote{margin-top:8px;padding:7px 10px;background:#f6f8fa;border-radius:8px;font-size:12px;color:var(--mut);line-height:1.5}
.trendtbl{border:1px solid var(--line);border-radius:10px;overflow:hidden}
.trendhead,.trendgrp,details.tacc>summary,.tirow{display:grid;align-items:center;gap:6px;padding:8px 12px}
.trendhead{background:#f7f8fa;font-size:12px;color:var(--mut);font-weight:600}
.trendgrp{background:#eef4ff;border-top:1px solid var(--line);font-size:13px}
.trendgrp.gvar{background:#fdf2f2} .trendgrp.gsave{background:#eff7ee}
.tnum{text-align:right;font-variant-numeric:tabular-nums;font-size:13px;white-space:nowrap}
details.tacc{border-top:1px solid var(--line)}
details.tacc>summary{list-style:none;cursor:pointer;font-size:13px}
details.tacc>summary::-webkit-details-marker{display:none}
details.tacc>summary:hover{background:#fafbfc}
.tarrow{display:inline-block;width:12px;color:#9aa3ad;font-size:10px;transition:transform .15s}
details.tacc[open] .tarrow{transform:rotate(90deg)}
.tibody{background:#fbfcfd;border-top:1px dashed var(--line)}
.tirow{padding:5px 12px 5px 26px;font-size:12px;color:var(--mut);border-bottom:1px solid #f0f2f4}
.tirow:last-child{border-bottom:none}
.tirow>span:first-child{word-break:break-all}
.wfbox{background:#f7f3ff;border:1px solid #e4d7f5;border-radius:10px;padding:10px 12px;margin-top:10px;font-size:13.5px}
ul.tips{margin:6px 0 0;padding-left:18px;font-size:13.5px} ul.tips li{margin:6px 0}
.foot{color:var(--mut);font-size:12px;text-align:center;margin-top:24px}
'''


def months_in(data) -> list:
    return sorted({r[COL["date"]][:7] for r in data if len(r[COL["date"]]) >= 7})


def prev_month(ym: str, k: int) -> str:
    """ym('YYYY-MM')에서 k개월 전 'YYYY-MM'."""
    y, m = map(int, ym.split("-"))
    m -= k
    while m <= 0:
        m += 12; y -= 1
    return f"{y:04d}-{m:02d}"


def _trend_arrow(first: int, last: int) -> str:
    if first == 0 and last == 0:
        return '<span style="color:#9aa3ad">—</span>'
    if last > first:
        return f'<span style="color:#cc0000">▲ {((last-first)/first*100):.0f}%</span>' if first else '<span style="color:#cc0000">▲ 신규</span>'
    if last < first:
        return f'<span style="color:#1a8754">▼ {((first-last)/first*100):.0f}%</span>' if first else '<span style="color:#1a8754">▼</span>'
    return '<span style="color:#9aa3ad">―</span>'


def main():
    ap = argparse.ArgumentParser(description="위플 가계부 CSV → 보정 리포트(HTML)")
    ap.add_argument("csv", help="위플 Export CSV 경로")
    ap.add_argument("-m", "--months", nargs="+", metavar="YYYY-MM",
                    help="리포트로 만들 달(미지정 시 파일 내 모든 달)")
    ap.add_argument("-o", "--out", default="weple_report.html", help="출력 HTML 경로")
    ap.add_argument("-t", "--trend", type=int, default=3, metavar="N",
                    help="추세 분석 개월 수(기본 3, 0이면 끔)")
    ap.add_argument("--tabs", action="store_true",
                    help="여러 달을 탭으로 묶은 단일 HTML로 생성")
    args = ap.parse_args()

    _, data = load(args.csv)
    months = sorted(args.months or months_in(data))
    src = args.csv.split("/")[-1]
    stem = args.out[:-5] if args.out.lower().endswith(".html") else args.out

    def month_trend(ym):
        if args.trend and args.trend >= 2:
            return [analyze(data, prev_month(ym, k)) for k in range(args.trend - 1, -1, -1)]
        return None

    # 탭 모드: 달마다 본문을 만들어 하나의 HTML에 탭으로 묶음
    if args.tabs and len(months) > 1:
        payloads = []
        for ym in months:
            s = analyze(data, ym)
            print(f"{s['ym']}  정기수입 {won(s['reg']):>12}  실가계소비 {won(s['real']):>12}  "
                  f"수지 {won(s['reg'] - s['real']):>12}")
            payloads.append((s, build_chart([s]), month_trend(ym)))
        with open(args.out, "w", encoding="utf-8") as f:
            f.write(build_tabbed_html(payloads, src))
        print(f"  ✅ (탭 {len(months)}개월) → {args.out}")
        return

    # 기본: 한 페이지(=HTML 1개)에 한 달만. 추세는 '그 달 기준' 최근 N개월.
    single = len(months) == 1
    for ym in months:
        s = analyze(data, ym)
        print(f"{s['ym']}  정기수입 {won(s['reg']):>12}  실가계소비 {won(s['real']):>12}  "
              f"수지 {won(s['reg'] - s['real']):>12}")
        chart = build_chart([s])
        html = build_html([s], chart, src_name=src, trend=month_trend(ym))
        out = args.out if single else f"{stem}_{ym}.html"
        with open(out, "w", encoding="utf-8") as f:
            f.write(html)
        print(f"  ✅ → {out}")


if __name__ == "__main__":
    main()
