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
FIXED_CATS     = {"주거/공과금", "보험", "통신비", "용돈"}  # 고정지출 분류
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
    cardbill = charge = saving = dup = 0
    for r in d:
        if r[COL["type"]] != "지출":
            continue
        a = amt(r[COL["amount"]])
        if is_dup(r):
            dup += a; continue
        if r[COL["cat"]] in CARDBILL_CAT:
            cardbill += a; continue
        if is_charge(r):
            charge += a; continue
        if r[COL["asset"]] in PAYCO_ASSETS:
            pay[r[COL["cat"]]] += a; continue
        cat = r[COL["cat"]]
        house[cat] += a
        items[cat][r[COL["desc"]] or "(내역없음)"] += a
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


def _cat_rows(s):
    if not s["house"]:
        return '<tr><td colspan="4" style="color:#9aa3ad">소비 내역 없음</td></tr>'
    mx = max(s["house"].values()); real = s["real"]; out = []
    for c, v in sorted(s["house"].items(), key=lambda x: -x[1]):
        out.append(f'<tr><td>{_gbadge(c)} {c}</td><td class="num">{won(v)}</td>'
                   f'<td class="num">{v / real * 100:.1f}%</td>'
                   f'<td class="barcell"><span class="bar" style="width:{v / mx * 100:.1f}%"></span></td></tr>')
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


def build_trend_section(trend: list) -> str:
    """최근 N개월 항목별(분류) 지출 추세 — 그룹별로 묶은 표 + 라인차트."""
    if len(trend) < 2:
        return ""
    labels = [s["ym"] for s in trend]
    last = trend[-1]["ym"]
    chart = build_trend_chart(trend)
    chart_html = (f'<div class="chart"><img alt="추세" src="data:image/png;base64,{chart}"></div>'
                  if chart else "")

    # 모든 달에 등장한 분류 집합
    allcats = set()
    for s in trend:
        allcats |= set(s["house"])

    def row(c):
        vals = [s["house"].get(c, 0) for s in trend]
        cells = "".join(f'<td class="num">{won(v) if v else "·"}</td>' for v in vals)
        return (vals[-1], f'<tr><td>{c}</td>{cells}<td class="num">{_trend_arrow(vals[0], vals[-1])}</td></tr>')

    body = ""
    for group in (GROUP_FIXED, GROUP_VAR, GROUP_SAVE):
        rows = sorted((row(c) for c in allcats if group_of(c) == group),
                      key=lambda x: -x[0])
        if not rows:
            continue
        sub = [sum(s["house"].get(c, 0) for c in allcats if group_of(c) == group) for s in trend]
        subcells = "".join(f'<td class="num"><b>{won(v)}</b></td>' for v in sub)
        body += (f'<tr class="grouprow {_GTAG[group]}"><td><b>{group}</b></td>{subcells}'
                 f'<td class="num">{_trend_arrow(sub[0], sub[-1])}</td></tr>')
        body += "\n".join(r for _, r in rows)

    th = "".join(f'<th class="num">{m[5:]}월</th>' for m in labels)
    return f'''<section><h2>📈 최근 {len(trend)}개월 항목별 지출 추세
      <span style="color:var(--mut);font-size:13px">({labels[0]} ~ {last})</span></h2>
    {chart_html}
    <table class="trend"><thead><tr><th>분류</th>{th}<th class="num">추세</th></tr></thead>
    <tbody>{body}</tbody></table>
    <p style="font-size:12.5px;color:#9aa3ad;margin:10px 0 0">※ 추세 화살표는 첫 달 대비 마지막 달 증감. 그룹 행(굵게)은 소계입니다.</p></section>'''


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


def build_var_section(stats: list, top_items: int = 5) -> str:
    """변동지출 세부 — 도넛 그래프 + 분류별 주요 내역(상위 N) 표."""
    if not any(_var_cats(s) for s in stats):
        return ""
    chart = build_var_chart(stats)
    chart_html = (f'<div class="chart"><img alt="변동지출" src="data:image/png;base64,{chart}"></div>'
                  if chart else "")
    blocks = ""
    for s in stats:
        vc = _var_cats(s)
        if not vc:
            continue
        vtot = sum(vc.values())
        rows = ""
        for c, cv in sorted(vc.items(), key=lambda x: -x[1]):
            its = sorted(s["items"].get(c, {}).items(), key=lambda x: -x[1])
            shown = its[:top_items]
            rest = sum(v for _, v in its[top_items:])
            detail = " · ".join(f"{d} {won(v)}" for d, v in shown)
            if rest:
                detail += f" · 외 {won(rest)}"
            rows += (f'<tr><td><b>{c}</b></td><td class="num"><b>{won(cv)}</b></td>'
                     f'<td class="num">{cv/vtot*100:.0f}%</td>'
                     f'<td class="barcell"><span class="bar" style="width:{cv/max(vc.values())*100:.0f}%"></span></td></tr>'
                     f'<tr class="sub"><td colspan="4">{detail}</td></tr>')
        blocks += (f'<h3 style="font-size:14px;margin:14px 0 6px">{s["ym"]} · 변동지출 {won(vtot)}원</h3>'
                   f'<table class="vardetail"><thead><tr><th>분류</th><th class="num">금액</th>'
                   f'<th class="num">비중</th><th>　</th></tr></thead><tbody>{rows}</tbody></table>')
    return (f'<section><h2>🍔 변동지출 세부 <span style="color:var(--mut);font-size:13px">'
            f'(분류별 주요 내역 상위 {top_items})</span></h2>{chart_html}{blocks}</section>')


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


