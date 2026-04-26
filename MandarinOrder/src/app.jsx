/* App wiring: 단일 변형 렌더 + 노안 모드. ACTIVE 만 바꾸면 스타일 교체. */
const { useState: useStateApp, useEffect: useEffectApp } = React;

const ACTIVE = 'A'; // 'A' | 'B' | 'C'

function App() {
  const [bigFont, setBigFont] = useStateApp(false);

  useEffectApp(() => {
    document.documentElement.style.setProperty('--fs-scale', bigFont ? '1.18' : '1');
    const dot = document.getElementById('tweaksDot');
    if (dot) dot.classList.toggle('on', bigFont);
  }, [bigFont]);

  useEffectApp(() => {
    const btn = document.getElementById('tweaksToggle');
    const onClick = () => setBigFont(v => !v);
    btn && btn.addEventListener('click', onClick);
    return () => btn && btn.removeEventListener('click', onClick);
  }, []);

  const Variant = { A: window.VariantA, B: window.VariantB, C: window.VariantC }[ACTIVE];
  return <window.PhoneFrame><Variant /></window.PhoneFrame>;
}

ReactDOM.createRoot(document.getElementById('app')).render(<App />);
