/* App wiring: VariantA only + 노안 모드 */
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
    <window.PhoneFrame><window.VariantA /></window.PhoneFrame>
  );
}

ReactDOM.createRoot(document.getElementById('app')).render(<App />);
