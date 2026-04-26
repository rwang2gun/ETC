/* shared hooks + utilities + components */
const { useState, useEffect, useRef, useCallback, useMemo } = React;

// ---------- utilities ----------
const PRODUCTS = {
  kg10: { id: 'kg10', name: '10kg 일반', shortName: '10kg', price: 33000,
    desc: '일반용 · 150~190개 · 과실 작고 단맛 진해요', size: '10kg · 150~190과' },
  kg5:  { id: 'kg5',  name: '5kg 선물용', shortName: '5kg',  price: 25000,
    desc: '선물용 · 30~35개 · 균일 사이즈 · 스티로폼 박스', size: '5kg · 30~35과' },
};

function formatPhone(raw) {
  const d = (raw || '').replace(/\D/g, '').slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0,3)}-${d.slice(3)}`;
  return `${d.slice(0,3)}-${d.slice(3,7)}-${d.slice(7)}`;
}

function formatWon(n) {
  return (n || 0).toLocaleString('ko-KR');
}

// Count-up hook
function useCountUp(target, duration = 420) {
  const [val, setVal] = useState(target);
  const prev = useRef(target);
  const rafRef = useRef();
  useEffect(() => {
    if (target === prev.current) return;
    cancelAnimationFrame(rafRef.current);
    const from = prev.current;
    const to = target;
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const curr = Math.round(from + (to - from) * eased);
      setVal(curr);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
      else prev.current = to;
    };
    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);
  return val;
}

// Order state hook — shared by all variants
function useOrderState() {
  const [qty, setQty] = useState({ kg10: 0, kg5: 0 });
  const [orderer, setOrderer] = useState({ name: '', phone: '', zip: '', addr: '', detail: '' });
  const [selfReceive, setSelfReceive] = useState(true);
  const [receiver, setReceiver] = useState({ name: '', zip: '', addr: '', detail: '', phone: '' });
  const [depositor, setDepositor] = useState('');
  const [agreed, setAgreed] = useState(false);

  const total = qty.kg10 * PRODUCTS.kg10.price + qty.kg5 * PRODUCTS.kg5.price;
  const totalCount = qty.kg10 + qty.kg5;

  const breakdown = useMemo(() => {
    const parts = [];
    if (qty.kg5 > 0) parts.push(`5kg ${qty.kg5}박스`);
    if (qty.kg10 > 0) parts.push(`10kg ${qty.kg10}박스`);
    return parts.join(' + ');
  }, [qty]);

  const isValid = totalCount > 0
    && orderer.name.trim().length >= 2
    && orderer.phone.replace(/\D/g, '').length >= 10
    && orderer.zip.length > 0
    && orderer.detail.trim().length > 0
    && (selfReceive || (
      receiver.name.trim().length >= 2 &&
      receiver.zip.length > 0 &&
      receiver.detail.trim().length > 0 &&
      receiver.phone.replace(/\D/g, '').length >= 10
    ))
    && depositor.trim().length >= 2
    && agreed;

  const bump = (id, delta) => setQty(q => ({ ...q, [id]: Math.max(0, Math.min(99, q[id] + delta)) }));

  return {
    qty, setQty, bump, orderer, setOrderer, selfReceive, setSelfReceive,
    receiver, setReceiver, depositor, setDepositor, agreed, setAgreed,
    total, totalCount, breakdown, isValid,
  };
}

// ---------- Address search modal (Daum Postcode embed) ----------
// onPick 콜백은 기존 인터페이스 유지: { zip, main } — variant 코드 변경 불필요
function AddressModal({ open, onClose, onPick, theme = 'a' }) {
  const containerRef = useRef();

  useEffect(() => {
    if (!open || !containerRef.current) return;
    const el = containerRef.current;
    el.replaceChildren();

    if (typeof daum === 'undefined' || !daum.Postcode) {
      const msg = document.createElement('div');
      msg.style.cssText = 'padding:30px;text-align:center;color:#8B8578;font-size:13px';
      msg.textContent = '주소 검색을 불러오는 중입니다…';
      el.appendChild(msg);
      return;
    }

    new daum.Postcode({
      oncomplete: (data) => {
        onPick({
          zip: data.zonecode,
          main: data.roadAddress || data.jibunAddress,
        });
      },
      width: '100%',
      height: '100%',
    }).embed(el);
  }, [open]);

  return (
    <div className={`modal-scrim ${open ? 'show' : ''}`} onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
        <div className="handle" />
        <button className="close-x" onClick={onClose}>×</button>
        <h3>우편번호 검색</h3>
        <div ref={containerRef} style={{ flex: 1, minHeight: 0, marginTop: 8, overflow: 'hidden' }} />
      </div>
    </div>
  );
}

// ---------- Toast ----------
function Toast({ message, show }) {
  return (
    <div className="toast-wrap">
      <div className={`toast ${show ? 'show' : ''}`}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M20 6L9 17l-5-5"/>
        </svg>
        {message}
      </div>
    </div>
  );
}

// ---------- Status bar (no-op — was 9:41 fake mobile chrome) ----------
function StatusBar() {
  return null;
}

// ---------- App shell ----------
// 모바일: 풀스크린, 데스크탑: max-width 480px 중앙정렬 (CSS로 분기)
// 컴포넌트 이름은 PhoneFrame 그대로 유지 — app.jsx 호환성
function PhoneFrame({ children }) {
  return <div className="app-shell">{children}</div>;
}

// ---------- Stepper ----------
function Stepper({ count, onDec, onInc, label }) {
  return (
    <div className="stepper" onClick={e => e.stopPropagation()}>
      <span className="lbl">{label || '수량'}</span>
      <div className="ctrl">
        <button onClick={onDec} disabled={count === 0} aria-label="감소">−</button>
        <span className="count">{count}</span>
        <button onClick={onInc} aria-label="증가">+</button>
      </div>
    </div>
  );
}

// ---------- Animated total number ----------
function AnimatedWon({ value, className }) {
  const v = useCountUp(value);
  return <span className={className}><span className="num">{formatWon(v)}</span><span className="won">원</span></span>;
}

// ---------- Copy button icon ----------
const IconCopy = (props) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <rect x="9" y="9" width="13" height="13" rx="2"/>
    <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
  </svg>
);
const IconSearch = (props) => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" {...props}>
    <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
  </svg>
);
const IconCheck = (props) => (
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M20 6L9 17l-5-5"/>
  </svg>
);

// ---------- 주문 전송 (Google Sheet via Apps Script) ----------
// window.SHEET_ENDPOINT 가 비어 있으면 콘솔에 페이로드만 출력 (데모 모드).
async function submitOrderToSheet(state, variant) {
  const endpoint = window.SHEET_ENDPOINT;
  const lines = [];
  if (state.qty.kg10 > 0) {
    lines.push({
      product: '10KG', qty: state.qty.kg10,
      unit_price: PRODUCTS.kg10.price,
      subtotal: state.qty.kg10 * PRODUCTS.kg10.price,
    });
  }
  if (state.qty.kg5 > 0) {
    lines.push({
      product: '5KG', qty: state.qty.kg5,
      unit_price: PRODUCTS.kg5.price,
      subtotal: state.qty.kg5 * PRODUCTS.kg5.price,
    });
  }
  const payload = {
    variant,
    timestamp: new Date().toISOString(),
    lines,
    qty_5kg: state.qty.kg5,
    qty_10kg: state.qty.kg10,
    total_amount: state.total,
    orderer_name: state.orderer.name,
    orderer_phone: state.orderer.phone,
    orderer_zip: state.orderer.zip,
    orderer_addr: state.orderer.addr,
    orderer_detail: state.orderer.detail,
    self_receive: state.selfReceive,
    receiver_name: state.selfReceive ? state.orderer.name : state.receiver.name,
    receiver_phone: state.selfReceive ? state.orderer.phone : state.receiver.phone,
    receiver_zip: state.selfReceive ? state.orderer.zip : state.receiver.zip,
    receiver_addr: state.selfReceive ? state.orderer.addr : state.receiver.addr,
    receiver_detail: state.selfReceive ? state.orderer.detail : state.receiver.detail,
    depositor: state.depositor,
  };
  if (!endpoint) {
    console.log('[MandarinOrder] SHEET_ENDPOINT 미설정 — 데모 모드 (페이로드만 출력)', payload);
    return { ok: true, demo: true };
  }
  try {
    // text/plain 으로 보내 CORS preflight 회피 (Apps Script 표준 패턴)
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json().catch(() => ({ ok: true }));
    return data.ok === false ? { ok: false, error: data.error } : { ok: true };
  } catch (e) {
    console.error('[MandarinOrder] 주문 전송 실패', e);
    return { ok: false, error: String(e) };
  }
}

Object.assign(window, {
  PRODUCTS, formatPhone, formatWon, useCountUp, useOrderState,
  AddressModal, Toast, StatusBar, PhoneFrame, Stepper, AnimatedWon,
  IconCopy, IconSearch, IconCheck, submitOrderToSheet,
});
