import { useState, useRef, useCallback, useEffect } from "react";

const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbyGeyuic-HQOguRGayLtPnO2nqonulEVEsfP5wCj0XI2cIxV5h6ib9gfraIQMtLGxvUhw/exec";

const PHARMACISTS = ["黃永成", "林家薐", "林亭君", "黃詩婷", "曾彥哲", "劉士宏"];

const DRUG_LIST = {
  MDI: ["Symbicort", "Berotec N", "Duasma", "Flixotide", "Seretide 250 evohaler", "Bevespi", "Breztri", "Trimbow"],
  DPI: ["Relvar (Ellipta)", "Anoro (Ellipta)", "Trelegy 92/55/22 (Ellipta)", "Trelegy 184/55/22 (Ellipta)", "Ultibro (Breezhaler)"],
  SMI: ["Spiriva Respimat", "Spiolto Respimat", "Striverdi Respimat"],
};

const NO_ICS_DRUGS = ["Anoro", "Ultibro", "Berotec N", "Bevespi", "Spiriva", "Spiolto", "Striverdi"];

const MDI_STEPS = [
  { id: "s1", label: "搖", desc: "瓶底向上，搖勻 4-5次 ≥5秒", critical: true },
  { id: "s2", label: "開", desc: "打開吸嘴蓋，檢查無異物", critical: false },
  { id: "s3", label: "吐", desc: "先吐氣至肺空", critical: true },
  { id: "s4", label: "含", desc: "吸嘴含入，雙唇緊閉包住", critical: true },
  { id: "s5", label: "壓", desc: "開始慢深吸，同時按壓藥瓶底（誤差≤1秒）", critical: true },
  { id: "s6", label: "吸", desc: "持續慢深吸 3-5秒", critical: true },
  { id: "s7", label: "閉", desc: "移開吸嘴，閉氣 5-10秒，緩吐氣", critical: true },
  { id: "s8", label: "漱", desc: "漱口（含類固醇），清潔乾燥", critical: false, icsOnly: true },
];

const RESPIMAT_STEPS = [
  { id: "r1", label: "轉", desc: "轉動裝置 180°＋聽到「卡」聲", critical: true },
  { id: "r2", label: "開", desc: "打開防塵蓋，直立持握", critical: false },
  { id: "r3", label: "吐", desc: "緩慢完全吐氣（對旁吐，勿對吸嘴）", critical: false },
  { id: "r4", label: "含", desc: "含住吸嘴並嘴唇密合", critical: true },
  { id: "r5", label: "壓吸", desc: "開始吸氣後1秒內按下釋放鈕（誤差≤1秒）", critical: true },
  { id: "r6", label: "吸", desc: "持續緩慢深吸至少 3-5秒", critical: true },
  { id: "r7", label: "閉", desc: "移開吸入器後閉氣 5-10秒", critical: true },
  { id: "r8", label: "吐", desc: "緩慢吐氣", critical: false },
];

const ELLIPTA_STEPS = [
  { id: "e1", label: "開", desc: "推蓋至「喀」聲，檢查劑量窗", critical: false },
  { id: "e2", label: "吐", desc: "先吐氣至肺空（勿對裝置吐氣）", critical: true },
  { id: "e3", label: "含", desc: "吸嘴含入，雙唇緊閉", critical: true },
  { id: "e4", label: "吸", desc: "快速深吸（1-2秒肺滿，胸廓明顯擴張）", critical: true },
  { id: "e5", label: "閉", desc: "閉氣 3-5秒，緩吐氣", critical: true },
  { id: "e6", label: "關", desc: "關蓋，重置（勿重吸）", critical: false },
  { id: "e7", label: "漱", desc: "含ICS者漱口後吐掉", critical: false, icsOnly: true },
];

const BREEZHALER_STEPS = [
  { id: "b1", label: "開", desc: "拔帽並打開口含器", critical: false },
  { id: "b2", label: "置", desc: "以乾燥手取出膠囊置入槽內（勿吞服）", critical: true },
  { id: "b3", label: "蓋", desc: "蓋上（聽「喀」聲）", critical: false },
  { id: "b4", label: "刺", desc: "直立持握，按兩側按鈕一次刺破膠囊", critical: true },
  { id: "b5", label: "吐", desc: "先吐氣至肺空（勿對吸嘴）", critical: true },
  { id: "b6", label: "含", desc: "吸嘴含入，雙唇緊閉", critical: true },
  { id: "b7", label: "吸", desc: "快速且深吸一次，可聽見膠囊震動聲", critical: true },
  { id: "b8", label: "閉", desc: "閉氣 5-10秒，緩吐氣", critical: true },
  { id: "b9", label: "查", desc: "打開檢查膠囊殘粉，若有粉末再吸一次", critical: true },
  { id: "b10", label: "收", desc: "倒空膠囊殼並關閉裝置", critical: false },
];

const KNOWLEDGE_QS = [
  { id: "k1", text: "使用吸入劑（不論噴霧式或乾粉式）之前，都要先把氣「慢慢吐乾淨」。", correct: "對", reverse: false },
  { id: "k2", text: "使用噴霧式吸入劑（MDI）時，要一邊「慢慢深吸氣」一邊按壓藥罐。", correct: "對", reverse: false },
  { id: "k3", text: "使用乾粉式吸入劑（DPI）時，吸氣方式和噴霧式一樣「慢慢吸」就好。", correct: "不對", reverse: true },
  { id: "k4", text: "吸完藥之後，需要閉氣大約數到5（約5–10秒），再慢慢吐氣。", correct: "對", reverse: false },
  { id: "k5", text: "使用含有「類固醇」成分的吸入劑之後，要記得漱口並將水吐掉。", correct: "對", reverse: false },
  { id: "k6", text: "如果醫師交代要連續吸兩口藥，可以連續按兩下後再一口氣吸進去。", correct: "不對", reverse: true },
  { id: "k7", text: "看不到「白煙」或聽不到「噴的聲音」，就一定代表沒有吸到藥。", correct: "不對", reverse: true },
  { id: "k8", text: "當吸入劑的劑量計數器顯示為0或出現紅色標示時，表示藥物已經用完。", correct: "對", reverse: false },
  { id: "k9", text: "「急救用的吸入劑」和「每天固定使用的控制型吸入劑」功能不同，不能互相替代。", correct: "對", reverse: false },
  { id: "k10", text: "如果最近幾天都不會喘，就可以自己先把每天固定用的吸入劑停掉。", correct: "不對", reverse: true },
];

const SATISFACTION_QS = [
  { id: "q1", text: "本次衛教內容清楚易懂" },
  { id: "q2", text: "我了解吸入劑正確使用步驟" },
  { id: "q3", text: "我對自行操作吸入劑更有信心" },
  { id: "q4", text: "本次衛教對我有幫助" },
  { id: "q5", text: "我整體滿意此次衛教服務" },
];

const SATISFACTION_AFTER_QS = [
  { id: "q6", text: "影片或互動教學有助於我理解操作方式" },
  { id: "q7", text: "智慧系統回饋有助於我修正錯誤動作" },
  { id: "q8", text: "我願意下次再次使用此衛教方式" },
];

// ── 工具 ──────────────────────────────────────────────────
function toCSV(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(","), ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))];
  return lines.join("\n");
}
function downloadCSV(data, filename) {
  const blob = new Blob(["\uFEFF" + toCSV(data)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── 共用元件 ──────────────────────────────────────────────
function Row({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "#374151", marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
}

function BtnGroup({ options, value, onChange, color }) {
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)} style={{
          padding: "7px 14px", borderRadius: 8, border: "2px solid",
          borderColor: value === opt ? color : "#e2e8f0",
          background: value === opt ? color : "#fff",
          color: value === opt ? "#fff" : "#374151",
          fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.15s",
        }}>{opt}</button>
      ))}
    </div>
  );
}

