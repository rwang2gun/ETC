/* Variant A — 따뜻한 자연주의 표준 */
const { useState: useStateA, useEffect: useEffectA, useRef: useRefA } = React;

// 송금 앱(토스 등)이 클립보드에서 은행·계좌를 알아보도록 은행명과 금액을 같이 복사
function copyAccountA(total, showToast) {
  const text = total > 0
    ? `농협 352-1850-9917-13 ${formatWon(total)}원`
    : '농협 352-1850-9917-13';
  if (navigator.clipboard) navigator.clipboard.writeText(text).catch(()=>{});
  showToast(total > 0 ? '계좌번호와 금액을 복사했어요' : '계좌번호가 복사됐어요');
}

function VariantA() {
  const s = window.useOrderState();
  const [addrOpen, setAddrOpen] = useStateA(false);
  const [addrTarget, setAddrTarget] = useStateA('orderer');
  const [toastMsg, setToastMsg] = useStateA('');
  const [toastShow, setToastShow] = useStateA(false);
  const [success, setSuccess] = useStateA(false);
  const [submitting, setSubmitting] = useStateA(false);
  // 입력칸에 포커스가 있으면(=가상 키보드가 떠 있으면) 하단 버튼을 숨겨 칸을 가리지 않게
  const [typing, setTyping] = useStateA(false);
  const isTextField = (el) => el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') && !el.readOnly;
  const onFieldFocus = (e) => { if (isTextField(e.target)) setTyping(true); };
  const onFieldBlur = (e) => { if (isTextField(e.target)) setTyping(false); };
  const toastT = useRefA();

  const showToast = (m) => {
    setToastMsg(m); setToastShow(true);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastShow(false), 1800);
  };

  const onCopyAccount = () => copyAccountA(s.total, showToast);

  const onPickAddr = (a) => {
    if (addrTarget === 'orderer') {
      s.setOrderer(o => ({ ...o, zip: a.zip, addr: a.main }));
    } else {
      s.setReceiver(r => ({ ...r, zip: a.zip, addr: a.main }));
    }
    setAddrOpen(false);
  };
  const openAddr = (target) => { setAddrTarget(target); setAddrOpen(true); };

  // 상세 주소가 비어 있으면 바로 보내지 않고 확인 팝업
  const [confirmNoDetail, setConfirmNoDetail] = useStateA(false);
  const detailRef = useRefA();

  const onSubmit = () => {
    if (!s.isValid || submitting) return;
    if (!s.receiver.detail.trim()) { setConfirmNoDetail(true); return; }
    doSubmit();
  };

  const onGoEditDetail = () => {
    setConfirmNoDetail(false);
    const el = detailRef.current;
    if (!el) return;
    // 부드러운 스크롤은 키보드가 올라올 때 어긋날 수 있어 즉시 이동 후 포커스
    const body = el.closest('.screen-body');
    if (body) {
      const prev = body.style.scrollBehavior;
      body.style.scrollBehavior = 'auto';
      const top = el.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
      body.scrollTop = Math.max(0, top - body.clientHeight / 3);
      body.style.scrollBehavior = prev;
    }
    el.focus({ preventScroll: true });
  };

  const onConfirmSubmit = () => { setConfirmNoDetail(false); doSubmit(); };

  const doSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const r = await window.submitOrderToSheet(s, 'A');
    setSubmitting(false);
    if (r.ok) setSuccess(true);
    else showToast('전송에 실패했어요. 잠시 후 다시 시도해 주세요');
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

      <div className="screen-body" onFocus={onFieldFocus} onBlur={onFieldBlur}>
        {/* HERO */}
        <section className="hero-a">
          <span className="leaf-chip">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66C8 15 14 13 17 13h2V8h-2z"/></svg>
            제주 성전 농장
          </span>
          <h1>2026 제주 성전 <span className="orange">귤</span>이<br/>나왔어요</h1>
          <p className="sub">
            <b>판매 시작</b> 2026.12.15부터<br/>
            신선한 귤을 바로 받아보세요.
          </p>
          <div className="hero-actions">
            <button className="share-page-btn" onClick={() => window.sharePageWithToast(showToast)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
              주문 페이지 공유하기
            </button>
            <a className="share-page-btn" href="tel:010-7315-0756">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/></svg>
              문의 010-7315-0756
            </a>
          </div>
          <div className="hero-photo">
            <span className="cap">제주 성전 농장 · 귤밭</span>
          </div>
        </section>

        {/* 상품 선택 */}
        <section className="section-a">
          <div className="num"><span className="num-dot">1</span>귤 상자 선택</div>
          <h2>상품을 선택해 주세요</h2>
          <p className="section-desc">버튼을 눌러 수량을 정해주세요. 여러 박스를 같이 담을 수 있어요.</p>

          <div className={`prod ${s.qty.kg5 > 0 ? 'has' : ''}`} onClick={() => s.qty.kg5 === 0 && s.bump('kg5', 1)}>
            <div className="prod-top">
              <div className="prod-img b5"><img src="img/5kg.jpg" alt="5kg 선물용 귤 상자" /></div>
              <div className="prod-meta">
                <div className="prod-title">
                  <strong>5kg 선물용</strong>
                  <span className="chip">선물 추천</span>
                </div>
                <p className="prod-desc">30~35개 · 균일 사이즈<br/>안전한 스티로폼 포장</p>
                <div className="prod-price">25,000<span className="won">원</span></div>
              </div>
            </div>
            <Stepper count={s.qty.kg5} onDec={() => s.bump('kg5', -1)} onInc={() => s.bump('kg5', 1)} />
          </div>

          <div className={`prod ${s.qty.kg10 > 0 ? 'has' : ''}`} onClick={() => s.qty.kg10 === 0 && s.bump('kg10', 1)}>
            <div className="prod-top">
              <div className="prod-img"><img src="img/10kg.jpg" alt="10kg 일반 귤 상자" /></div>
              <div className="prod-meta">
                <div className="prod-title">
                  <strong>10kg 일반</strong>
                  <span className="chip" style={{ background: 'rgba(245,146,62,.14)', color: 'var(--orange-deep)' }}>실속형</span>
                </div>
                <p className="prod-desc">150~190개<br/>박스 가득 달콤함이 가득</p>
                <div className="prod-price">{formatWon(PRODUCTS.kg10.price)}<span className="won">원</span></div>
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
          <h2>누가 주문하시나요?</h2>
          <div style={{ marginBottom: 14 }}>
            <label className="field-label">이름 <span className="req">*</span></label>
            <input className="input" placeholder="홍길동" value={s.orderer.name}
              onChange={e => s.setOrderer(o => ({ ...o, name: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">휴대폰 번호 <span className="req">*</span></label>
            <input className="input" type="tel" inputMode="numeric" placeholder="010-0000-0000" value={s.orderer.phone}
              onChange={e => s.setOrderer(o => ({ ...o, phone: formatPhone(e.target.value) }))} />
          </div>
        </section>

        {/* 받는 사람 */}
        <section className="section-a">
          <div className="num"><span className="num-dot">3</span>받는 사람</div>
          <h2>어디로 보내드릴까요?</h2>
          <div className="toggle-row">
            <div>
              <div className="label">본인이 받아요</div>
              <div className="sub">주문자 이름·연락처로 받아요.</div>
            </div>
            <div className={`switch ${s.selfReceive ? 'on' : ''}`} onClick={() => s.setSelfReceive(v => !v)} role="switch" aria-checked={s.selfReceive} />
          </div>

          <div style={{ display: 'grid', gap: 14 }}>
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
              <label className="field-label">상세 주소</label>
              <input ref={detailRef} className="input" placeholder="동/호수 등" value={s.receiver.detail}
                onChange={e => s.setReceiver(r => ({ ...r, detail: e.target.value }))} />
            </div>
            {!s.selfReceive && (
              <div style={{ animation: 'fadeIn .2s ease' }}>
                <label className="field-label">받는 분 이름 <span className="req">*</span></label>
                <input className="input" placeholder="김제주" value={s.receiver.name}
                  onChange={e => s.setReceiver(r => ({ ...r, name: e.target.value }))} />
              </div>
            )}
            {!s.selfReceive && (
              <div style={{ animation: 'fadeIn .2s ease' }}>
                <label className="field-label">받는 분 휴대폰 <span className="req">*</span></label>
                <input className="input" type="tel" inputMode="numeric" placeholder="010-0000-0000" value={s.receiver.phone}
                  onChange={e => s.setReceiver(r => ({ ...r, phone: formatPhone(e.target.value) }))} />
              </div>
            )}
          </div>
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
              · 주문자명과 다를 경우 확인이 어려워요.<br/>
              · 입금 확인 후 발송됩니다.
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
              <b>개인정보 수집 · 이용에 동의합니다.</b>
              <ul className="consent-list">
                <li>배송, 환불, 기타 문의 응대와 다음 출하 안내를 위해 주문자와 받는 분의 이름, 연락처, 주소를 수집합니다.</li>
                <li>동의 후 3년이 지나면 파기합니다.</li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      {/* 하단 고정 CTA */}
      <div className="cta-dock" style={typing ? { display: 'none' } : undefined}>
        <button className="cta" disabled={!s.isValid || submitting} onClick={onSubmit}>
          {submitting ? '주문을 보내는 중…'
            : s.totalCount === 0 ? '상품을 선택해 주세요'
            : !s.isValid ? '정보를 모두 입력해 주세요'
            : `${formatWon(s.total)}원 · 주문 완료하기`}
        </button>
      </div>

      <window.AddressModal open={addrOpen} onClose={() => setAddrOpen(false)} onPick={onPickAddr} />
      <Toast message={toastMsg} show={toastShow} />

      {confirmNoDetail && (
        <div className="confirm-scrim" role="dialog" aria-modal="true">
          <div className="confirm-box">
            <h3>상세 주소가 비어 있어요</h3>
            <p>아래 주소로 보내드려도 될지 확인해 주세요.</p>
            <div className="confirm-addr">[{s.receiver.zip}] {s.receiver.addr}</div>
            <div className="confirm-actions">
              <button className="secondary-btn" onClick={onGoEditDetail}>수정하러 가기</button>
              <button className="cta" onClick={onConfirmSubmit}>주문 완료하기</button>
            </div>
          </div>
        </div>
      )}

      {success && (
        <SuccessScreenA state={s} onNewOrder={onNewOrder} showToast={showToast} />
      )}
    </div>
  );
}

function SuccessScreenA({ state: s, onNewOrder, showToast }) {
  const onCopy = () => copyAccountA(s.total, showToast);
  const cardRef = useRefA();
  const [making, setMaking] = useStateA(false);
  const [cardImg, setCardImg] = useStateA(null);  // 미리보기 이미지 { url, file, name }
  const inKakao = window.isKakaoInApp();

  // 1) 이미지 만들어 미리보기 → 2) 저장하기 / 공유하기 선택
  const onMakeImage = async () => {
    if (making) return;
    setMaking(true);
    const img = await window.makeOrderCardImage(cardRef.current);
    setMaking(false);
    if (img) setCardImg(img);
    else showToast('이미지를 만들지 못했어요. 화면을 캡처해 주세요');
  };

  const onSaveImg = async () => {
    const r = await window.saveCardImage(cardImg);
    if (r === 'downloaded') showToast('주문내역 이미지를 저장했어요');
    else if (r === 'press') showToast('이미지를 길게 눌러 저장해 주세요');
  };

  const onShareImg = async () => {
    const r = await window.shareCardImage(cardImg);
    if (r === 'unsupported') showToast('여기서는 공유가 안 돼요. 이미지를 저장한 뒤 보내주세요');
  };

  return (
    <div className="success-screen show">
      <window.StatusBar />
      <div className="success-inner">
       {/* 이 영역이 그대로 저장 이미지가 됨 (data-html2canvas-ignore 요소는 제외) */}
       <div ref={cardRef} className="order-card">
        <div className="check-circle"><IconCheck /></div>
        <h2>주문이 접수됐어요</h2>
        <p className="sub">입금 확인 후<br/>주문하신 주소로 발송해드립니다.</p>

        <div className="summary">
          <h4>주문 내역</h4>
          {s.qty.kg5 > 0 && <div className="row"><span className="k">5kg 선물용</span><span className="v">{s.qty.kg5}박스 · {formatWon(s.qty.kg5 * 25000)}원</span></div>}
          {s.qty.kg10 > 0 && <div className="row"><span className="k">10kg 일반</span><span className="v">{s.qty.kg10}박스 · {formatWon(s.qty.kg10 * PRODUCTS.kg10.price)}원</span></div>}
          <div className="row total"><span className="k">총 결제금액</span><span className="v">{formatWon(s.total)}원</span></div>
        </div>

        <div className="summary">
          <h4>받는 곳</h4>
          <div className="row"><span className="k">받는 분</span><span className="v">{s.selfReceive ? s.orderer.name : s.receiver.name}</span></div>
          <div className="row"><span className="k">연락처</span><span className="v">{s.selfReceive ? s.orderer.phone : s.receiver.phone}</span></div>
          <div className="row"><span className="k">주소</span><span className="v" style={{ maxWidth: '60%' }}>{`[${s.receiver.zip}] ${s.receiver.addr} ${s.receiver.detail}`}</span></div>
        </div>

        <div className="summary" style={{ background: 'rgba(245,146,62,.08)', borderColor: 'rgba(245,146,62,.3)' }}>
          <h4 style={{ color: 'var(--orange-deep)' }}>입금 계좌</h4>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 2 }}>농협 352-1850-9917-13</div>
          <div style={{ fontSize: 13, color: '#6B6355', marginBottom: 4 }}>예금주 김용호 · 입금자명 <b>{s.depositor}</b></div>
          <div style={{ fontSize: 13, color: '#6B6355', marginBottom: 10 }}>
            문의 <a href="tel:010-7315-0756" style={{ color: 'var(--ink)', fontWeight: 700, textDecoration: 'none' }}>010-7315-0756</a>
          </div>
          <button className="cta" style={{ height: 52 }} onClick={onCopy} data-html2canvas-ignore="true">
            <IconCopy style={{ width: 18, height: 18, stroke: 'white' }} /> 계좌번호 복사하기
          </button>
        </div>
       </div>

        <div className="cta-row">
          <button className="secondary-btn" onClick={onNewOrder}>새 주문</button>
          <button className="cta" onClick={onMakeImage} disabled={making}>{making ? '만드는 중…' : '주문내역 이미지'}</button>
        </div>
      </div>

      {cardImg && (
        <div className="press-save" onClick={() => setCardImg(null)}>
          <p>{inKakao ? <>이미지를 <b>길게 눌러</b> 저장할 수 있어요.</> : '주문내역 이미지를 저장하거나 공유하세요.'}</p>
          <img src={cardImg.url} alt="주문내역" onClick={e => e.stopPropagation()} />
          <div className="press-save-actions" onClick={e => e.stopPropagation()}>
            <button className="secondary-btn" onClick={onSaveImg}>저장하기</button>
            <button className="cta" onClick={onShareImg}>공유하기</button>
          </div>
          <button className="press-save-close" onClick={() => setCardImg(null)}>닫기</button>
        </div>
      )}
    </div>
  );
}

window.VariantA = VariantA;
