/* Variant B — 미니멀 프리미엄 (블랙/화이트 + 오렌지 포인트) */
const { useState: useStateB, useEffect: useEffectB, useRef: useRefB } = React;

function VariantB() {
  const s = window.useOrderState();
  const [addrOpen, setAddrOpen] = useStateB(false);
  const [addrTarget, setAddrTarget] = useStateB('orderer');
  const [toastMsg, setToastMsg] = useStateB('');
  const [toastShow, setToastShow] = useStateB(false);
  const [success, setSuccess] = useStateB(false);
  const toastT = useRefB();

  const showToast = (m) => {
    setToastMsg(m); setToastShow(true);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastShow(false), 1800);
  };

  const onCopyAccount = () => {
    if (navigator.clipboard) navigator.clipboard.writeText('352-1850-9917-13').catch(()=>{});
    showToast('계좌번호 COPIED');
  };

  const onPickAddr = (a) => {
    if (addrTarget === 'orderer') s.setOrderer(o => ({ ...o, zip: a.zip, addr: a.main }));
    else s.setReceiver(r => ({ ...r, zip: a.zip, addr: a.main }));
    setAddrOpen(false);
  };
  const openAddr = (t) => { setAddrTarget(t); setAddrOpen(true); };

  const onSubmit = () => { if (s.isValid) setSuccess(true); };

  const onNewOrder = () => {
    s.setQty({ kg10: 0, kg5: 0 });
    s.setOrderer({ name: '', phone: '', zip: '', addr: '', detail: '' });
    s.setSelfReceive(true);
    s.setReceiver({ name: '', zip: '', addr: '', detail: '', phone: '' });
    s.setDepositor('');
    s.setAgreed(false);
    setSuccess(false);
  };

  return (
    <div className="v-b" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <window.StatusBar />

      <div className="screen-body">
        {/* HERO */}
        <section className="hero-b">
          <div className="year">2025 · JEJU · SEONGJEON</div>
          <h1>올해의 귤,<br/>수확의 순간.</h1>
          <div className="rule" />
          <div className="meta">
            <div><span className="k">SEASON</span><span className="v">2025.11.20 — 12.30</span></div>
            <div><span className="k">HARVEST</span><span className="v">주문 당일 · 2일 내 발송</span></div>
            <div><span className="k">ORIGIN</span><span className="v">제주 성전 농장 직배송</span></div>
          </div>
          <div className="hero-photo-b">
            <span className="cap-b">Photo · 제주 성전 농장</span>
          </div>
        </section>

        {/* 상품 */}
        <section className="section-b">
          <div className="tag">01 — Products</div>
          <h2>SELECT.</h2>

          <div className={`prod-b ${s.qty.kg5 > 0 ? 'has' : ''}`} onClick={() => s.qty.kg5 === 0 && s.bump('kg5', 1)}>
            <div className="brow">
              <div className="brow-left">
                <div className="top">GIFT · 5KG</div>
                <strong>5kg 선물용 박스</strong>
              </div>
              <div className="brow-right">
                <div className="price">25,000</div>
                <div className="unit">KRW / BOX</div>
              </div>
            </div>
            <p className="desc">30~35과 · 균일한 사이즈 · 스티로폼 박스 · 카드 동봉 가능.</p>
            <Stepper count={s.qty.kg5} onDec={() => s.bump('kg5', -1)} onInc={() => s.bump('kg5', 1)} />
          </div>

          <div className={`prod-b ${s.qty.kg10 > 0 ? 'has' : ''}`} onClick={() => s.qty.kg10 === 0 && s.bump('kg10', 1)}>
            <div className="brow">
              <div className="brow-left">
                <div className="top">DAILY · 10KG</div>
                <strong>10kg 일반 박스</strong>
              </div>
              <div className="brow-right">
                <div className="price">33,000</div>
                <div className="unit">KRW / BOX</div>
              </div>
            </div>
            <p className="desc">150~190과 · 작지만 단맛이 진한 실속형.</p>
            <Stepper count={s.qty.kg10} onDec={() => s.bump('kg10', -1)} onInc={() => s.bump('kg10', 1)} />
          </div>
        </section>

        {/* 총액 sticky */}
        <div className="section-b" style={{ paddingTop: 8 }}>
          <div className="total-sticky-b">
            <div className="total-label-b">TOTAL</div>
            <div className="total-box-b">
              <div className={`total-break-b ${s.totalCount === 0 ? 'empty' : ''}`}>
                {s.totalCount === 0 ? '상품 미선택' : s.breakdown}
              </div>
              <TotalNumB value={s.total} empty={s.totalCount === 0} />
            </div>
          </div>
        </div>

        {/* 주문자 */}
        <section className="section-b">
          <div className="tag">02 — Orderer</div>
          <h2>YOU.</h2>
          <div style={{ marginBottom: 20 }}>
            <label className="field-label">NAME</label>
            <input className="input" placeholder="홍길동" value={s.orderer.name}
              onChange={e => s.setOrderer(o => ({ ...o, name: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="field-label">MOBILE</label>
            <input className="input" type="tel" inputMode="numeric" placeholder="010-0000-0000" value={s.orderer.phone}
              onChange={e => s.setOrderer(o => ({ ...o, phone: formatPhone(e.target.value) }))} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="field-label">POSTAL CODE</label>
            <div className="row-2">
              <button className="addr-btn" onClick={() => openAddr('orderer')}>SEARCH</button>
              <input className="input" placeholder="00000" readOnly value={s.orderer.zip} />
            </div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <label className="field-label">ADDRESS</label>
            <input className="input" placeholder="검색 후 자동 입력" readOnly value={s.orderer.addr} />
          </div>
          <div>
            <label className="field-label">DETAIL</label>
            <input className="input" placeholder="동 / 호수" value={s.orderer.detail}
              onChange={e => s.setOrderer(o => ({ ...o, detail: e.target.value }))} />
          </div>
        </section>

        {/* 받는 사람 */}
        <section className="section-b">
          <div className="tag">03 — Delivery</div>
          <h2>SHIP TO.</h2>
          <div className="toggle-row">
            <div>
              <div className="label">SELF PICKUP</div>
              <div className="sub" style={{ fontSize: 11, color: '#999', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: 4 }}>주문자 주소로 배송</div>
            </div>
            <div className={`switch ${s.selfReceive ? 'on' : ''}`} onClick={() => s.setSelfReceive(v => !v)} />
          </div>

          {!s.selfReceive && (
            <div style={{ display: 'grid', gap: 20, marginTop: 20 }}>
              <div>
                <label className="field-label">RECEIVER NAME</label>
                <input className="input" placeholder="김제주" value={s.receiver.name}
                  onChange={e => s.setReceiver(r => ({ ...r, name: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">POSTAL CODE</label>
                <div className="row-2">
                  <button className="addr-btn" onClick={() => openAddr('receiver')}>SEARCH</button>
                  <input className="input" placeholder="00000" readOnly value={s.receiver.zip} />
                </div>
              </div>
              <div>
                <label className="field-label">ADDRESS</label>
                <input className="input" placeholder="검색 후 자동 입력" readOnly value={s.receiver.addr} />
              </div>
              <div>
                <label className="field-label">DETAIL</label>
                <input className="input" placeholder="동 / 호수" value={s.receiver.detail}
                  onChange={e => s.setReceiver(r => ({ ...r, detail: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">MOBILE</label>
                <input className="input" type="tel" inputMode="numeric" placeholder="010-0000-0000" value={s.receiver.phone}
                  onChange={e => s.setReceiver(r => ({ ...r, phone: formatPhone(e.target.value) }))} />
              </div>
            </div>
          )}
        </section>

        {/* 입금 */}
        <section className="section-b">
          <div className="tag">04 — Payment</div>
          <h2>BANK.</h2>
          <div className="bank-card-b">
            <div className="lbl">ACCOUNT</div>
            <div className="num"><span className="bank-lbl">NH</span>352-1850-9917-13</div>
            <div className="owner">HOLDER — 김용호 · 제주 성전 농장</div>
            <button className="copy-btn" onClick={onCopyAccount} aria-label="copy">
              <IconCopy />
            </button>
          </div>
          <div style={{ marginTop: 24 }}>
            <label className="field-label">DEPOSITOR NAME</label>
            <input className="input" placeholder="입금 시 표시될 이름" value={s.depositor}
              onChange={e => s.setDepositor(e.target.value)} />
          </div>
        </section>

        <section className="section-b" style={{ paddingBottom: 120 }}>
          <div className={`consent ${s.agreed ? 'on' : ''}`} onClick={() => s.setAgreed(v => !v)}>
            <div className="check">
              {s.agreed && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
            </div>
            <div className="txt" style={{ fontSize: 'calc(13px * var(--fs-scale))', lineHeight: 1.6 }}>
              <b style={{ letterSpacing: '0.04em' }}>PRIVACY CONSENT</b><br/>
              주문 · 배송 · 환불 목적 수집 · 3개월 후 파기
            </div>
          </div>
        </section>
      </div>

      <div className="cta-dock" style={{ background: 'white' }}>
        <button className="cta" disabled={!s.isValid} onClick={onSubmit}>
          {s.totalCount === 0 ? 'SELECT BOX'
            : !s.isValid ? 'COMPLETE ALL FIELDS'
            : `ORDER · ${formatWon(s.total)}원`}
        </button>
      </div>

      <window.AddressModal open={addrOpen} onClose={() => setAddrOpen(false)} onPick={onPickAddr} />
      <Toast message={toastMsg} show={toastShow} />

      {success && <SuccessScreenB state={s} onNewOrder={onNewOrder} showToast={showToast} />}
    </div>
  );
}

function SuccessScreenB({ state: s, onNewOrder, showToast }) {
  const onCopy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText('352-1850-9917-13').catch(()=>{});
    showToast('COPIED');
  };
  return (
    <div className="success-screen show">
      <window.StatusBar />
      <div className="success-inner">
        <div className="check-circle"><IconCheck /></div>
        <div style={{ fontSize: 11, letterSpacing: '0.24em', textTransform: 'uppercase', color: '#999', textAlign: 'center', marginBottom: 6, fontWeight: 700 }}>ORDER RECEIVED</div>
        <h2>주문 완료.</h2>
        <p className="sub">입금 확인 후 2일 내 발송해드립니다</p>

        <div className="summary">
          <h4 style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}>ITEMS</h4>
          {s.qty.kg5 > 0 && <div className="row"><span className="k">5kg Gift × {s.qty.kg5}</span><span className="v">{formatWon(s.qty.kg5*25000)}원</span></div>}
          {s.qty.kg10 > 0 && <div className="row"><span className="k">10kg Daily × {s.qty.kg10}</span><span className="v">{formatWon(s.qty.kg10*33000)}원</span></div>}
          <div className="row total"><span className="k">TOTAL</span><span className="v">{formatWon(s.total)}원</span></div>
        </div>

        <div className="summary">
          <h4 style={{ letterSpacing: '0.2em', textTransform: 'uppercase' }}>SHIP TO</h4>
          <div className="row"><span className="k">RECEIVER</span><span className="v">{s.selfReceive ? s.orderer.name : s.receiver.name}</span></div>
          <div className="row"><span className="k">MOBILE</span><span className="v">{s.selfReceive ? s.orderer.phone : s.receiver.phone}</span></div>
          <div className="row"><span className="k">ADDR</span><span className="v" style={{ maxWidth: '60%' }}>{s.selfReceive ? `[${s.orderer.zip}] ${s.orderer.addr} ${s.orderer.detail}` : `[${s.receiver.zip}] ${s.receiver.addr} ${s.receiver.detail}`}</span></div>
        </div>

        <div className="summary" style={{ background: '#0A0A0A', borderColor: '#0A0A0A' }}>
          <h4 style={{ color: 'var(--orange)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>PAY TO</h4>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'white', marginBottom: 4 }}>NH · 352-1850-9917-13</div>
          <div style={{ fontSize: 12, color: '#BBB', marginBottom: 12 }}>김용호 · 입금자명 <b style={{ color: 'white' }}>{s.depositor}</b></div>
          <button className="cta" style={{ height: 52 }} onClick={onCopy}>
            <IconCopy style={{ width: 18, height: 18, stroke: 'white' }} /> COPY ACCOUNT
          </button>
        </div>

        <div className="cta-row">
          <button className="secondary-btn" onClick={onNewOrder}>NEW</button>
          <button className="cta" onClick={() => showToast('SHARED')}>SHARE</button>
        </div>
      </div>
    </div>
  );
}

function TotalNumB({ value, empty }) {
  const v = window.useCountUp(value);
  if (empty) return <div className="total-sum-b empty">0</div>;
  return <div className="total-sum-b">{formatWon(v)}</div>;
}

window.VariantB = VariantB;
