



























  const setView = React.useCallback((v) => {
    setViewRaw(v); setSearch("");
    try { localStorage.setItem(VIEW_KEY, v); } catch (e) {}
    const sc = document.getElementById("coach-scroll");
    if (sc) sc.scrollTop = 0;
  }, []);

  const notify = React.useCallback((tone, title, body) => {
    const id = idRef.current++;
    setToasts((t) => [...t, { id, tone, title, body }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const dismiss = (id) => setToasts((t) => t.filter((x) => x.id !== id));

  useLucide();

  const content =
    view === "today" ? <TodayClasses notify={notify} setView={setView} />
    : view === "students" ? <Students notify={notify} search={search} />
    : view === "schedule" ? <Schedule notify={notify} />
    : view === "attendance" ? <Attendance notify={notify} />
    : view === "messages" ? <Messages notify={notify} search={search} />
    : view === "settings" ? <Settings notify={notify} />
    : <Dashboard notify={notify} setView={setView} />;

  const action = view === "schedule"
    ? <AppBtn variant="primary" size="sm" iconLeft={<Ic n="plus" s={15} />} onClick={() => notify("info", "新增課程", "建立新的課程時段（示範）。")}>新增課程</AppBtn>
    : null;

  const noPad = view === "messages";

  return (
