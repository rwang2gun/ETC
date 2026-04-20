/* App wiring: 3 variants in gallery + 노안 모드 tweak */
const { useState: useStateApp, useEffect: useEffectApp } = React;

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

  return (
    <React.Fragment>
      <div className="variant-col">
        <div className="variant-label">
          <span className="badge">A</span>
          <h2>따뜻한 자연주의</h2>
          <small>· 크림 + 오렌지</small>
        </div>
        <window.PhoneFrame><window.VariantA /></window.PhoneFrame>
      </div>
      <div className="variant-col">
        <div className="variant-label">
          <span className="badge">B</span>
          <h2>미니멀 프리미엄</h2>
          <small>· 블랙/화이트 + 오렌지 포인트</small>
        </div>
        <window.PhoneFrame><window.VariantB /></window.PhoneFrame>
      </div>
      <div className="variant-col">
        <div className="variant-label">
          <span className="badge">C</span>
          <h2>농장 편지</h2>
          <small>· Serif + 손글씨</small>
        </div>
        <window.PhoneFrame><window.VariantC /></window.PhoneFrame>
      </div>
    </React.Fragment>
  );
}

ReactDOM.createRoot(document.getElementById('gallery')).render(<App />);
