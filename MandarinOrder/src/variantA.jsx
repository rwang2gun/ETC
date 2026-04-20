/* Variant A — 따뜻한 자연주의 표준 */
const { useState: useStateA, useEffect: useEffectA, useRef: useRefA } = React;

function VariantA() {
  const s = window.useOrderState();
  const [addrOpen, setAddrOpen] = useStateA(false);
  const [addrTarget, setAddrTarget] = useStateA('orderer');
  const [toastMsg, setToastMsg] = useStateA('');
  const [toastShow, setToastShow] = useStateA(false);
  const [success, setSuccess] = useStateA(false);
  const toastT = useRefA();

  const showToast = (m) => {
    setToastMsg(m); setToastShow(true);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastShow(false), 1800);
  };

  const onCopyAccount = () => {
    if (navigator.clipboard) navigator.clipboard.writeText('352-1850-9917-13').catch(()=>{});
    showToast('계좌번호가 복사됐어요');
  };

  const onPickAddr = (a) => {
    if (addrTarget === 'orderer') {
      s.setOrderer(o => ({ ...o, zip: a.zip, addr: a.main }));
    } else {
      s.setReceiver(r => ({ ...r, zip: a.zip, addr: a.main }));
    }
    setAddrOpen(false);
  };
  const openAddr = (target) => { setAddrTarget(target); setAddrOpen(true); };

  const onSubmit = () => {
    if (!s.isValid) return;
    setSuccess(true);
  };

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
    <div className="v-a" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <window.StatusBar />

      <div className="screen-body">
        {/* HERO */}
        <section className="hero-a">
          <span className="leaf-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66C8 15 14 13 17 13h2V8h-2z"/></svg>
            제주 성전 농장
          </span>
          <h1>2025 제주 성전 <span className="orange">귤</span>이<br/>나왔어요</h1>
          <p className="sub">
            <b>판매 기간</b> 2025.11.20 ~ 12.30<br/>
            <b>포장</b> 주문 당일 수확 · 2일 내 발송
          </p>
          <div className="hero-photo">
            <span className="cap">제주 성전 농장 · 귤밭</span>
          </div>
        </section>

        {/* 상품 선택 */}
        <section className="section-a">
          <div className="num"><span className="num-dot">1</span>귤 상자 선택</div>
          <h2>어떤 귤을 보내드릴까요?</h2>
          <p className="section-desc">카드를 눌러 수량을 정해주세요. 여러 박스를 같이 담을 수 있어요.</p>

          <div className={`prod ${s.qty.kg5 > 0 ? 'has' : ''}`} onClick={() => s.qty.kg5 === 0 && s.bump('kg5', 1)}>
            <div className="prod-top">
              <div className="prod-img b5" />
              <div className="prod-meta">
                <div className="prod-title">
                  <strong>5kg 선물용</strong>
                  <span className="chip">선물 추천</span>
                </div>
                <p className="prod-desc">30~35개 · 균일 사이즈<br/>튼튼한 스티로폼 박스</p>
                <div className="prod-price">25,000<span className="won">원</span></div>
              </div>
            </div>
            <Stepper count={s.qty.kg5} onDec={() => s.bump('kg5', -1)} onInc={() => s.bump('kg5', 1)} />
          </div>

          <div className={`prod ${s.qty.kg10 > 0 ? 'has' : ''}`} onClick={() => s.qty.kg10 === 0 && s.bump('kg10', 1)}>
            <div className="prod-top">
              <div className="prod-img" />
              <div className="prod-meta">
                <div className="prod-title">
                  <strong>10kg 일반</strong>
                  <span className="chip" style={{ background: 'rgba(245,146,62,.14)', color: 'var(--orange-deep)' }}>가성비</span>
                </div>
                <p className="prod-desc">150~190개 · 과실 작지만<br/>단맛 진한 실속형</p>
                <div className="prod-price">33,000<span className="won">원</span></div>
              </div>
            </div>
            <Stepper count={s.qty.kg10} onDec={() => s.bump('kg10', -1)} onInc={() => s.bump('kg10', 1)} />
          </div>
        </section>

        {/* 실시간 총액 (sticky) */}
        <div className="section-a" style={{ paddingTop: 12 }}>
          <div className="total-sticky">
            <div className={`total-box ${s.totalCount === 0 ? 'empty' : ''}`}>
              {s.totalCount === 0 ? (
                <div className="total-breakdown empty">상품을 선택해 주세요</div>
              ) : (
                <div className="total-breakdown">
                  <div style={{ fontSize: 11, color: 'var(--leaf-deep)', fontWeight: 700, marginBottom: 2 }}>실시간 총액</div>
                  <b>{s.breakdown}</b>
                </div>
              )}
              {s.totalCount === 0 ? (
                <div className="total-sum" style={{ color: '#B8B0A0' }}>0<span className="won">원</span></div>
              ) : (
                <AnimatedWon value={s.total} className="total-sum" />
              )}
            </div>
          </div>
        </div>

        {/* 주문자 정보 */}
        <section className="section-a">
          <div className="num"><span className="num-dot">2</span>주문자 정보</div>
          <h2>누구의 주문인가요?</h2>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">이름 <span className="req">*</span></label>
            <input className="input" placeholder="홍길동" value={s.orderer.name}
              onChange={e => s.setOrderer(o => ({ ...o, name: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">휴대폰 번호 <span className="req">*</span></label>
            <input className="input" type="tel" inputMode="numeric" placeholder="010-0000-0000" value={s.orderer.phone}
              onChange={e => s.setOrderer(o => ({ ...o, phone: formatPhone(e.target.value) }))} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">우편번호 <span className="req">*</span></label>
            <div className="row-2">
              <button className="addr-btn" onClick={() => openAddr('orderer')}>
                <IconSearch /> 검색
              </button>
              <input className="input" placeholder="00000" readOnly value={s.orderer.zip} />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">기본 주소</label>
            <input className="input" placeholder="주소 검색 후 자동 입력돼요" readOnly value={s.orderer.addr} />
          </div>
          <div>
            <label className="field-label">상세 주소 <span className="req">*</span></label>
            <input className="input" placeholder="동/호수 등" value={s.orderer.detail}
              onChange={e => s.setOrderer(o => ({ ...o, detail: e.target.value }))} />
          </div>
        </section>

        {/* 받는 사람 */}
        <section className="section-a">
          <div className="num"><span className="num-dot">3</span>받는 사람</div>
          <h2>어디로 보내드릴까요?</h2>
          <div className="toggle-row">
            <div>
              <div className="label">본인이 받아요</div>
              <div className="sub">주문자 주소로 그대로 보내드려요</div>
            </div>
            <div className={`switch ${s.selfReceive ? 'on' : ''}`} onClick={() => s.setSelfReceive(v => !v)} role="switch" aria-checked={s.selfReceive} />
          </div>

          {!s.selfReceive && (
            <div style={{ display: 'grid', gap: 14, animation: 'fadeIn .2s ease' }}>
              <div>
                <label className="field-label">받는 분 이름 <span className="req">*</span></label>
                <input className="input" placeholder="김제주" value={s.receiver.name}
                  onChange={e => s.setReceiver(r => ({ ...r, name: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">우편번호 <span className="req">*</span></label>
                <div className="row-2">
                  <button className="addr-btn" onClick={() => openAddr('receiver')}>
                    <IconSearch /> 검색
                  </button>
                  <input className="input" placeholder="00000" readOnly value={s.receiver.zip} />
                </div>
              </div>
              <div>
                <label className="field-label">기본 주소</label>
                <input className="input" placeholder="주소 검색 후 자동 입력돼요" readOnly value={s.receiver.addr} />
              </div>
              <div>
                <label className="field-label">상세 주소 <span className="req">*</span></label>
                <input className="input" placeholder="동/호수 등" value={s.receiver.detail}
                  onChange={e => s.setReceiver(r => ({ ...r, detail: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">받는 분 휴대폰 <span className="req">*</span></label>
                <input className="input" type="tel" inputMode="numeric" placeholder="010-0000-0000" value={s.receiver.phone}
                  onChange={e => s.setReceiver(r => ({ ...r, phone: formatPhone(e.target.value) }))} />
              </div>
            </div>
          )}
        </section>

        {/* 입금 안내 */}
        <section className="section-a">
          <div className="num"><span className="num-dot">4</span>입금 안내</div>
          <h2>아래 계좌로 입금해 주세요</h2>
          <div className="bank-card">
            <div className="lbl">농협은행</div>
            <div className="num">352-1850-9917-13</div>
            <div className="owner">예금주 김용호 · 제주 성전 농장</div>
            <button className="copy-btn" onClick={onCopyAccount} aria-label="계좌번호 복사">
              <IconCopy />
            </button>
          </div>
          <div style={{ marginTop: 16 }}>
            <label className="field-label">입금자명 <span className="req">*</span></label>
            <input className="input" placeholder="입금 시 표시될 이름" value={s.depositor}
              onChange={e => s.setDepositor(e.target.value)} />
            <p style={{ fontSize: 12, color: '#8B8578', margin: '8px 0 0', lineHeight: 1.6 }}>
              · 주문자명과 다를 경우 확인이 어려워요<br/>
              · 입금 확인 후 2일 내 발송됩니다
            </p>
          </div>
        </section>

        {/* 동의 */}
        <section className="section-a" style={{ paddingBottom: 120 }}>
          <div className={`consent ${s.agreed ? 'on' : ''}`} onClick={() => s.setAgreed(v => !v)}>
            <div className="check">
              {s.agreed && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
            </div>
            <div className="txt">
              <b>개인정보 수집 · 이용에 동의합니다</b><br/>
              주문 접수 · 배송 · 환불 처리 목적으로 사용되며, 3개월 후 파기돼요.
            </div>
          </div>
        </section>
      </div>

      {/* 하단 고정 CTA */}
      <div className="cta-dock">
        <button className="cta" disabled={!s.isValid} onClick={onSubmit}>
          {s.totalCount === 0 ? '귤 상자를 선택해 주세요'
            : !s.isValid ? '정보를 모두 입력해 주세요'
            : `${formatWon(s.total)}원 · 주문 완료하기`}
        </button>
      </div>

      <window.AddressModal open={addrOpen} onClose={() => setAddrOpen(false)} onPick={onPickAddr} />
      <Toast message={toastMsg} show={toastShow} />

      {success && (
        <SuccessScreenA state={s} onNewOrder={onNewOrder} showToast={showToast} />
      )}
    </div>
  );
}

function SuccessScreenA({ state: s, onNewOrder, showToast }) {
  const onCopy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText('352-1850-9917-13').catch(()=>{});
    showToast('계좌번호가 복사됐어요');
  };
  return (
    <div className="success-screen show">
      <window.StatusBar />
      <div className="success-inner">
        <div className="check-circle"><IconCheck /></div>
        <h2>주문이 접수됐어요</h2>
        <p className="sub">입금 확인 후 2일 내<br/>주문하신 주소로 발송해드립니다</p>

        <div className="summary">
          <h4>주문 내역</h4>
          {s.qty.kg5 > 0 && <div className="row"><span className="k">5kg 선물용</span><span className="v">{s.qty.kg5}박스 · {formatWon(s.qty.kg5 * 25000)}원</span></div>}
          {s.qty.kg10 > 0 && <div className="row"><span className="k">10kg 일반</span><span className="v">{s.qty.kg10}박스 · {formatWon(s.qty.kg10 * 33000)}원</span></div>}
          <div className="row total"><span className="k">총 결제금액</span><span className="v">{formatWon(s.total)}원</span></div>
        </div>

        <div className="summary">
          <h4>받는 곳</h4>
          <div className="row"><span className="k">받는 분</span><span className="v">{s.selfReceive ? s.orderer.name : s.receiver.name}</span></div>
          <div className="row"><span className="k">연락처</span><span className="v">{s.selfReceive ? s.orderer.phone : s.receiver.phone}</span></div>
          <div className="row"><span className="k">주소</span><span className="v" style={{ maxWidth: '60%' }}>{s.selfReceive ? `[${s.orderer.zip}] ${s.orderer.addr} ${s.orderer.detail}` : `[${s.receiver.zip}] ${s.receiver.addr} ${s.receiver.detail}`}</span></div>
        </div>

        <div className="summary" style={{ background: 'rgba(245,146,62,.08)', borderColor: 'rgba(245,146,62,.3)' }}>
          <h4 style={{ color: 'var(--orange-deep)' }}>입금 계좌</h4>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>농협 352-1850-9917-13</div>
          <div style={{ fontSize: 13, color: '#6B6355', marginBottom: 10 }}>예금주 김용호 · 입금자명 <b>{s.depositor}</b></div>
          <button className="cta" style={{ height: 52 }} onClick={onCopy}>
            <IconCopy style={{ width: 18, height: 18, stroke: 'white' }} /> 계좌번호 복사하기
          </button>
        </div>

        <div className="cta-row">
          <button className="secondary-btn" onClick={onNewOrder}>새 주문</button>
          <button className="cta" onClick={() => showToast('카톡으로 공유했어요')}>카톡 공유</button>
        </div>
      </div>
    </div>
  );
}

window.VariantA = VariantA;
