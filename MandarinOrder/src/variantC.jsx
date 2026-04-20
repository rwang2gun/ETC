/* Variant C — 농장 편지 톤 (Serif + 손글씨 + 편지 섹션) */
const { useState: useStateC, useRef: useRefC } = React;

function VariantC() {
  const s = window.useOrderState();
  const [addrOpen, setAddrOpen] = useStateC(false);
  const [addrTarget, setAddrTarget] = useStateC('orderer');
  const [toastMsg, setToastMsg] = useStateC('');
  const [toastShow, setToastShow] = useStateC(false);
  const [success, setSuccess] = useStateC(false);
  const toastT = useRefC();

  const showToast = (m) => {
    setToastMsg(m); setToastShow(true);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastShow(false), 1800);
  };

  const onCopyAccount = () => {
    if (navigator.clipboard) navigator.clipboard.writeText('352-1850-9917-13').catch(()=>{});
    showToast('계좌번호를 복사했어요');
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
    <div className="v-c" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <window.StatusBar />

      <div className="screen-body">
        {/* HERO */}
        <section className="hero-c">
          <div className="stamp"><span>제주</span>성전농장</div>
          <div className="greet">안녕하세요,</div>
          <h1 className="serif">올해 <em>귤</em>이<br/>익었습니다</h1>
          <p className="letter-intro">
            바람 많던 겨울을 지나,<br/>
            햇살 가득 머금은 귤이<br/>
            이제 막 제철을 맞았어요.
          </p>
          <div className="sig">— 농부 용호 드림</div>
          <div className="hero-photo-c">
            <div className="tape" />
            <span className="cap-c">오늘 아침 · 성전 농장에서</span>
          </div>
        </section>

        {/* 농장 편지 섹션 */}
        <section className="letter-section">
          <div className="paper">
            <h3>한 해 동안 정성껏 키운<br/>올해의 귤 이야기</h3>
            <p>
              올해는 유난히 비가 적어<br/>
              귤의 당도가 좋아졌어요.<br/>
              한 상자 한 상자,<br/>
              저희 가족이 직접 수확하고<br/>
              골라 담아 보내드립니다.
            </p>
            <p style={{ color: 'var(--leaf-deep)', fontWeight: 500 }}>
              맛없으면 꼭 말씀해 주세요.<br/>
              다시 보내드리겠습니다.
            </p>
            <span className="sig-c">— 김용호</span>
          </div>
        </section>

        {/* 상품 선택 */}
        <section className="section-c">
          <h2><span className="num-c">하나.</span><span className="serif">귤 상자 고르기</span></h2>

          <div className={`prod-c ${s.qty.kg5 > 0 ? 'has' : ''}`} onClick={() => s.qty.kg5 === 0 && s.bump('kg5', 1)}>
            <span className="handtag orange">선물용 추천</span>
            <div className="ptop">
              <div className="pimg b5" />
              <div style={{ flex: 1 }}>
                <h3 className="pname">5kg 선물 상자</h3>
                <p className="pdesc">30~35과 · 균일 사이즈<br/>스티로폼 박스에 단단히 담아요</p>
                <div className="pprice">25,000원</div>
              </div>
            </div>
            <Stepper count={s.qty.kg5} onDec={() => s.bump('kg5', -1)} onInc={() => s.bump('kg5', 1)} />
          </div>

          <div className={`prod-c ${s.qty.kg10 > 0 ? 'has' : ''}`} onClick={() => s.qty.kg10 === 0 && s.bump('kg10', 1)}>
            <span className="handtag">우리집 귤</span>
            <div className="ptop">
              <div className="pimg" />
              <div style={{ flex: 1 }}>
                <h3 className="pname">10kg 일반 상자</h3>
                <p className="pdesc">150~190과 · 작지만<br/>단맛이 진해 실속 있어요</p>
                <div className="pprice">33,000원</div>
              </div>
            </div>
            <Stepper count={s.qty.kg10} onDec={() => s.bump('kg10', -1)} onInc={() => s.bump('kg10', 1)} />
          </div>
        </section>

        {/* 총액 sticky */}
        <div className="section-c" style={{ paddingTop: 10 }}>
          <div className="total-sticky-c">
            <div className={`total-box-c ${s.totalCount === 0 ? 'empty' : ''}`}>
              {s.totalCount === 0 ? (
                <div className="total-break-c empty">어떤 귤이 좋으실까요?</div>
              ) : (
                <div className="total-break-c">
                  <div className="hand" style={{ fontFamily: "'Nanum Pen Script', cursive", color: 'var(--leaf-deep)', fontSize: 15, marginBottom: 2 }}>오늘의 주문</div>
                  <b>{s.breakdown}</b>
                </div>
              )}
              <TotalNumC value={s.total} empty={s.totalCount === 0} />
            </div>
          </div>
        </div>

        {/* 주문자 */}
        <section className="section-c">
          <h2><span className="num-c">둘.</span><span className="serif">주문하시는 분</span></h2>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">성함</label>
            <input className="input" placeholder="홍길동" value={s.orderer.name}
              onChange={e => s.setOrderer(o => ({ ...o, name: e.target.value }))} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">연락처</label>
            <input className="input" type="tel" inputMode="numeric" placeholder="010-0000-0000" value={s.orderer.phone}
              onChange={e => s.setOrderer(o => ({ ...o, phone: formatPhone(e.target.value) }))} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">우편번호</label>
            <div className="row-2">
              <button className="addr-btn" onClick={() => openAddr('orderer')}>
                <IconSearch /> 검색
              </button>
              <input className="input" placeholder="00000" readOnly value={s.orderer.zip} />
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">기본 주소</label>
            <input className="input" placeholder="검색 후 자동으로 들어와요" readOnly value={s.orderer.addr} />
          </div>
          <div>
            <label className="field-label">상세 주소</label>
            <input className="input" placeholder="동 · 호수 등" value={s.orderer.detail}
              onChange={e => s.setOrderer(o => ({ ...o, detail: e.target.value }))} />
          </div>
        </section>

        {/* 받는 사람 */}
        <section className="section-c">
          <h2><span className="num-c">셋.</span><span className="serif">귤이 도착할 곳</span></h2>
          <div className="toggle-row">
            <div>
              <div className="label">제가 받을게요</div>
              <div className="sub">위의 주문자 주소로 보내드려요</div>
            </div>
            <div className={`switch ${s.selfReceive ? 'on' : ''}`} onClick={() => s.setSelfReceive(v => !v)} />
          </div>

          {!s.selfReceive && (
            <div style={{ display: 'grid', gap: 14 }}>
              <div>
                <label className="field-label">받으시는 분 성함</label>
                <input className="input" placeholder="김제주" value={s.receiver.name}
                  onChange={e => s.setReceiver(r => ({ ...r, name: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">우편번호</label>
                <div className="row-2">
                  <button className="addr-btn" onClick={() => openAddr('receiver')}>
                    <IconSearch /> 검색
                  </button>
                  <input className="input" placeholder="00000" readOnly value={s.receiver.zip} />
                </div>
              </div>
              <div>
                <label className="field-label">기본 주소</label>
                <input className="input" placeholder="검색 후 자동으로 들어와요" readOnly value={s.receiver.addr} />
              </div>
              <div>
                <label className="field-label">상세 주소</label>
                <input className="input" placeholder="동 · 호수 등" value={s.receiver.detail}
                  onChange={e => s.setReceiver(r => ({ ...r, detail: e.target.value }))} />
              </div>
              <div>
                <label className="field-label">받으시는 분 연락처</label>
                <input className="input" type="tel" inputMode="numeric" placeholder="010-0000-0000" value={s.receiver.phone}
                  onChange={e => s.setReceiver(r => ({ ...r, phone: formatPhone(e.target.value) }))} />
              </div>
            </div>
          )}
        </section>

        {/* 입금 */}
        <section className="section-c">
          <h2><span className="num-c">넷.</span><span className="serif">입금 계좌</span></h2>
          <div className="bank-card-c">
            <div className="lbl">아래 계좌로 보내주세요</div>
            <div className="num">농협 352-1850-9917-13</div>
            <div className="owner">예금주 김용호 · 제주 성전 농장</div>
            <button className="copy-btn" onClick={onCopyAccount} aria-label="복사">
              <IconCopy />
            </button>
          </div>
          <div style={{ marginTop: 16 }}>
            <label className="field-label">입금자 성함</label>
            <input className="input" placeholder="입금 시 표시될 이름" value={s.depositor}
              onChange={e => s.setDepositor(e.target.value)} />
            <p style={{ fontSize: 12, color: '#6B6355', margin: '10px 0 0', lineHeight: 1.7, fontStyle: 'italic' }}>
              입금 확인되는 대로 이틀 안에 보내드릴게요.<br/>
              혹여 입금자명이 달라지면 미리 알려주세요.
            </p>
          </div>
        </section>

        <section className="section-c" style={{ paddingBottom: 120 }}>
          <div className={`consent ${s.agreed ? 'on' : ''}`} onClick={() => s.setAgreed(v => !v)}>
            <div className="check">
              {s.agreed && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M20 6L9 17l-5-5"/></svg>}
            </div>
            <div className="txt">
              <b>개인정보 수집 · 이용에 동의해요</b><br/>
              주문 · 배송 · 환불 목적으로만 쓰이고, 3개월 뒤 파기돼요.
            </div>
          </div>
        </section>
      </div>

      <div className="cta-dock">
        <button className="cta" disabled={!s.isValid} onClick={onSubmit}>
          {s.totalCount === 0 ? '귤을 골라주세요'
            : !s.isValid ? '빠진 칸이 있어요'
            : `${formatWon(s.total)}원 · 주문 보내기`}
        </button>
      </div>

      <window.AddressModal open={addrOpen} onClose={() => setAddrOpen(false)} onPick={onPickAddr} />
      <Toast message={toastMsg} show={toastShow} />

      {success && <SuccessScreenC state={s} onNewOrder={onNewOrder} showToast={showToast} />}
    </div>
  );
}

function SuccessScreenC({ state: s, onNewOrder, showToast }) {
  const onCopy = () => {
    if (navigator.clipboard) navigator.clipboard.writeText('352-1850-9917-13').catch(()=>{});
    showToast('계좌번호를 복사했어요');
  };
  return (
    <div className="success-screen show">
      <window.StatusBar />
      <div className="success-inner">
        <div className="check-circle"><IconCheck /></div>
        <div style={{ fontFamily: "'Nanum Pen Script', cursive", color: 'var(--leaf-deep)', fontSize: 22, textAlign: 'center', marginBottom: 2 }}>고맙습니다,</div>
        <h2 className="serif">주문을 받았어요</h2>
        <p className="sub">입금 확인 후 이틀 안에<br/>정성껏 담아 보내드릴게요</p>

        <div className="summary">
          <h4 className="serif" style={{ color: 'var(--leaf-deep)', fontSize: 14 }}>오늘의 주문</h4>
          {s.qty.kg5 > 0 && <div className="row"><span className="k">5kg 선물 상자</span><span className="v">{s.qty.kg5}박스 · {formatWon(s.qty.kg5*25000)}원</span></div>}
          {s.qty.kg10 > 0 && <div className="row"><span className="k">10kg 일반 상자</span><span className="v">{s.qty.kg10}박스 · {formatWon(s.qty.kg10*33000)}원</span></div>}
          <div className="row total"><span className="k">모두 합해</span><span className="v">{formatWon(s.total)}원</span></div>
        </div>

        <div className="summary">
          <h4 className="serif" style={{ color: 'var(--leaf-deep)', fontSize: 14 }}>귤이 도착할 곳</h4>
          <div className="row"><span className="k">받는 분</span><span className="v">{s.selfReceive ? s.orderer.name : s.receiver.name}</span></div>
          <div className="row"><span className="k">연락처</span><span className="v">{s.selfReceive ? s.orderer.phone : s.receiver.phone}</span></div>
          <div className="row"><span className="k">주소</span><span className="v" style={{ maxWidth: '60%' }}>{s.selfReceive ? `[${s.orderer.zip}] ${s.orderer.addr} ${s.orderer.detail}` : `[${s.receiver.zip}] ${s.receiver.addr} ${s.receiver.detail}`}</span></div>
        </div>

        <div className="summary" style={{ background: '#FFFDF6', borderColor: 'var(--orange)' }}>
          <h4 className="serif" style={{ color: 'var(--orange-deep)', fontSize: 14 }}>입금 부탁드려요</h4>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>농협 352-1850-9917-13</div>
          <div style={{ fontSize: 13, color: '#5A4E35', marginBottom: 12 }}>김용호 · 입금자명 <b>{s.depositor}</b></div>
          <button className="cta" style={{ height: 52 }} onClick={onCopy}>
            <IconCopy style={{ width: 18, height: 18, stroke: 'white' }} /> 계좌번호 복사하기
          </button>
        </div>

        <div style={{
          background: 'white', border: '1.5px dashed var(--line)', padding: '14px 16px',
          borderRadius: 4, fontFamily: "'Nanum Pen Script', cursive", fontSize: 18,
          color: 'var(--leaf-deep)', textAlign: 'center', lineHeight: 1.6,
          marginBottom: 14, transform: 'rotate(-0.5deg)',
        }}>
          주문해주셔서 정말 고맙습니다.<br/>맛있는 귤로 만나요 🍊
        </div>

        <div className="cta-row">
          <button className="secondary-btn" onClick={onNewOrder}>새 주문</button>
          <button className="cta" onClick={() => showToast('카톡으로 공유했어요')}>카톡 공유</button>
        </div>
      </div>
    </div>
  );
}

function TotalNumC({ value, empty }) {
  const v = window.useCountUp(value);
  if (empty) return <div className="total-sum-c" style={{ color: '#B8B0A0' }}>0원</div>;
  return <div className="total-sum-c">{formatWon(v)}원</div>;
}

window.VariantC = VariantC;
