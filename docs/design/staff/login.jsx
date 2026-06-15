





















































































































































































    </div>
  );
}

function RolePortal({ onLogout }) {
  const [remember, setRemember] = React.useState(true);
  useLucide();
  const enter = (role) => {
    try {
      if (remember) localStorage.setItem("df_staff_last_role", role.key);
      else localStorage.removeItem("df_staff_last_role");
    } catch (e) {}
    window.location.href = role.href;
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", position: "relative", zIndex: 1 }}>
      {/* header */}
      <header style={{ display: "flex", alignItems: "center", gap: 12, padding: "20px 40px" }}>
        <SAvatar name="陳" size="md" color="var(--df-primary)" />
        <div style={{ lineHeight: 1.25 }}>
          <div style={{ fontSize: 11, fontWeight: 500, letterSpacing: .8, color: "var(--df-text-light)" }}>歡迎回來</div>