def build_html(stats: list, chart_b64: str | None, src_name: str, trend: list | None = None) -> str:
    cards = "".join(_card(s) for s in stats)
    chart = (f'<div class="chart"><img alt="차트" src="data:image/png;base64,{chart_b64}"></div>'
             if chart_b64 else "")
    trend_section = build_trend_section(trend) if trend else ""
    var_section = build_var_section(stats)

    detail = ""
    for s in stats:
        detail += f'''<section><h2><span class="tag">{s["ym"]}</span> 분류별 실가계소비
        <span style="color:var(--mut);font-size:13px">({won(s["real"])}원)</span></h2>
        <table><thead><tr><th>분류</th><th class="num">금액</th><th class="num">비중</th><th>　</th></tr></thead>
        <tbody>{_cat_rows(s)}</tbody></table>'''
        # 복지포인트 별도 장부
        if s["payin"] or s["payspend"]:
            bal = s["payin"] - s["payspend"]
            detail += f'''<div class="wfbox"><b>복지포인트(페이코) 별도</b> ·
              지급 {won(s["payin"])} / 사용 {won(s["payspend"])} /
              잔여 {'+' if bal >= 0 else ''}{won(bal)}원</div>'''
        # 일회성 유입 + 통과성 주석
        detail += f'''<h3 style="font-size:14px;margin:14px 0 6px">일회성 유입 ({won(s["oneoff"])}원, 복지포인트 제외)</h3>
        <table><thead><tr><th>날짜</th><th>분류</th><th class="num">금액</th><th>내역</th></tr></thead>
        <tbody>{_oneoff_rows(s)}</tbody></table>'''
        if s["passthrough"]:
            items = "".join(
                f'<li>수입 {won(v)}원 (<b>{m}</b>) ↔ 비슷한 지출 {won(hit[0])}원 [{hit[1]}/{hit[2]}] '
                f'— 통과성 가능(자동 상쇄 안 함)</li>'
                for v, m, hit in s["passthrough"])
            detail += f'<div class="note pt"><b>🔎 통과성 의심(주석)</b><ul class="tips">{items}</ul></div>'
        detail += "</section>"

    return f'''<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>위플 가계부 리포트</title>
<style>
:root{{--blue:#4a86e8;--red:#e06666;--ink:#1f2933;--mut:#6b7684;--line:#e5e8eb;--bg:#f5f6f8}}
*{{box-sizing:border-box}}
body{{margin:0;background:var(--bg);color:var(--ink);line-height:1.55;
 font-family:-apple-system,BlinkMacSystemFont,"Apple SD Gothic Neo","Malgun Gothic","Noto Sans KR",sans-serif}}
.wrap{{max-width:880px;margin:0 auto;padding:20px 16px 60px}}
h1{{font-size:23px;margin:8px 0 4px}} .sub{{color:var(--mut);font-size:13px;margin-bottom:18px}}
.note{{background:#fff7e6;border:1px solid #ffe1a8;border-radius:10px;padding:12px 14px;font-size:13.5px;margin:14px 0}}
.note b{{color:#b26a00}} .note.pt{{background:#eef4ff;border-color:#c9daf8}} .note.pt b{{color:#1c4587}}
.cards{{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin:18px 0}}
.card{{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px}} .card h3{{margin:0 0 10px;font-size:16px}}
.kv{{display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:14px}}
.kv span{{color:var(--mut)}} .kv b{{font-variant-numeric:tabular-nums}} .kv .exp{{color:var(--red)}}
.balance{{margin-top:6px;border-top:1px dashed var(--line);padding-top:8px}} .balance b{{font-size:16px}}
.pos b{{color:#1a8754}} .neg b{{color:#cc0000}} .muted span{{font-size:12.5px;color:#9aa3ad}}
.chart{{background:#fff;border:1px solid var(--line);border-radius:14px;padding:10px;margin:18px 0}}
.chart img{{width:100%;height:auto;border-radius:8px}}
section{{background:#fff;border:1px solid var(--line);border-radius:14px;padding:16px 18px;margin:16px 0}}
section h2{{font-size:18px;margin:0 0 12px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}}
.tag{{font-size:12px;font-weight:600;color:#fff;background:var(--blue);padding:2px 8px;border-radius:999px}}
table{{width:100%;border-collapse:collapse;font-size:13.5px}}
th,td{{padding:7px 8px;border-bottom:1px solid var(--line);text-align:left}}
th{{color:var(--mut);font-weight:600;font-size:12.5px}}
td.num,th.num{{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}}
.barcell{{width:34%}} .bar{{display:inline-block;height:9px;border-radius:5px;background:var(--blue)}}
.gt{{font-size:10.5px;font-weight:600;color:#fff;padding:1px 6px;border-radius:999px;margin-right:3px;vertical-align:middle}}
.gt.gfix{{background:#4a86e8}} .gt.gvar{{background:#e06666}} .gt.gsave{{background:#6aa84f}}
table.trend tr.grouprow.gfix{{background:#eef4ff}} table.trend tr.grouprow.gvar{{background:#fdf2f2}} table.trend tr.grouprow.gsave{{background:#eff7ee}}
table.trend tr.grouprow td{{border-bottom:1px solid #d4dbe3}}
table.vardetail tr.sub td{{color:var(--mut);font-size:12px;padding:2px 8px 8px 18px;border-bottom:1px solid var(--line);line-height:1.5}}
table.vardetail tr.sub td{{white-space:normal;word-break:break-all}}
.wfbox{{background:#f7f3ff;border:1px solid #e4d7f5;border-radius:10px;padding:10px 12px;margin-top:10px;font-size:13.5px}}
ul.tips{{margin:6px 0 0;padding-left:18px;font-size:13.5px}} ul.tips li{{margin:6px 0}}
.foot{{color:var(--mut);font-size:12px;text-align:center;margin-top:24px}}
</style></head><body><div class="wrap">
<h1>📊 위플 가계부 리포트</h1>
<div class="sub">원본: {src_name} · weple_report.py 자동 생성</div>
<div class="note"><b>보정 방법</b><br>
① 카드대금 납부 = 이체로 제외 &nbsp; ② 페이코(복지포인트) = 별도 장부 분리<br>
③ 충전형 페이카드 = 충전 이체·실제 사용만 소비 &nbsp; ④ 이중입력 수동 제거<br>
→ <b>실가계소비 = 현금 + 신용카드 + 충전카드 실사용</b> 기준. 통과성 거래는 상쇄하지 않고 주석으로 표시.</div>
<div class="cards">{cards}</div>
{chart}
{trend_section}
{var_section}
{detail}
<section><h2>🔧 작성 개선 제안</h2><ul class="tips">
<li><b>카드대금 결제 → ‘이체’</b>로 기록(현금→카드). 개별 결제만 한 번 잡혀 중복이 사라집니다.</li>
<li><b>복지포인트 → 별도 자산</b>으로 두고 지급은 충전, 사용은 차감. 가계 현금과 섞지 않기.</li>
<li><b>충전형 페이카드 → 충전은 ‘이체’</b>, 실제 결제만 소비, 잔액은 자산 유지.</li>
<li><b>같은 지출을 두 사람이 각자 입력</b>하지 않도록 입력 규칙 맞추기.</li>
</ul></section>
<div class="foot">통과성·자산성 항목은 차감하지 않고 주석으로만 표시했습니다. 규칙은 weple_report.py 상단 CONFIG에서 수정하세요.</div>
</div></body></html>'''


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
    args = ap.parse_args()

    _, data = load(args.csv)
    months = args.months or months_in(data)
    stats = [analyze(data, ym) for ym in months]

    for s in stats:
        print(f"{s['ym']}  정기수입 {won(s['reg']):>12}  실가계소비 {won(s['real']):>12}  "
              f"수지 {won(s['reg'] - s['real']):>12}")

    # 추세: 보고 대상 마지막 달 기준 최근 N개월
    trend = None
    if args.trend and args.trend >= 2:
        latest = max(months)
        tmonths = [prev_month(latest, k) for k in range(args.trend - 1, -1, -1)]
        trend = [analyze(data, ym) for ym in tmonths]

    chart = build_chart(stats)
    html = build_html(stats, chart, src_name=args.csv.split("/")[-1], trend=trend)
    with open(args.out, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"\n✅ 생성 완료 → {args.out}")


if __name__ == "__main__":
    main()
