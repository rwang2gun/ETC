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

// ---------- Address search modal (shared) ----------
const MOCK_ADDR = [
  { zip: '04524', main: '서울특별시 중구 세종대로 110', old: '서울 중구 태평로1가 31' },
  { zip: '06236', main: '서울특별시 강남구 테헤란로 152', old: '서울 강남구 역삼동 737' },
  { zip: '13494', main: '경기도 성남시 분당구 판교역로 166', old: '경기 성남시 분당구 백현동 541' },
  { zip: '48060', main: '부산광역시 해운대구 해운대로 570', old: '부산 해운대구 우동 1394' },
  { zip: '63309', main: '제주특별자치도 제주시 1100로 2894-78', old: '제주 제주시 노형동 925' },
  { zip: '10881', main: '경기도 파주시 회동길 445', old: '경기 파주시 문발동 526' },
  { zip: '04637', main: '서울특별시 중구 퇴계로 100', old: '서울 중구 회현동1가 100' },
];

function AddressModal({ open, onClose, onPick, theme = 'a' }) {
  const [q, setQ] = useState('');
  useEffect(() => { if (open) setQ(''); }, [open]);
  const filtered = q.trim()
    ? MOCK_ADDR.filter(a => a.main.includes(q) || a.old.includes(q) || a.zip.includes(q))
    : [];
  return (
    <div className={`modal-scrim ${open ? 'show' : ''}`} onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()} style={{ position: 'relative' }}>
        <div className="handle" />
        <button className="close-x" onClick={onClose}>×</button>
        <h3>우편번호 검색</h3>
        <div className="search-box">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8B8578" strokeWidth="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input value={q} onChange={e => setQ(e.target.value)}
            placeholder="도로명, 건물명, 지번 검색" autoFocus />
        </div>
        <div className="results">
          {q.trim() === '' && (
            <div className="empty-hint">
              예) 판교역로, 해운대로, 제주 1100로<br/>
              <span style={{ color: '#B8B0A0', fontSize: 12 }}>도로명 또는 건물명을 입력하세요</span>
            </div>
          )}
          {q.trim() !== '' && filtered.length === 0 && (
            <div className="empty-hint">검색 결과가 없어요.<br/>다른 키워드로 시도해 주세요.</div>
          )}
          {filtered.map(a => (
            <div key={a.zip} className="result-item" onClick={() => onPick(a)}>
              <span className="zip">{a.zip}</span>
              <div style={{ display: 'inline-block' }}>
                <div className="addr-main">{a.main}</div>
                <div className="addr-old">(지번) {a.old}</div>
              </div>
            </div>
          ))}
        </div>
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

// ---------- Status bar ----------
function StatusBar() {
  return (
    <div className="status-bar">
      <span>9:41</span>
      <div className="right">
        <svg width="16" height="10" viewBox="0 0 16 10" fill="currentColor">
          <rect x="0" y="6" width="3" height="4" rx=".5"/>
          <rect x="4" y="4" width="3" height="6" rx=".5"/>
          <rect x="8" y="2" width="3" height="8" rx=".5"/>
          <rect x="12" y="0" width="3" height="10" rx=".5"/>
        </svg>
        <svg width="14" height="10" viewBox="0 0 14 10" fill="none" stroke="currentColor" strokeWidth="1.3">
          <path d="M1 4a9 9 0 0112 0M3 6a6 6 0 018 0M5 8a3 3 0 014 0"/>
        </svg>
        <span className="battery" />
      </div>
    </div>
  );
}

// ---------- Phone frame ----------
function PhoneFrame({ children }) {
  return (
    <div className="phone">
      <div className="phone-notch" />
      <div className="phone-screen">
        {children}
      </div>
    </div>
  );
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

Object.assign(window, {
  PRODUCTS, formatPhone, formatWon, useCountUp, useOrderState,
  AddressModal, Toast, StatusBar, PhoneFrame, Stepper, AnimatedWon,
  IconCopy, IconSearch, IconCheck,
});