function ScoreBtn({ value, onChange, options, colorMap }) {
  return (
    <div style={{ display: "flex", gap: 6 }}>
      {options.map(opt => (
        <button key={opt} onClick={() => onChange(opt)} style={{
          padding: "6px 14px", borderRadius: 8, border: "2px solid",
          borderColor: value === opt ? colorMap[opt] : "#e2e8f0",
          background: value === opt ? colorMap[opt] : "#fff",
          color: value === opt ? "#fff" : "#374151",
          fontWeight: 700, fontSize: 14, cursor: "pointer", transition: "all 0.2s",
        }}>{opt}</button>
      ))}
    </div>
  );
}

function StepIndicator({ steps, current }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 24, flexWrap: "wrap", gap: 4 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center" }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700,
            background: i < current ? "#16a34a" : i === current ? "#0ea5e9" : "#e2e8f0",
            color: i <= current ? "#fff" : "#94a3b8",
          }}>{i < current ? "✓" : i + 1}</div>
          {i < steps.length - 1 && <div style={{ width: 20, height: 2, background: i < current ? "#16a34a" : "#e2e8f0", margin: "0 2px" }} />}
        </div>
      ))}
      <span style={{ marginLeft: 8, fontSize: 13, color: "#64748b", fontWeight: 600 }}>{steps[current]}</span>
    </div>
  );
}

