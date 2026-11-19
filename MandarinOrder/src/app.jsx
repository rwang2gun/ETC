/* App wiring: 단일 변형 렌더 + 큰 글씨 모드. ACTIVE 만 바꾸면 스타일 교체. */
const { useState: useStateApp, useEffect: useEffectApp } = React;

const ACTIVE = 'A'; // 'A' | 'B' | 'C'

// 큰 글씨 설정은 이 폰(브라우저)에 기억. 저장소가 막힌 환경이면 그냥 기억 안 함
const BIG_FONT_KEY = 'mandarin-bigfont';
const readBigFont = () => { try { return localStorage.getItem(BIG_FONT_KEY) === '1'; } catch (e) { return false; } };

function App() {
  const [bigFont, setBigFont] = useStateApp(readBigFont);

  useEffectApp(() => {
    const root = document.documentElement;
    root.style.setProperty('--fs-scale', bigFont ? '1.18' : '1');
    root.toggleAttribute('data-bigfont', bigFont);  // 버튼 켜짐 표시용
    try { localStorage.setItem(BIG_FONT_KEY, bigFont ? '1' : '0'); } catch (e) {}
  }, [bigFont]);

  // 첫 화면의 '큰 글씨' 버튼(variantA)이 보내는 이벤트
  useEffectApp(() => {
    const onToggle = () => setBigFont(v => !v);
    window.addEventListener('toggle-bigfont', onToggle);
    return () => window.removeEventListener('toggle-bigfont', onToggle);
  }, []);

  const Variant = { A: window.VariantA, B: window.VariantB, C: window.VariantC }[ACTIVE];
  return <window.PhoneFrame><Variant /></window.PhoneFrame>;
}

ReactDOM.createRoot(document.getElementById('app')).render(<App />);
