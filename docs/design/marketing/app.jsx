/* Dream Fly — Marketing site app shell */
const { Toast: DFToast } = window.DreamFlyDesignSystem_9975ce;

function MarketingPage() {
  const [toast, setToast] = React.useState(false);
  React.useEffect(() => { window.lucide && window.lucide.createIcons(); });
  const onBook = () => { setToast(true); setTimeout(() => setToast(false), 2800); };
  return (
    <div style={{ background: "#fff" }}>
      <Header onNav={onBook} />
      <Hero onBook={onBook} />
      <ProofStrip />
      <WhyUs />
      <Categories onBook={onBook} />
      <Coaches />
      <Pricing onBook={onBook} />
      <Voices />
      <Faq />
      <CtaBanner onBook={onBook} />
      <Footer />
      {toast && (
        <div style={{ position: "fixed", right: 24, bottom: 24, zIndex: 200, animation: "df-toast-in .22s ease" }}>
          <DFToast tone="success" title="已收到預約" onClose={() => setToast(false)}>專員將於 1 個工作天內與您聯繫安排試上時段。</DFToast>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<MarketingPage />);