function LikertRow({ q, value, onChange }) {
  const labels = ["非常不同意", "不同意", "普通", "同意", "非常同意"];
  return (
    <div style={{ marginBottom: 16, padding: "12px 16px", background: "#f8fafc", borderRadius: 12 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: "#1e293b", marginBottom: 10 }}>{q.text}</div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {[1, 2, 3, 4, 5].map(n => (
          <button key={n} onClick={() => onChange(n)} style={{
            padding: "6px 0", width: 60, borderRadius: 8, border: "2px solid",
            borderColor: value === n ? "#0ea5e9" : "#e2e8f0",
            background: value === n ? "#0ea5e9" : "#fff",
            color: value === n ? "#fff" : "#374151",
            fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}>
            <div>{n}</div>
            <div style={{ fontSize: 10, fontWeight: 400 }}>{labels[n - 1]}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── 衛教時間輸入（獨立元件） ──────────────────────────────
function TimeInput({ value, onChange }) {
  const [local, setLocal] = useState(value || "");
  const handleChange = (e) => { setLocal(e.target.value); onChange(e.target.value); };
  const handleMinus = () => { const v = String(Math.max(0, (parseInt(local) || 0) - 1)); setLocal(v); onChange(v); };
  const handlePlus = () => { const v = String((parseInt(local) || 0) + 1); setLocal(v); onChange(v); };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <button onClick={handleMinus} style={{ width: 36, height: 36, borderRadius: 8, border: "2px solid #e2e8f0", background: "#f8fafc", fontSize: 20, fontWeight: 700, cursor: "pointer" }}>−</button>
      <input type="number" min="0" max="120" placeholder="0" value={local} onChange={handleChange}
        style={{ width: 72, padding: "8px 10px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 16, fontWeight: 700, textAlign: "center", boxSizing: "border-box" }} />
      <span style={{ fontSize: 13, color: "#64748b" }}>分鐘</span>
      <button onClick={handlePlus} style={{ width: 36, height: 36, borderRadius: 8, border: "2px solid #e2e8f0", background: "#f8fafc", fontSize: 20, fontWeight: 700, cursor: "pointer" }}>＋</button>
    </div>
  );
}

// ── 查檢步驟列（獨立元件） ────────────────────────────────
function CheckRow({ step, value, onValue, onNote, hasICS }) {
  const [localNote, setLocalNote] = useState("");
  const textareaRef = useRef(null);
  const isCorrect = value === "正確";
  const isError = value === "錯誤";
  const hidden = !!(step.icsOnly && !hasICS);

  const handleValue = useCallback((v) => {
    onValue(v);
    if (v === "錯誤") setTimeout(() => { if (textareaRef.current) textareaRef.current.focus(); }, 30);
  }, [onValue]);

  const handleNote = (e) => { setLocalNote(e.target.value); onNote(e.target.value); };

  if (hidden) return null;

  return (
    <div style={{
      border: `2px solid ${isError ? "#fca5a5" : isCorrect ? "#bbf7d0" : "#e2e8f0"}`,
      borderRadius: 12, padding: "12px 16px", marginBottom: 10,
      background: isError ? "#fff5f5" : isCorrect ? "#f0fdf4" : "#fff",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
            {step.critical && <span style={{ background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 4 }}>★重大</span>}
            <span style={{ fontWeight: 700, color: "#1e293b", fontSize: 15 }}>【{step.label}】</span>
          </div>
          <div style={{ fontSize: 13, color: "#475569" }}>{step.desc}</div>
        </div>
        <ScoreBtn value={value} onChange={handleValue} options={["正確", "錯誤", "無法判定"]}
          colorMap={{ "正確": "#16a34a", "錯誤": "#ef4444", "無法判定": "#f59e0b" }} />
      </div>
      {isError && (
        <textarea ref={textareaRef} placeholder="請輸入錯誤原因（訪談/觀察記錄）..." value={localNote} onChange={handleNote} rows={2}
          style={{ marginTop: 10, width: "100%", padding: "8px 12px", borderRadius: 8, border: "1.5px solid #fca5a5", fontSize: 14, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }} />
      )}
    </div>
  );
}

// ── 操作查檢頁面（hasICS完全內部管理） ───────────────────
function CheckPageView({ deviceType, drugName, initialHasICS, checks, setChecks, setNotes, onHasICSChange, calcScore, getSteps }) {
  const [localHasICS, setLocalHasICS] = useState(!!initialHasICS);
  const handleICS = (v) => { setLocalHasICS(v); onHasICSChange(v); };

  const steps = getSteps();
  const filteredSteps = steps.filter(s => !s.icsOnly || localHasICS);
  const correct = filteredSteps.filter(s => checks[s.id] === "正確").length;
  const total = filteredSteps.length;
  const criticals = steps.filter(s => s.critical && checks[s.id] === "錯誤");

  const onValueMap = useRef({});
  const onNoteMap = useRef({});
  steps.forEach(s => {
    if (!onValueMap.current[s.id]) onValueMap.current[s.id] = (v) => setChecks(p => ({ ...p, [s.id]: v }));
    if (!onNoteMap.current[s.id]) onNoteMap.current[s.id] = (v) => setNotes(p => ({ ...p, [s.id]: v }));
  });

  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 900, color: "#1e293b", marginBottom: 18, paddingBottom: 10, borderBottom: "2px solid #e2e8f0" }}>
        🔍 操作查檢表｜{deviceType} - {drugName}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, background: "#f0fdf4", padding: "10px 16px", borderRadius: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>含ICS成分？</span>
        <BtnGroup options={["是", "否"]} value={localHasICS ? "是" : "否"} onChange={v => handleICS(v === "是")} color="#059669" />
      </div>
      {steps.map(s => (
        <CheckRow key={s.id} step={s} value={checks[s.id] || ""} hasICS={localHasICS}
          onValue={onValueMap.current[s.id]} onNote={onNoteMap.current[s.id]} />
      ))}
      <div style={{ marginTop: 16, padding: "14px 18px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>
          操作得分：<span style={{ color: "#0ea5e9" }}>{correct} / {total}</span>
          　正確率：<span style={{ color: total && correct / total >= 0.8 ? "#16a34a" : "#ef4444" }}>{total ? (correct / total * 100).toFixed(0) : 0}%</span>
        </div>
        {criticals.length > 0 && (
          <div style={{ marginTop: 8, color: "#ef4444", fontSize: 13, fontWeight: 600 }}>
            ⚠ 重大錯誤：{criticals.map(s => s.label).join("、")}
          </div>
        )}
      </div>
    </div>
  );
}

// ── 知識評估頁面（獨立元件） ──────────────────────────────
function KnowledgePageView({ knowledge, setKnowledge, calcKnowledge }) {
  const score = calcKnowledge();
  const getLevel = (s) => s >= 9 ? { label: "知識優秀", color: "#16a34a" } : s >= 7 ? { label: "知識良好", color: "#0ea5e9" } : s >= 4 ? { label: "部分正確", color: "#f59e0b" } : { label: "知識不足", color: "#ef4444" };
  const lv = getLevel(score);
  return (
    <div>
      <div style={{ fontSize: 16, fontWeight: 900, color: "#1e293b", marginBottom: 18, paddingBottom: 10, borderBottom: "2px solid #e2e8f0" }}>
        🧠 吸入劑知識評估（藥師口頭詢問，代為勾選）
      </div>
      <div style={{ color: "#64748b", fontSize: 13, marginBottom: 16 }}>請口頭逐題念出，病人回答「對」或「不對」</div>
      {KNOWLEDGE_QS.map((q, i) => (
        <div key={q.id} style={{ marginBottom: 12, padding: "12px 16px", background: "#f8fafc", borderRadius: 12, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
            <div style={{ flex: 1, fontSize: 14, color: "#1e293b", lineHeight: 1.5 }}>
              <span style={{ fontWeight: 700, color: "#0ea5e9" }}>Q{i + 1}.</span> {q.text}
              {q.reverse && <span style={{ marginLeft: 6, fontSize: 11, background: "#fef3c7", color: "#92400e", padding: "1px 6px", borderRadius: 4 }}>反向題</span>}
            </div>
            <ScoreBtn value={knowledge[q.id] || ""} onChange={v => setKnowledge(p => ({ ...p, [q.id]: v }))}
              options={["對", "不對"]} colorMap={{ "對": "#0ea5e9", "不對": "#ef4444" }} />
          </div>
        </div>
      ))}
      <div style={{ marginTop: 16, padding: "14px 18px", background: "#f0f9ff", borderRadius: 12, border: `2px solid ${lv.color}` }}>
        <div style={{ fontWeight: 700, fontSize: 17 }}>
          知識分數：<span style={{ color: lv.color }}>{score} / 10</span>
          　<span style={{ fontSize: 14, color: lv.color }}>【{lv.label}】</span>
        </div>
      </div>
    </div>
  );
}

// ── 完成頁（獨立元件） ────────────────────────────────────
function DonePageView({ correct, total, kScore, date, campus, pharmacist, onBack }) {
  return (
    <div style={{ textAlign: "center", padding: "32px 0" }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: "#1e293b", marginBottom: 8 }}>收案完成！</div>
      <div style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>{date}｜{campus}｜{pharmacist}</div>
      <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
        {[
          { label: "操作正確率", value: `${total ? (correct / total * 100).toFixed(0) : 0}%`, color: "#0ea5e9" },
          { label: "知識分數", value: `${kScore}/10`, color: "#10b981" },
        ].map(d => (
          <div key={d.label} style={{ padding: "16px 24px", background: "#f8fafc", borderRadius: 16, border: `2px solid ${d.color}` }}>
            <div style={{ fontSize: 24, fontWeight: 900, color: d.color }}>{d.value}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>{d.label}</div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 24, padding: 14, background: "#f0fdf4", borderRadius: 12, fontSize: 14, color: "#166534" }}>
        💡 請將此裝置交給病人填寫「滿意度問卷」（回首頁 → 病人填寫）
      </div>
      <button onClick={onBack} style={{ marginTop: 20, padding: "12px 32px", borderRadius: 12, border: "none", background: "#0ea5e9", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
        返回首頁
      </button>
    </div>
  );
}

// ── 藥師收案表單 ──────────────────────────────────────────
function PharmacistForm({ onDone, onBack }) {
  const WIZARD_STEPS = ["基本資料", "操作查檢", "知識評估", "完成"];
  const [step, setStep] = useState(0);
  const [basic, setBasic] = useState({
    date: new Date().toISOString().slice(0, 10),
    campus: "", pharmacist: "", patientType: "",
    ageGroup: "", gender: "", diagnosis: [],
    deviceType: "", drugName: "", usageDuration: "",
    priorEducation: "", educationTime: "",
  });
  const [hasICS, setHasICS] = useState(true);
  const [checks, setChecks] = useState({});
  const [notes, setNotes] = useState({});
  const [knowledge, setKnowledge] = useState({});
  const [doneData, setDoneData] = useState(null);

  const setB = (k, v) => setBasic(p => ({ ...p, [k]: v }));
  const toggleDx = (d) => setBasic(p => ({ ...p, diagnosis: p.diagnosis.includes(d) ? p.diagnosis.filter(x => x !== d) : [...p.diagnosis, d] }));

  useEffect(() => {
    if (basic.drugName) {
      const noICS = NO_ICS_DRUGS.some(d => basic.drugName.includes(d));
      setHasICS(!noICS);
    }
  }, [basic.drugName]);

  const getSteps = () => {
    if (basic.deviceType === "MDI") return MDI_STEPS;
    if (basic.deviceType === "SMI") return RESPIMAT_STEPS;
    if (basic.deviceType === "DPI") {
      if (basic.drugName.includes("Ultibro") || basic.drugName.includes("Breezhaler")) return BREEZHALER_STEPS;
      return ELLIPTA_STEPS;
    }
    return ELLIPTA_STEPS;
  };

  const calcKnowledge = () => {
    let score = 0;
    KNOWLEDGE_QS.forEach(q => {
      if (!q.reverse && knowledge[q.id] === "對") score++;
      if (q.reverse && knowledge[q.id] === "不對") score++;
    });
    return score;
  };

  const canNext = () => {
    if (step === 0) return basic.campus && basic.pharmacist && basic.patientType && basic.ageGroup && basic.gender && basic.deviceType && basic.drugName && basic.usageDuration && basic.timePoint;
    if (step === 1) {
      const steps = getSteps().filter(s => !s.icsOnly || hasICS);
      return steps.every(s => checks[s.id]);
    }
    if (step === 2) return KNOWLEDGE_QS.every(q => knowledge[q.id]);
    return false;
  };

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return; // 防止重複送出
    setSubmitting(true);
    const steps = getSteps().filter(s => !s.icsOnly || hasICS);
    const correct = steps.filter(s => checks[s.id] === "正確").length;
    const total = steps.length;
    const rate = total ? correct / total : 0;
    const kScore = calcKnowledge();
    const criticalErrors = getSteps().filter(s => s.critical && checks[s.id] === "錯誤");
    // 固定所有裝置的所有步驟欄位，確保 Excel 欄位一致
    const ALL_STEPS = [
      // MDI
      { id: "s1", label: "搖" }, { id: "s2", label: "開_MDI" }, { id: "s3", label: "吐_MDI" },
      { id: "s4", label: "含_MDI" }, { id: "s5", label: "壓" }, { id: "s6", label: "吸_MDI" },
      { id: "s7", label: "閉_MDI" }, { id: "s8", label: "漱_MDI" },
      // Respimat/SMI
      { id: "r1", label: "轉" }, { id: "r2", label: "開_SMI" }, { id: "r3", label: "吐_SMI" },
      { id: "r4", label: "含_SMI" }, { id: "r5", label: "壓吸" }, { id: "r6", label: "吸_SMI" },
      { id: "r7", label: "閉_SMI" }, { id: "r8", label: "吐2_SMI" },
      // Ellipta/DPI
      { id: "e1", label: "開_DPI" }, { id: "e2", label: "吐_DPI" }, { id: "e3", label: "含_DPI" },
      { id: "e4", label: "吸_DPI" }, { id: "e5", label: "閉_DPI" }, { id: "e6", label: "關" },
      { id: "e7", label: "漱_DPI" },
      // Breezhaler
      { id: "b1", label: "開_BRZ" }, { id: "b2", label: "置" }, { id: "b3", label: "蓋" },
      { id: "b4", label: "刺" }, { id: "b5", label: "吐_BRZ" }, { id: "b6", label: "含_BRZ" },
      { id: "b7", label: "吸_BRZ" }, { id: "b8", label: "閉_BRZ" }, { id: "b9", label: "查" },
      { id: "b10", label: "收" },
    ];
    const stepResults = {};
    ALL_STEPS.forEach(s => {
      stepResults[`步驟_${s.label}`] = checks[s.id] || "";
      stepResults[`備註_${s.label}`] = notes[s.id] || "";
    });
    const kResults = {};
    KNOWLEDGE_QS.forEach(q => { kResults[`知識Q${q.id.slice(1)}`] = knowledge[q.id] || "未答"; });

    const record = {
      病歷號碼: basic.patientId || "", 追蹤時間點: basic.timePoint || "M0（初評）", 收案日期: basic.date, 院區: basic.campus, 藥師: basic.pharmacist,
      病患類別: basic.patientType, 年齡層: basic.ageGroup, 性別: basic.gender,
      診斷: basic.diagnosis.join("/"), 吸入劑型: basic.deviceType, 藥品名稱: basic.drugName,
      使用多久: basic.usageDuration, 曾接受衛教: basic.priorEducation, 衛教時間_分鐘: basic.educationTime,
      含ICS: hasICS ? "是" : "否", 操作正確數: correct, 操作總步驟: total,
      操作正確率: (rate * 100).toFixed(1) + "%", errorRate: rate,
      重大錯誤數: criticalErrors.length, 重大錯誤項目: criticalErrors.map(s => s.label).join("/"),
      知識總分: kScore, knowledgeScore: kScore, ...stepResults, ...kResults,
    };

    try {
      await fetch(GOOGLE_SHEET_URL, {
        method: "POST", mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetType: "pharmacist", values: record }),
      });
    } catch(e) { console.warn("Google Sheets 儲存失敗", e); }

    setDoneData({ correct, total, kScore });
    onDone(record);
    setSubmitting(false);
    setStep(3);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Noto Sans TC', sans-serif" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}>←</button>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18, color: "#1e293b" }}>藥師收案表單</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>QCC 吸入劑操作正確性評估</div>
          </div>
        </div>

        {step < 3 && <StepIndicator steps={WIZARD_STEPS} current={step} />}

        <div style={{ background: "#fff", borderRadius: 20, padding: "24px 20px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          {step === 0 && (
            <div>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#1e293b", marginBottom: 18, paddingBottom: 10, borderBottom: "2px solid #e2e8f0" }}>📋 基本資料</div>
              <Row label="收案日期"><input type="date" value={basic.date} onChange={e => setB("date", e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, width: "100%", boxSizing: "border-box" }} /></Row>
              <Row label="病歷號碼（追蹤用）">
                <input type="text" placeholder="請輸入病歷號碼" value={basic.patientId || ""} onChange={e => setB("patientId", e.target.value.trim())}
                  style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, width: "100%", boxSizing: "border-box", fontFamily: "monospace", letterSpacing: 2 }} />
              </Row>
              <Row label="追蹤時間點">
                <BtnGroup options={["M0（初評）", "M1（1個月）", "M3（3個月）", "M6（6個月）"]} value={basic.timePoint || ""} onChange={v => setB("timePoint", v)} color="#7c3aed" />
              </Row>
              <Row label="院區"><BtnGroup options={["斗六", "虎尾"]} value={basic.campus} onChange={v => setB("campus", v)} color="#0ea5e9" /></Row>
              <Row label="藥師">
                <select value={basic.pharmacist} onChange={e => setB("pharmacist", e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, width: "100%", boxSizing: "border-box" }}>
                  <option value="">請選擇</option>
                  {PHARMACISTS.map(p => <option key={p}>{p}</option>)}
                </select>
              </Row>
              <Row label="病患類別"><BtnGroup options={["初診衛教", "複診回測", "家屬/看護代領"]} value={basic.patientType} onChange={v => setB("patientType", v)} color="#7c3aed" /></Row>
              <Row label="年齡層"><BtnGroup options={["<18歲", "18-64歲", "≥65歲"]} value={basic.ageGroup} onChange={v => setB("ageGroup", v)} color="#0369a1" /></Row>
              <Row label="性別"><BtnGroup options={["男", "女"]} value={basic.gender} onChange={v => setB("gender", v)} color="#0369a1" /></Row>
              <Row label="診斷（可複選）">
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {["氣喘", "COPD", "兩者皆有", "其他"].map(d => (
                    <button key={d} onClick={() => toggleDx(d)} style={{
                      padding: "7px 14px", borderRadius: 8, border: "2px solid",
                      borderColor: basic.diagnosis.includes(d) ? "#0ea5e9" : "#e2e8f0",
                      background: basic.diagnosis.includes(d) ? "#0ea5e9" : "#fff",
                      color: basic.diagnosis.includes(d) ? "#fff" : "#374151",
                      fontWeight: 700, fontSize: 13, cursor: "pointer",
                    }}>{d}</button>
                  ))}
                </div>
              </Row>
              <Row label="吸入劑型"><BtnGroup options={["MDI", "DPI", "SMI"]} value={basic.deviceType} onChange={v => { setB("deviceType", v); setB("drugName", ""); }} color="#059669" /></Row>
              {basic.deviceType && (
                <Row label="藥品名稱">
                  <select value={basic.drugName} onChange={e => setB("drugName", e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, width: "100%", boxSizing: "border-box" }}>
                    <option value="">請選擇</option>
                    {DRUG_LIST[basic.deviceType]?.map(d => <option key={d}>{d}</option>)}
                  </select>
                </Row>
              )}
              <Row label="使用多久"><BtnGroup options={["初次使用", "<1個月", "1-6個月", ">6個月"]} value={basic.usageDuration} onChange={v => setB("usageDuration", v)} color="#b45309" /></Row>
              <Row label="曾接受衛教"><BtnGroup options={["無", "有(院內)", "有(院外)"]} value={basic.priorEducation} onChange={v => setB("priorEducation", v)} color="#6d28d9" /></Row>
              <Row label="衛教時間（分鐘）"><TimeInput value={basic.educationTime} onChange={v => setB("educationTime", v)} /></Row>
            </div>
          )}

          {step === 1 && (
            <CheckPageView
              key={basic.drugName}
              deviceType={basic.deviceType}
              drugName={basic.drugName}
              initialHasICS={hasICS}
              onHasICSChange={setHasICS}
              checks={checks}
              setChecks={setChecks}
              setNotes={setNotes}
              calcScore={() => {}}
              getSteps={getSteps}
            />
          )}

          {step === 2 && (
            <KnowledgePageView knowledge={knowledge} setKnowledge={setKnowledge} calcKnowledge={calcKnowledge} />
          )}

          {step === 3 && doneData && (
            <DonePageView correct={doneData.correct} total={doneData.total} kScore={doneData.kScore}
              date={basic.date} campus={basic.campus} pharmacist={basic.pharmacist} onBack={onBack} />
          )}

          {step < 3 && (
            <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
              {step > 0 && <button onClick={() => setStep(p => p - 1)} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "2px solid #e2e8f0", background: "#fff", color: "#374151", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>← 上一步</button>}
              <button onClick={() => step === 2 ? handleSubmit() : setStep(p => p + 1)} disabled={!canNext() || submitting}
                style={{ flex: 2, padding: "14px", borderRadius: 12, border: "none", background: (canNext() && !submitting) ? "#0ea5e9" : "#e2e8f0", color: (canNext() && !submitting) ? "#fff" : "#94a3b8", fontWeight: 700, fontSize: 15, cursor: (canNext() && !submitting) ? "pointer" : "not-allowed" }}>
                {step === 2 ? (submitting ? "⏳ 送出中..." : "✅ 送出收案") : "下一步 →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── 病人滿意度問卷 ────────────────────────────────────────
function PatientForm({ onDone, onBack }) {
  const [phase, setPhase] = useState("改善前");
  const [ageGroup, setAgeGroup] = useState("");
  const [identity, setIdentity] = useState("");
  const [scores, setScores] = useState({});
  const [openGood, setOpenGood] = useState("");
  const [openImprove, setOpenImprove] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const allQs = phase === "改善後" ? [...SATISFACTION_QS, ...SATISFACTION_AFTER_QS] : SATISFACTION_QS;
  const canSubmit = identity && ageGroup && allQs.every(q => scores[q.id]);

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const avg = allQs.reduce((s, q) => s + (scores[q.id] || 0), 0) / allQs.length;
    const record = {
      填寫日期: new Date().toISOString().slice(0, 10), 評估階段: phase, 身分別: identity, 年齡層: ageGroup,
      ...Object.fromEntries(allQs.map((q, i) => [`Q${i + 1}_${q.text.slice(0, 10)}`, scores[q.id]])),
      平均分數: avg.toFixed(2), avgScore: avg, 最有幫助: openGood, 建議改進: openImprove,
    };
    try {
      await fetch(GOOGLE_SHEET_URL, {
        method: "POST", mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetType: "satisfaction", values: record }),
      });
    } catch(e) { console.warn("Google Sheets 儲存失敗", e); }
    onDone(record);
    setSubmitting(false);
    setSubmitted(true);
  };

  if (submitted) return (
    <div style={{ minHeight: "100vh", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Noto Sans TC', sans-serif" }}>
      <div style={{ textAlign: "center", padding: 32 }}>
        <div style={{ fontSize: 64 }}>🙏</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#166534", margin: "16px 0 8px" }}>謝謝您的填寫！</div>
        <div style={{ color: "#4d7c0f", fontSize: 14, marginBottom: 24 }}>您的意見將幫助我們提升衛教品質</div>
        <button onClick={onBack} style={{ padding: "12px 32px", borderRadius: 12, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>完成</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f0fdf4", fontFamily: "'Noto Sans TC', sans-serif" }}>
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px" }}>
        <div style={{ textAlign: "center", padding: "24px 0 20px", marginBottom: 8 }}>
          <div style={{ fontSize: 13, color: "#4d7c0f", fontWeight: 700, marginBottom: 6 }}>臺大醫院雲林分院 藥劑部</div>
          <div style={{ fontSize: 21, fontWeight: 900, color: "#166534" }}>吸入劑衛教滿意度問卷</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>您的回饋是我們進步的動力 🌿</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 20, padding: "20px 18px", marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: "#166534" }}>基本資料</div>
          <Row label="評估階段"><BtnGroup options={["改善前", "改善後"]} value={phase} onChange={setPhase} color="#16a34a" /></Row>
          <Row label="您的身分"><BtnGroup options={["本人使用", "家屬/看護代學習"]} value={identity} onChange={setIdentity} color="#16a34a" /></Row>
          <Row label="年齡層"><BtnGroup options={["未滿18歲", "18-64歲", "65歲以上"]} value={ageGroup} onChange={setAgeGroup} color="#16a34a" /></Row>
        </div>
        <div style={{ background: "#fff", borderRadius: 20, padding: "20px 18px", marginBottom: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4, color: "#166534" }}>滿意度評分</div>
          <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: 14 }}>1=非常不同意　5=非常同意</div>
          {SATISFACTION_QS.map(q => <LikertRow key={q.id} q={q} value={scores[q.id]} onChange={v => setScores(p => ({ ...p, [q.id]: v }))} />)}
          {phase === "改善後" && (
            <>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#0284c7", margin: "16px 0 8px" }}>智慧衛教補充題</div>
              {SATISFACTION_AFTER_QS.map(q => <LikertRow key={q.id} q={q} value={scores[q.id]} onChange={v => setScores(p => ({ ...p, [q.id]: v }))} />)}
            </>
          )}
        </div>
        <div style={{ background: "#fff", borderRadius: 20, padding: "20px 18px", marginBottom: 20, boxShadow: "0 2px 12px rgba(0,0,0,0.05)" }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: "#166534" }}>開放意見（可不填）</div>
          <div style={{ marginBottom: 8, fontSize: 13, color: "#374151" }}>您覺得最有幫助的地方：</div>
          <textarea value={openGood} onChange={e => setOpenGood(e.target.value)} rows={2} style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid #d1fae5", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
          <div style={{ marginTop: 10, marginBottom: 8, fontSize: 13, color: "#374151" }}>建議改進事項：</div>
          <textarea value={openImprove} onChange={e => setOpenImprove(e.target.value)} rows={2} style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid #d1fae5", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
        </div>
        <button onClick={handleSubmit} disabled={!canSubmit || submitting} style={{
          width: "100%", padding: "16px", borderRadius: 16, border: "none",
          background: (canSubmit && !submitting) ? "#16a34a" : "#d1fae5", color: (canSubmit && !submitting) ? "#fff" : "#86efac",
          fontWeight: 900, fontSize: 16, cursor: (canSubmit && !submitting) ? "pointer" : "not-allowed", marginBottom: 24,
        }}>{submitting ? "⏳ 送出中..." : "送出問卷 ✓"}</button>
      </div>
    </div>
  );
}

// ── 首頁儀表板 ────────────────────────────────────────────
function Dashboard({ onMode }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await fetch(GOOGLE_SHEET_URL + "?action=getStats");
      const data = await res.json();
      if (data.status === "ok") {
        setStats(data);
        setLastUpdate(new Date().toLocaleTimeString("zh-TW"));
      }
    } catch(e) { console.warn("載入失敗", e); }
    setLoading(false);
  };

  useEffect(() => { fetchStats(); }, []);

  const total = stats?.totalCases ?? "--";
  const errorRate = stats?.avgErrorRate != null ? (stats.avgErrorRate * 100).toFixed(1) : "--";
  const knowScore = stats?.avgKnowledge != null ? stats.avgKnowledge.toFixed(1) : "--";
  const satScore = stats?.avgSatisfaction != null ? stats.avgSatisfaction.toFixed(2) : "--";
  const criticalRate = stats?.criticalErrorRate != null ? (stats.criticalErrorRate * 100).toFixed(1) : "--";

  const pharmacistData = stats?.byPharmacist ?? [];
  const deviceData = stats?.byDevice ?? [];

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)", fontFamily: "'Noto Sans TC', sans-serif", color: "#fff" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "24px 16px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "#7dd3fc", fontWeight: 700, marginBottom: 6 }}>臺大醫院雲林分院 藥劑部 QCC</div>
          <h1 style={{ fontSize: 24, fontWeight: 900, margin: "0 0 4px" }}>吸入劑收案平台</h1>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>2026年現況把握期｜4/20 – 5/31</div>
          <div style={{ marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            {lastUpdate && <span style={{ fontSize: 11, color: "#64748b" }}>更新：{lastUpdate}</span>}
            <button onClick={fetchStats} style={{ padding: "4px 12px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "#94a3b8", fontSize: 11, cursor: "pointer" }}>
              {loading ? "載入中..." : "🔄 重新整理"}
            </button>
          </div>
        </div>

        {/* 主要指標 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
          {[
            { label: "總收案數", value: total, unit: "案", color: "#7dd3fc" },
            { label: "操作錯誤率", value: errorRate, unit: "%", color: "#fca5a5" },
            { label: "知識平均分", value: knowScore, unit: "/10", color: "#86efac" },
          ].map(d => (
            <div key={d.label} style={{ background: "rgba(255,255,255,0.07)", borderRadius: 14, padding: "14px 8px", textAlign: "center", border: "1px solid rgba(255,255,255,0.12)" }}>
              <div style={{ fontSize: 24, fontWeight: 900, color: d.color }}>{d.value}<span style={{ fontSize: 12 }}>{d.unit}</span></div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{d.label}</div>
            </div>
          ))}
        </div>

        {/* 次要指標 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {[
            { label: "重大錯誤率", value: criticalRate, unit: "%", color: "#fb923c", icon: "⚠️" },
            { label: "滿意度平均", value: satScore, unit: "/5", color: "#c084fc", icon: "⭐" },
          ].map(d => (
            <div key={d.label} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 14, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 28 }}>{d.icon}</div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 900, color: d.color }}>{d.value}<span style={{ fontSize: 12 }}>{d.unit}</span></div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{d.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 各藥師收案數 */}
        {pharmacistData.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 16, marginBottom: 16, border: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#7dd3fc" }}>👨‍⚕️ 各藥師收案</div>
            {pharmacistData.map(p => (
              <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ fontSize: 13, width: 60, color: "#e2e8f0", flexShrink: 0 }}>{p.name}</div>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.08)", borderRadius: 20, height: 8, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "#0ea5e9", borderRadius: 20, width: `${stats?.totalCases ? (p.count / stats.totalCases * 100) : 0}%`, transition: "width 0.5s" }} />
                </div>
                <div style={{ fontSize: 13, color: "#7dd3fc", fontWeight: 700, width: 30, textAlign: "right" }}>{p.count}</div>
              </div>
            ))}
          </div>
        )}

        {/* 各劑型分布 */}
        {deviceData.length > 0 && (
          <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 16, marginBottom: 20, border: "1px solid rgba(255,255,255,0.1)" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#86efac" }}>💊 吸入劑型分布</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {deviceData.map(d => (
                <div key={d.type} style={{ background: "rgba(255,255,255,0.08)", borderRadius: 10, padding: "8px 14px", textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: "#86efac" }}>{d.count}</div>
                  <div style={{ fontSize: 11, color: "#94a3b8" }}>{d.type}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 操作按鈕 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          <button onClick={() => onMode("pharmacist")} style={{ padding: "18px 24px", borderRadius: 16, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #0ea5e9, #0284c7)", color: "#fff", textAlign: "left", fontSize: 16, fontWeight: 800, boxShadow: "0 8px 24px rgba(14,165,233,0.3)" }}>
            👨‍⚕️ 藥師收案
            <div style={{ fontSize: 12, fontWeight: 400, marginTop: 4, opacity: 0.85 }}>操作查檢 + 吸入劑知識評估</div>
          </button>
          <button onClick={() => onMode("patient")} style={{ padding: "18px 24px", borderRadius: 16, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", textAlign: "left", fontSize: 16, fontWeight: 800, boxShadow: "0 8px 24px rgba(16,185,129,0.3)" }}>
            🙋 病人填寫
            <div style={{ fontSize: 12, fontWeight: 400, marginTop: 4, opacity: 0.85 }}>衛教滿意度問卷（衛教後給病人填）</div>
          </button>
          <button onClick={() => onMode("analytics")} style={{ padding: "18px 24px", borderRadius: 16, border: "none", cursor: "pointer", background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", textAlign: "left", fontSize: 16, fontWeight: 800, boxShadow: "0 8px 24px rgba(245,158,11,0.3)" }}>
            📊 數據分析儀表板
            <div style={{ fontSize: 12, fontWeight: 400, marginTop: 4, opacity: 0.85 }}>柏拉圖・錯誤分析・各藥師進度・知識題統計</div>
          </button>
        </div>

        <div style={{ textAlign: "center", fontSize: 11, color: "#334155" }}>斗六院區 ／ 虎尾院區｜TQM 115年度品管圈競賽</div>
      </div>
    </div>
  );
}

// ── 主應用 ────────────────────────────────────────────────

// ── 數據分析儀表板 ─────────────────────────────────────────
function AnalyticsDashboard({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [activeTab, setActiveTab] = useState(0);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(GOOGLE_SHEET_URL + "?action=getDetail");
      const json = await res.json();
      if (json.status === "ok") { setData(json); setLastUpdate(new Date().toLocaleTimeString("zh-TW")); }
    } catch(e) { console.warn("載入失敗", e); }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const bg = "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)";
  const card = { background: "rgba(255,255,255,0.06)", borderRadius: 16, padding: 16, border: "1px solid rgba(255,255,255,0.1)", marginBottom: 14 };

  const TABS = [
    { icon: "📊", label: "總覽" },
    { icon: "💊", label: "裝置分析" },
    { icon: "👥", label: "族群分析" },
    { icon: "🧠", label: "知識分析" },
    { icon: "📈", label: "追蹤分析" },
  ];

  const noData = (
    <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
      <div style={{ fontSize: 13 }}>尚無足夠資料</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: bg, fontFamily: "'Noto Sans TC', sans-serif", color: "#fff" }}>
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "20px 16px" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#94a3b8" }}>←</button>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18 }}>數據分析儀表板</div>
            <div style={{ fontSize: 12, color: "#64748b" }}>QCC 吸入劑｜{lastUpdate ? `更新：${lastUpdate}` : "載入中..."}</div>
          </div>
          <button onClick={fetchData} style={{ marginLeft: "auto", padding: "6px 14px", borderRadius: 20, border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.1)", color: "#94a3b8", fontSize: 12, cursor: "pointer" }}>
            {loading ? "⏳" : "🔄"}
          </button>
        </div>

        {/* Tab Bar */}
        <div style={{ display: "flex", gap: 6, marginBottom: 16, overflowX: "auto", paddingBottom: 4 }}>
          {TABS.map((t, i) => (
            <button key={i} onClick={() => setActiveTab(i)} style={{
              padding: "8px 14px", borderRadius: 20, border: "none", cursor: "pointer", whiteSpace: "nowrap",
              background: activeTab === i ? "#0ea5e9" : "rgba(255,255,255,0.08)",
              color: activeTab === i ? "#fff" : "#94a3b8",
              fontWeight: activeTab === i ? 700 : 400, fontSize: 13,
            }}>{t.icon} {t.label}</button>
          ))}
        </div>

        {loading && !data && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#64748b" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📡</div>
            <div>從 Google Sheets 載入資料中...</div>
          </div>
        )}

        {data && (
          <>
            {/* ── Tab 0: 總覽 ── */}
            {activeTab === 0 && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[
                    { label: "總收案數", value: data.totalCases, unit: "案", color: "#7dd3fc", icon: "📋" },
                    { label: "操作錯誤率", value: data.totalCases > 0 ? (data.avgErrorRate * 100).toFixed(1) : "--", unit: "%", color: "#fca5a5", icon: "❌" },
                    { label: "知識平均分", value: data.totalCases > 0 ? data.avgKnowledge?.toFixed(1) : "--", unit: "/10", color: "#86efac", icon: "🧠" },
                    { label: "滿意度平均", value: data.avgSatisfaction > 0 ? data.avgSatisfaction?.toFixed(2) : "--", unit: "/5", color: "#c084fc", icon: "⭐" },
                    { label: "重大錯誤率", value: data.totalCases > 0 ? (data.criticalErrorRate * 100).toFixed(1) : "--", unit: "%", color: "#fb923c", icon: "⚠️" },
                    { label: "收案藥師數", value: data.byPharmacist?.length || 0, unit: "位", color: "#67e8f9", icon: "👨‍⚕️" },
                  ].map(d => (
                    <div key={d.label} style={{ ...card, marginBottom: 0, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ fontSize: 28 }}>{d.icon}</div>
                      <div>
                        <div style={{ fontSize: 22, fontWeight: 900, color: d.color }}>{d.value}<span style={{ fontSize: 12 }}>{d.unit}</span></div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{d.label}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 各藥師收案 */}
                {data.byPharmacist?.length > 0 && (
                  <div style={card}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#7dd3fc" }}>👨‍⚕️ 各藥師收案進度</div>
                    {data.byPharmacist.map(p => (
                      <div key={p.name} style={{ marginBottom: 10 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{p.name}</span>
                          <span style={{ fontSize: 12, color: "#94a3b8" }}>{p.count}案　錯誤率 <span style={{ color: "#fca5a5", fontWeight: 700 }}>{(p.errorRate * 100).toFixed(1)}%</span></span>
                        </div>
                        <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 20, height: 8 }}>
                          <div style={{ height: "100%", borderRadius: 20, background: "linear-gradient(90deg,#0ea5e9,#7c3aed)", width: `${data.totalCases ? p.count/data.totalCases*100 : 0}%`, transition: "width 0.5s" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* 每日趨勢 */}
                {data.dailyTrend?.length > 0 && (
                  <div style={card}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#c084fc" }}>📅 每日收案趨勢</div>
                    <TrendChart data={data.dailyTrend} />
                  </div>
                )}
              </div>
            )}

            {/* ── Tab 1: 裝置分析 ── */}
            {activeTab === 1 && (
              <div>
                {data.totalCases === 0 ? noData : (
                  <>
                    {/* 各劑型收案數與錯誤率 */}
                    {data.byDevice?.length > 0 && (
                      <div style={card}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#86efac" }}>💊 各吸入劑型統計</div>
                        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
                          {data.byDevice.map(d => {
                            const pct = data.totalCases ? (d.count/data.totalCases*100).toFixed(1) : 0;
                            const colors = { MDI: "#0ea5e9", DPI: "#10b981", SMI: "#8b5cf6" };
                            const errRate = d.errorRate != null ? (d.errorRate*100).toFixed(1) : "--";
                            return (
                              <div key={d.type} style={{ flex: 1, minWidth: 80, background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "14px 10px", textAlign: "center", border: `2px solid ${colors[d.type]||"#475569"}40` }}>
                                <div style={{ fontSize: 22, fontWeight: 900, color: colors[d.type]||"#94a3b8" }}>{d.count}</div>
                                <div style={{ fontSize: 13, fontWeight: 700 }}>{d.type}</div>
                                <div style={{ fontSize: 11, color: "#64748b" }}>{pct}%</div>
                                <div style={{ fontSize: 11, color: "#fca5a5", marginTop: 4 }}>錯誤率 {errRate}%</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* MDI 柏拉圖 */}
                    {data.mdiStepErrors?.length > 0 && (
                      <div style={card}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "#0ea5e9" }}>📊 MDI 錯誤步驟柏拉圖</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>壓力定量吸入器（pMDI）｜{data.mdiCount}案</div>
                        <ParetoChart data={data.mdiStepErrors} />
                      </div>
                    )}

                    {/* DPI 柏拉圖 */}
                    {data.dpiStepErrors?.length > 0 && (
                      <div style={card}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "#10b981" }}>📊 DPI 錯誤步驟柏拉圖</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>乾粉吸入器（Ellipta/Breezhaler）｜{data.dpiCount}案</div>
                        <ParetoChart data={data.dpiStepErrors} />
                      </div>
                    )}

                    {/* SMI 柏拉圖 */}
                    {data.smiStepErrors?.length > 0 && (
                      <div style={card}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "#8b5cf6" }}>📊 SMI 錯誤步驟柏拉圖</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 12 }}>緩釋型氣霧吸入器（Respimat）｜{data.smiCount}案</div>
                        <ParetoChart data={data.smiStepErrors} />
                      </div>
                    )}

                    {(!data.mdiStepErrors?.length && !data.dpiStepErrors?.length && !data.smiStepErrors?.length) && noData}
                  </>
                )}
              </div>
            )}

            {/* ── Tab 2: 族群分析 ── */}
            {activeTab === 2 && (
              <div>
                {data.totalCases === 0 ? noData : (
                  <>
                    {/* 年齡層 */}
                    {data.byAge?.length > 0 && (
                      <div style={card}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#fbbf24" }}>👥 年齡層分析</div>
                        <GroupTable data={data.byAge} labelKey="age" />
                      </div>
                    )}

                    {/* 診斷別 */}
                    {data.byDiagnosis?.length > 0 && (
                      <div style={card}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#fb923c" }}>🫁 診斷別分析</div>
                        <GroupTable data={data.byDiagnosis} labelKey="diagnosis" />
                      </div>
                    )}

                    {/* 使用經驗 */}
                    {data.byExperience?.length > 0 && (
                      <div style={card}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#34d399" }}>⏱ 使用經驗分析</div>
                        <GroupTable data={data.byExperience} labelKey="experience" />
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>
                          💡 使用越久但錯誤率仍高 → 習慣性錯誤，需定期複評
                        </div>
                      </div>
                    )}

                    {/* 初診vs複診 */}
                    {data.byPatientType?.length > 0 && (
                      <div style={card}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#60a5fa" }}>🏥 初診vs複診分析</div>
                        <GroupTable data={data.byPatientType} labelKey="type" />
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Tab 3: 知識分析 ── */}
            {activeTab === 3 && (
              <div>
                {data.totalCases === 0 ? noData : (
                  <>
                    {/* 各題答錯率 */}
                    {data.knowledgeErrors?.length > 0 && (
                      <div style={card}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: "#86efac" }}>🧠 知識評估各題答錯率</div>
                        <div style={{ fontSize: 11, color: "#64748b", marginBottom: 14 }}>紅色＞50%、黃色30-50%、綠色＜30%</div>
                        {data.knowledgeErrors.map((q, i) => (
                          <div key={i} style={{ marginBottom: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                              <div style={{ fontSize: 12, color: "#e2e8f0", flex: 1, paddingRight: 8, lineHeight: 1.4 }}>
                                <span style={{ fontWeight: 700, color: "#0ea5e9" }}>Q{q.qNum}.</span> {q.text}
                                {q.reverse && <span style={{ marginLeft: 4, fontSize: 10, background: "#fef3c7", color: "#92400e", padding: "1px 4px", borderRadius: 4 }}>反向題</span>}
                              </div>
                              <div style={{ fontSize: 13, fontWeight: 700, flexShrink: 0, color: q.rate > 0.5 ? "#fca5a5" : q.rate > 0.3 ? "#fbbf24" : "#86efac" }}>
                                {(q.rate*100).toFixed(0)}%
                              </div>
                            </div>
                            <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 20, height: 6 }}>
                              <div style={{ height: "100%", borderRadius: 20, background: q.rate>0.5?"#ef4444":q.rate>0.3?"#f59e0b":"#22c55e", width: `${q.rate*100}%`, transition: "width 0.5s" }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* 知識分數 vs 操作正確率 */}
                    {data.knowledgeVsOperation && (
                      <div style={card}>
                        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#c084fc" }}>🔗 知識分數 vs 操作正確率</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                          {[
                            { label: "知識高分（≥7分）", data: data.knowledgeVsOperation.high, color: "#86efac" },
                            { label: "知識中分（4-6分）", data: data.knowledgeVsOperation.mid, color: "#fbbf24" },
                            { label: "知識低分（≤3分）", data: data.knowledgeVsOperation.low, color: "#fca5a5" },
                          ].map(g => (
                            <div key={g.label} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "12px 10px", textAlign: "center" }}>
                              <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 6, lineHeight: 1.3 }}>{g.label}</div>
                              <div style={{ fontSize: 10, color: "#64748b" }}>{g.data?.count || 0}案</div>
                              <div style={{ fontSize: 18, fontWeight: 900, color: g.color, margin: "4px 0" }}>
                                {g.data?.operationRate != null ? g.data.operationRate.toFixed(1) + "%" : "--"}
                              </div>
                              <div style={{ fontSize: 10, color: "#64748b" }}>操作正確率</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 10, lineHeight: 1.6 }}>
                          💡 若知識高但操作低 → 問題在動作協調，需加強示範練習<br/>
                          💡 若知識低但操作高 → 靠習慣操作，概念模糊，需加強衛教
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Tab 4: 追蹤分析 ── */}
            {activeTab === 4 && (
              <div>
                {/* M0/M1完成統計 */}
                <div style={card}>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#a78bfa" }}>📈 各時間點收案統計</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8 }}>
                    {[
                      { label: "M0初評", count: data.byTimePoint?.M0 || 0, color: "#94a3b8" },
                      { label: "M1一個月", count: data.byTimePoint?.M1 || 0, color: "#60a5fa" },
                      { label: "M3三個月", count: data.byTimePoint?.M3 || 0, color: "#34d399" },
                      { label: "M6六個月", count: data.byTimePoint?.M6 || 0, color: "#a78bfa" },
                    ].map(d => (
                      <div key={d.label} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: "12px 8px", textAlign: "center" }}>
                        <div style={{ fontSize: 24, fontWeight: 900, color: d.color }}>{d.count}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>{d.label}</div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* M0→M1 群體進步趨勢 */}
                {data.trackingProgress && data.trackingProgress.hasData ? (
                  <div style={card}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#34d399" }}>📊 M0→M1 群體進步趨勢</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                      {[
                        { label: "操作正確率", m0: data.trackingProgress.m0OperationRate, m1: data.trackingProgress.m1OperationRate, unit: "%", color: "#34d399" },
                        { label: "知識分數", m0: data.trackingProgress.m0Knowledge, m1: data.trackingProgress.m1Knowledge, unit: "/10", color: "#60a5fa" },
                      ].map(d => {
                        const diff = d.m1 != null && d.m0 != null ? d.m1 - d.m0 : null;
                        return (
                          <div key={d.label} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 14 }}>
                            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>{d.label}</div>
                            <div style={{ display: "flex", justifyContent: "space-around", alignItems: "center" }}>
                              <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 11, color: "#64748b" }}>M0</div>
                                <div style={{ fontSize: 20, fontWeight: 900, color: "#94a3b8" }}>{d.m0?.toFixed(1)}{d.unit}</div>
                              </div>
                              <div style={{ fontSize: 20 }}>→</div>
                              <div style={{ textAlign: "center" }}>
                                <div style={{ fontSize: 11, color: "#64748b" }}>M1</div>
                                <div style={{ fontSize: 20, fontWeight: 900, color: d.color }}>{d.m1?.toFixed(1)}{d.unit}</div>
                              </div>
                            </div>
                            {diff != null && (
                              <div style={{ textAlign: "center", marginTop: 8, fontSize: 13, fontWeight: 700, color: diff >= 0 ? "#86efac" : "#fca5a5" }}>
                                {diff >= 0 ? "▲" : "▼"} {Math.abs(diff).toFixed(1)}{d.unit} 改善
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div style={card}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8, color: "#34d399" }}>📊 M0→M1 群體進步趨勢</div>
                    <div style={{ textAlign: "center", padding: "24px 0", color: "#64748b" }}>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
                      <div style={{ fontSize: 13 }}>待M1追蹤資料收集後顯示</div>
                      <div style={{ fontSize: 11, marginTop: 4 }}>目前M0已收 {data.byTimePoint?.M0 || 0} 案</div>
                    </div>
                  </div>
                )}

                {/* 追蹤完成率 */}
                {(data.byTimePoint?.M0 || 0) > 0 && (
                  <div style={card}>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#fbbf24" }}>✅ 追蹤完成率</div>
                    {[
                      { label: "M1追蹤完成率", done: data.byTimePoint?.M1 || 0, total: data.byTimePoint?.M0 || 0 },
                      { label: "M3追蹤完成率", done: data.byTimePoint?.M3 || 0, total: data.byTimePoint?.M0 || 0 },
                      { label: "M6追蹤完成率", done: data.byTimePoint?.M6 || 0, total: data.byTimePoint?.M0 || 0 },
                    ].map(d => {
                      const pct = d.total > 0 ? (d.done/d.total*100).toFixed(0) : 0;
                      return (
                        <div key={d.label} style={{ marginBottom: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4, fontSize: 12 }}>
                            <span>{d.label}</span>
                            <span style={{ color: "#fbbf24", fontWeight: 700 }}>{d.done}/{d.total}（{pct}%）</span>
                          </div>
                          <div style={{ background: "rgba(255,255,255,0.08)", borderRadius: 20, height: 6 }}>
                            <div style={{ height: "100%", borderRadius: 20, background: "#f59e0b", width: `${pct}%`, transition: "width 0.5s" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}


// ── 族群分析表格元件 ─────────────────────────────────────
function GroupTable({ data, labelKey }) {
  if (!data || data.length === 0) return null;
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
            {[" ", "案數", "操作正確率", "知識平均分", "Critical Error率"].map(h => (
              <th key={h} style={{ padding: "6px 8px", color: "#64748b", fontWeight: 600, textAlign: h===" " ? "left" : "center" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => {
            const errColor = row.operationRate >= 80 ? "#86efac" : row.operationRate >= 60 ? "#fbbf24" : "#fca5a5";
            return (
              <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <td style={{ padding: "8px 8px", fontWeight: 600, color: "#e2e8f0" }}>{row[labelKey]}</td>
                <td style={{ padding: "8px 8px", textAlign: "center", color: "#94a3b8" }}>{row.count}</td>
                <td style={{ padding: "8px 8px", textAlign: "center", fontWeight: 700, color: errColor }}>{row.operationRate?.toFixed(1)}%</td>
                <td style={{ padding: "8px 8px", textAlign: "center", color: "#60a5fa" }}>{row.knowledgeScore?.toFixed(1)}/10</td>
                <td style={{ padding: "8px 8px", textAlign: "center", color: "#fb923c" }}>{row.criticalRate != null ? (row.criticalRate*100).toFixed(0)+"%" : "--"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── 柏拉圖元件 ────────────────────────────────────────────
function ParetoChart({ data, total }) {
  const maxVal = data[0]?.count || 1;
  let cumulative = 0;
  const cumData = data.map(d => { cumulative += d.count; return { ...d, cum: cumulative }; });
  const grandTotal = cumulative;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 160, paddingBottom: 24, position: "relative" }}>
        {/* 累積線 */}
        <svg style={{ position: "absolute", top: 0, left: 0, width: "100%", height: 136, overflow: "visible" }}>
          <polyline
            points={cumData.map((d, i) => {
              const x = (i + 0.5) / cumData.length * 100;
              const y = (1 - d.cum / grandTotal) * 100;
              return `${x}%,${y}%`;
            }).join(" ")}
            fill="none" stroke="#f59e0b" strokeWidth="2.5" strokeLinecap="round"
          />
          {/* 80% 基準線 */}
          <line x1="0" y1="20%" x2="100%" y2="20%" stroke="rgba(245,158,11,0.4)" strokeWidth="1" strokeDasharray="4,4" />
          <text x="101%" y="20%" fill="#f59e0b" fontSize="9" dominantBaseline="middle">80%</text>
          {cumData.map((d, i) => {
            const x = (i + 0.5) / cumData.length * 100;
            const y = (1 - d.cum / grandTotal) * 100;
            return <circle key={i} cx={`${x}%`} cy={`${y}%`} r="3" fill="#f59e0b" />;
          })}
        </svg>
        {/* 柱狀圖 */}
        {data.map((d, i) => {
          const cum = cumData[i].cum / grandTotal;
          const isKey = cum <= 0.8 || (i > 0 && cumData[i-1].cum / grandTotal < 0.8);
          return (
            <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>{d.count}</div>
              <div style={{
                width: "80%", background: isKey ? "#ef4444" : "#475569",
                borderRadius: "4px 4px 0 0",
                height: `${(d.count / maxVal) * 110}px`,
                minHeight: d.count > 0 ? 4 : 0,
                transition: "height 0.5s",
              }} />
              <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 4, textAlign: "center", lineHeight: 1.2 }}>{d.step}</div>
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, fontSize: 11, color: "#64748b", marginTop: 4 }}>
        <div><span style={{ color: "#ef4444" }}>■</span> 改善重點（前80%）</div>
        <div><span style={{ color: "#f59e0b" }}>—</span> 累積百分比</div>
      </div>
    </div>
  );
}

// ── 趨勢圖元件 ────────────────────────────────────────────
function TrendChart({ data }) {
  const maxVal = Math.max(...data.map(d => d.count), 1);
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
      {data.map((d, i) => (
        <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ fontSize: 10, color: "#c084fc", marginBottom: 2 }}>{d.count}</div>
          <div style={{ width: "70%", background: "linear-gradient(180deg, #8b5cf6, #c084fc)", borderRadius: "4px 4px 0 0", height: `${(d.count / maxVal) * 70}px`, minHeight: d.count > 0 ? 4 : 0 }} />
          <div style={{ fontSize: 9, color: "#64748b", marginTop: 4, textAlign: "center" }}>{d.date?.slice(5)}</div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const [mode, setMode] = useState(null);
  const [records, setRecords] = useState([]);
  const [satRecords, setSatRecords] = useState([]);

  if (mode === "pharmacist") return <PharmacistForm onDone={(r) => { setRecords(p => [...p, r]); setMode(null); }} onBack={() => setMode(null)} />;
  if (mode === "patient") return <PatientForm onDone={(r) => { setSatRecords(p => [...p, r]); setMode(null); }} onBack={() => setMode(null)} />;
  if (mode === "analytics") return <AnalyticsDashboard onBack={() => setMode(null)} />;
  return <Dashboard onMode={setMode} />;
}
