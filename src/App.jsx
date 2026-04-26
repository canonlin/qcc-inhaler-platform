import { useState, useRef, useCallback } from "react";

// ── 資料定義 ──────────────────────────────────────────────
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbyGeyuic-HQOguRGayLtPnO2nqonulEVEsfP5wCj0XI2cIxV5h6ib9gfraIQMtLGxvUhw/exec";

const PHARMACISTS = ["黃永成", "林家薐", "林亭君", "黃詩婷", "劉士宏", "曾彥哲"];

const DRUG_LIST = {
  MDI: ["Symbicort Rapihaler", "Berotec N", "Duasma", "Flixotide", "Seretide 250 evohaler", "Bevespi", "Breztri", "Trimbow", "Striverdi", "Spiriva", "Spiolto"],
  DPI: ["Relvar (Ellipta)", "Anoro (Ellipta)", "Trelegy 92/55/22 (Ellipta)", "Trelegy 184/55/22 (Ellipta)", "Ultibro (Breezhaler)"],
  SMI: ["Spiriva Respimat", "Spiolto Respimat", "Striverdi Respimat"],
};

// MDI查檢表
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

// Respimat查檢表
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

// Ellipta查檢表
const ELLIPTA_STEPS = [
  { id: "e1", label: "開", desc: "推蓋至「喀」聲，檢查劑量窗", critical: false },
  { id: "e2", label: "吐", desc: "先吐氣至肺空（勿對裝置吐氣）", critical: true },
  { id: "e3", label: "含", desc: "吸嘴含入，雙唇緊閉", critical: true },
  { id: "e4", label: "吸", desc: "快速深吸（1-2秒肺滿，胸廓明顯擴張）", critical: true },
  { id: "e5", label: "閉", desc: "閉氣 3-5秒，緩吐氣", critical: true },
  { id: "e6", label: "關", desc: "關蓋，重置（勿重吸）", critical: false },
  { id: "e7", label: "漱", desc: "含ICS者漱口後吐掉", critical: false, icsOnly: true },
];

// Breezhaler查檢表
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

// 知識評估10題
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

// 滿意度問卷題目
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

// ── 元件：步驟指示器 ──────────────────────────────────────
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
            transition: "all 0.3s",
          }}>{i < current ? "✓" : i + 1}</div>
          {i < steps.length - 1 && <div style={{ width: 20, height: 2, background: i < current ? "#16a34a" : "#e2e8f0", margin: "0 2px" }} />}
        </div>
      ))}
      <span style={{ marginLeft: 8, fontSize: 13, color: "#64748b", fontWeight: 600 }}>{steps[current]}</span>
    </div>
  );
}

// ── 元件：評分按鈕組 ──────────────────────────────────────
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

// ── 元件：操作查檢頁面（獨立元件，避免父層重渲染） ────────────
function CheckPageView({ deviceType, drugName, hasICS, setHasICS, checks, setChecks, setNotes, calcScore, getSteps }) {
  const steps = getSteps();
  const { correct, total } = calcScore();
  const criticals = steps.filter(s => s.critical && checks[s.id] === "錯誤");

  // 用 useCallback 穩定 onValue/onNote，防止 CheckRow 重建
  const makeOnValue = useCallback((id) => (v) => {
    setChecks(p => ({ ...p, [id]: v }));
  }, [setChecks]);

  const makeOnNote = useCallback((id) => (v) => {
    setNotes(p => ({ ...p, [id]: v }));
  }, [setNotes]);

  return (
    <div>
      <div style={sectionTitle}>🔍 操作查檢表｜{deviceType} - {drugName}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16, background: "#f0fdf4", padding: "10px 16px", borderRadius: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>含ICS成分？</span>
        <BtnGroup options={["是", "否"]} value={hasICS ? "是" : "否"} onChange={v => setHasICS(v === "是")} color="#059669" />
      </div>
      {steps.map(s => (
        <CheckRow
          key={s.id}
          step={s}
          value={checks[s.id] || ""}
          hasICS={hasICS}
          onValue={makeOnValue(s.id)}
          onNote={makeOnNote(s.id)}
        />
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

// ── 元件：查檢步驟列 ──────────────────────────────────────
function CheckRow({ step, value, onValue, onNote, hasICS }) {
  const [localNote, setLocalNote] = useState("");
  const textareaRef = useRef(null);

  if (step.icsOnly && !hasICS) return null;
  const isCorrect = value === "正確";
  const isError = value === "錯誤";

  const handleValue = useCallback((v) => {
    onValue(v);
    if (v === "錯誤") {
      setTimeout(() => { if (textareaRef.current) textareaRef.current.focus(); }, 30);
    }
  }, [onValue]);

  const handleNote = (e) => {
    setLocalNote(e.target.value);
    onNote(e.target.value);
  };

  return (
    <div style={{
      border: `2px solid ${isError ? "#fca5a5" : isCorrect ? "#bbf7d0" : "#e2e8f0"}`,
      borderRadius: 12, padding: "12px 16px", marginBottom: 10,
      background: isError ? "#fff5f5" : isCorrect ? "#f0fdf4" : "#fff",
      transition: "background 0.2s, border-color 0.2s",
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
        <textarea
          ref={textareaRef}
          placeholder="請輸入錯誤原因（訪談/觀察記錄）..."
          value={localNote}
          onChange={handleNote}
          rows={2}
          style={{
            marginTop: 10, width: "100%", padding: "8px 12px",
            borderRadius: 8, border: "1.5px solid #fca5a5",
            fontSize: 14, boxSizing: "border-box",
            resize: "vertical", fontFamily: "inherit", lineHeight: 1.5,
          }}
        />
      )}
    </div>
  );
}

// ── 元件：Likert評分 ──────────────────────────────────────
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
            fontWeight: 700, fontSize: 13, cursor: "pointer", transition: "all 0.2s",
          }}>
            <div>{n}</div>
            <div style={{ fontSize: 10, fontWeight: 400 }}>{labels[n - 1]}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── CSV 匯出工具 ──────────────────────────────────────────
function toCSV(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(","), ...rows.map(r => headers.map(h => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(","))];
  return lines.join("\n");
}

function downloadCSV(data, filename) {
  const blob = new Blob(["\uFEFF" + toCSV(data)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ── 主應用 ────────────────────────────────────────────────
export default function App() {
  const [mode, setMode] = useState(null); // null | "pharmacist" | "patient"
  const [records, setRecords] = useState([]);
  const [satRecords, setSatRecords] = useState([]);

  if (mode === "pharmacist") return <PharmacistForm onDone={(r) => { setRecords(p => [...p, r]); setMode(null); }} onBack={() => setMode(null)} />;
  if (mode === "patient") return <PatientForm onDone={(r) => { setSatRecords(p => [...p, r]); setMode(null); }} onBack={() => setMode(null)} />;

  return <Dashboard onMode={setMode} records={records} satRecords={satRecords} />;
}

// ── 首頁儀表板 ────────────────────────────────────────────
function Dashboard({ onMode, records, satRecords }) {
  const totalCases = records.length;
  const avgError = totalCases ? (records.reduce((s, r) => s + (r.errorRate || 0), 0) / totalCases * 100).toFixed(1) : "--";
  const avgKnow = totalCases ? (records.reduce((s, r) => s + (r.knowledgeScore || 0), 0) / totalCases).toFixed(1) : "--";
  const avgSat = satRecords.length ? (satRecords.reduce((s, r) => s + (r.avgScore || 0), 0) / satRecords.length).toFixed(2) : "--";

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%)", fontFamily: "'Noto Sans TC', sans-serif", color: "#fff" }}>
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 16px" }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "#7dd3fc", fontWeight: 700, marginBottom: 8 }}>
            臺大醫院雲林分院 藥劑部 QCC
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: "0 0 6px", lineHeight: 1.3 }}>
            吸入劑收案平台
          </h1>
          <div style={{ fontSize: 13, color: "#94a3b8" }}>2026年 現況把握期｜4/20 – 5/31</div>
        </div>

        {/* 即時數據 */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 28 }}>
          {[
            { label: "收案數", value: totalCases, unit: "案", color: "#7dd3fc" },
            { label: "平均錯誤率", value: avgError, unit: "%", color: "#fca5a5" },
            { label: "知識平均分", value: avgKnow, unit: "/10", color: "#86efac" },
          ].map(d => (
            <div key={d.label} style={{ background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: "16px 12px", textAlign: "center", border: "1px solid rgba(255,255,255,0.1)" }}>
              <div style={{ fontSize: 26, fontWeight: 900, color: d.color }}>{d.value}<span style={{ fontSize: 13 }}>{d.unit}</span></div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{d.label}</div>
            </div>
          ))}
        </div>

        {/* 主操作按鈕 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 28 }}>
          <button onClick={() => onMode("pharmacist")} style={{
            padding: "20px 24px", borderRadius: 16, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg, #0ea5e9, #0284c7)",
            color: "#fff", textAlign: "left", fontSize: 17, fontWeight: 800,
            boxShadow: "0 8px 24px rgba(14,165,233,0.3)",
          }}>
            👨‍⚕️ 藥師收案
            <div style={{ fontSize: 12, fontWeight: 400, marginTop: 4, opacity: 0.85 }}>操作查檢 + 吸入劑知識評估</div>
          </button>
          <button onClick={() => onMode("patient")} style={{
            padding: "20px 24px", borderRadius: 16, border: "none", cursor: "pointer",
            background: "linear-gradient(135deg, #10b981, #059669)",
            color: "#fff", textAlign: "left", fontSize: 17, fontWeight: 800,
            boxShadow: "0 8px 24px rgba(16,185,129,0.3)",
          }}>
            🙋 病人填寫
            <div style={{ fontSize: 12, fontWeight: 400, marginTop: 4, opacity: 0.85 }}>衛教滿意度問卷（衛教後給病人填）</div>
          </button>
        </div>

        {/* 匯出區 */}
        <div style={{ background: "rgba(255,255,255,0.05)", borderRadius: 16, padding: 20, border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontWeight: 700, marginBottom: 12, fontSize: 15 }}>📊 資料匯出</div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button onClick={() => records.length && downloadCSV(records, "QCC藥師收案資料.csv")}
              disabled={!records.length}
              style={{ padding: "10px 18px", borderRadius: 10, border: "none", cursor: records.length ? "pointer" : "not-allowed", background: records.length ? "#0ea5e9" : "#334155", color: "#fff", fontWeight: 700, fontSize: 13 }}>
              ⬇ 藥師資料 CSV ({records.length}筆)
            </button>
            <button onClick={() => satRecords.length && downloadCSV(satRecords, "QCC滿意度資料.csv")}
              disabled={!satRecords.length}
              style={{ padding: "10px 18px", borderRadius: 10, border: "none", cursor: satRecords.length ? "pointer" : "not-allowed", background: satRecords.length ? "#10b981" : "#334155", color: "#fff", fontWeight: 700, fontSize: 13 }}>
              ⬇ 滿意度 CSV ({satRecords.length}筆)
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 8 }}>匯出後直接貼入 Google 試算表即可統計</div>
        </div>

        <div style={{ textAlign: "center", marginTop: 24, fontSize: 11, color: "#334155" }}>
          斗六院區 ／ 虎尾院區｜TQM 115年度品管圈競賽
        </div>
      </div>
    </div>
  );
}

// ── 藥師收案表單 ──────────────────────────────────────────
function PharmacistForm({ onDone, onBack }) {
  const WIZARD_STEPS = ["基本資料", "操作查檢", "知識評估", "完成"];
  const [step, setStep] = useState(0);

  // 基本資料
  const [basic, setBasic] = useState({
    date: new Date().toISOString().slice(0, 10),
    campus: "", pharmacist: "", patientType: "",
    ageGroup: "", gender: "", diagnosis: [],
    deviceType: "", drugName: "", usageDuration: "",
    priorEducation: "", educationTime: "",
  });

  // 查檢表
  const [hasICS, setHasICS] = useState(true);
  const [checks, setChecks] = useState({});
  const [notes, setNotes] = useState({});

  // 知識評估
  const [knowledge, setKnowledge] = useState({});

  const setB = (k, v) => setBasic(p => ({ ...p, [k]: v }));
  const toggleDx = (d) => setBasic(p => ({ ...p, diagnosis: p.diagnosis.includes(d) ? p.diagnosis.filter(x => x !== d) : [...p.diagnosis, d] }));

  const getSteps = () => {
    if (basic.deviceType === "MDI") return MDI_STEPS;
    if (basic.deviceType === "SMI") return RESPIMAT_STEPS;
    if (basic.deviceType === "DPI") {
      if (basic.drugName.includes("Breezhaler") || basic.drugName.includes("Ultibro")) return BREEZHALER_STEPS;
      return ELLIPTA_STEPS;
    }
    return ELLIPTA_STEPS;
  };

  const calcScore = () => {
    const steps = getSteps().filter(s => !s.icsOnly || hasICS);
    const correct = steps.filter(s => checks[s.id] === "正確").length;
    return { correct, total: steps.length, rate: steps.length ? correct / steps.length : 0 };
  };

  const calcKnowledge = () => {
    let score = 0;
    KNOWLEDGE_QS.forEach(q => {
      const ans = knowledge[q.id];
      if (!q.reverse && ans === "對") score++;
      if (q.reverse && ans === "不對") score++;
    });
    return score;
  };

  const handleSubmit = async () => {
    const { correct, total, rate } = calcScore();
    const kScore = calcKnowledge();
    const criticalErrors = getSteps().filter(s => s.critical && checks[s.id] === "錯誤");

    // 展開步驟結果
    const stepResults = {};
    getSteps().forEach(s => { stepResults[`步驟_${s.label}`] = checks[s.id] || "未填"; stepResults[`備註_${s.label}`] = notes[s.id] || ""; });

    // 展開知識結果
    const kResults = {};
    KNOWLEDGE_QS.forEach(q => { kResults[`知識Q${q.id.slice(1)}`] = knowledge[q.id] || "未答"; });

    const record = {
      收案日期: basic.date,
      院區: basic.campus,
      藥師: basic.pharmacist,
      病患類別: basic.patientType,
      年齡層: basic.ageGroup,
      性別: basic.gender,
      診斷: basic.diagnosis.join("/"),
      吸入劑型: basic.deviceType,
      藥品名稱: basic.drugName,
      使用多久: basic.usageDuration,
      曾接受衛教: basic.priorEducation,
      衛教時間_分鐘: basic.educationTime,
      含ICS: hasICS ? "是" : "否",
      操作正確數: correct,
      操作總步驟: total,
      操作正確率: (rate * 100).toFixed(1) + "%",
      errorRate: rate,
      重大錯誤數: criticalErrors.length,
      重大錯誤項目: criticalErrors.map(s => s.label).join("/"),
      知識總分: kScore,
      knowledgeScore: kScore,
      ...stepResults,
      ...kResults,
    };

    // 送出到 Google Sheets
    try {
      await fetch(GOOGLE_SHEET_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetType: "pharmacist", values: record }),
      });
    } catch(e) { console.warn("Google Sheets 儲存失敗，資料仍保留在本機", e); }

    onDone(record);
    setStep(3);
  };

  // ── 基本資料頁面
  const BasicPage = () => (
    <div>
      <div style={sectionTitle}>📋 基本資料</div>

      <Row label="收案日期">
        <input type="date" value={basic.date} onChange={e => setB("date", e.target.value)} style={inputStyle} />
      </Row>
      <Row label="院區">
        <BtnGroup options={["斗六", "虎尾"]} value={basic.campus} onChange={v => setB("campus", v)} color="#0ea5e9" />
      </Row>
      <Row label="藥師">
        <select value={basic.pharmacist} onChange={e => setB("pharmacist", e.target.value)} style={inputStyle}>
          <option value="">請選擇</option>
          {PHARMACISTS.map(p => <option key={p}>{p}</option>)}
        </select>
      </Row>
      <Row label="病患類別">
        <BtnGroup options={["初診衛教", "複診回測", "家屬/看護代領"]} value={basic.patientType} onChange={v => setB("patientType", v)} color="#7c3aed" />
      </Row>
      <Row label="年齡層">
        <BtnGroup options={["<18歲", "18-64歲", "≥65歲"]} value={basic.ageGroup} onChange={v => setB("ageGroup", v)} color="#0369a1" />
      </Row>
      <Row label="性別">
        <BtnGroup options={["男", "女"]} value={basic.gender} onChange={v => setB("gender", v)} color="#0369a1" />
      </Row>
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
      <Row label="吸入劑型">
        <BtnGroup options={["MDI", "DPI", "SMI"]} value={basic.deviceType} onChange={v => { setB("deviceType", v); setB("drugName", ""); }} color="#059669" />
      </Row>
      {basic.deviceType && (
        <Row label="藥品名稱">
          <select value={basic.drugName} onChange={e => setB("drugName", e.target.value)} style={inputStyle}>
            <option value="">請選擇</option>
            {DRUG_LIST[basic.deviceType]?.map(d => <option key={d}>{d}</option>)}
          </select>
        </Row>
      )}
      <Row label="使用多久">
        <BtnGroup options={["初次使用", "<1個月", "1-6個月", ">6個月"]} value={basic.usageDuration} onChange={v => setB("usageDuration", v)} color="#b45309" />
      </Row>
      <Row label="曾接受衛教">
        <BtnGroup options={["無", "有(院內)", "有(院外)"]} value={basic.priorEducation} onChange={v => setB("priorEducation", v)} color="#6d28d9" />
      </Row>
      <Row label="衛教時間（分鐘）">
        <input type="number" placeholder="填寫分鐘數" value={basic.educationTime} onChange={e => setB("educationTime", e.target.value)}
          style={{ ...inputStyle, width: 120 }} />
      </Row>
    </div>
  );

  // ── 操作查檢頁面
  // CheckPage 改為傳 props 呼叫外部元件，避免在內部定義造成重渲染

  // ── 知識評估頁面
  const KnowledgePage = () => {
    const score = calcKnowledge();
    const getLevel = (s) => s >= 9 ? { label: "知識優秀", color: "#16a34a" } : s >= 7 ? { label: "知識良好", color: "#0ea5e9" } : s >= 4 ? { label: "部分正確", color: "#f59e0b" } : { label: "知識不足", color: "#ef4444" };
    const lv = getLevel(score);
    return (
      <div>
        <div style={sectionTitle}>🧠 吸入劑知識評估（藥師口頭詢問，代為勾選）</div>
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
  };

  // ── 完成頁
  const DonePage = () => {
    const { correct, total } = calcScore();
    const kScore = calcKnowledge();
    return (
      <div style={{ textAlign: "center", padding: "32px 0" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <div style={{ fontSize: 22, fontWeight: 900, color: "#1e293b", marginBottom: 8 }}>收案完成！</div>
        <div style={{ fontSize: 14, color: "#64748b", marginBottom: 24 }}>{basic.date}｜{basic.campus}｜{basic.pharmacist}</div>
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
  };

  const canNext = () => {
    if (step === 0) return basic.campus && basic.pharmacist && basic.patientType && basic.ageGroup && basic.gender && basic.deviceType && basic.drugName && basic.usageDuration;
    if (step === 1) {
      const steps = getSteps().filter(s => !s.icsOnly || hasICS);
      return steps.every(s => checks[s.id]);
    }
    if (step === 2) return KNOWLEDGE_QS.every(q => knowledge[q.id]);
    return false;
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f1f5f9", fontFamily: "'Noto Sans TC', sans-serif" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "16px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <button onClick={onBack} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#64748b" }}>←</button>
          <div>
            <div style={{ fontWeight: 900, fontSize: 18, color: "#1e293b" }}>藥師收案表單</div>
            <div style={{ fontSize: 12, color: "#94a3b8" }}>QCC 吸入劑操作正確性評估</div>
          </div>
        </div>

        {step < 3 && <StepIndicator steps={WIZARD_STEPS} current={step} />}

        <div style={{ background: "#fff", borderRadius: 20, padding: "24px 20px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
          {step === 0 && <BasicPage />}
          {step === 1 && <CheckPageView
            deviceType={basic.deviceType}
            drugName={basic.drugName}
            hasICS={hasICS}
            setHasICS={setHasICS}
            checks={checks}
            setChecks={setChecks}
            setNotes={setNotes}
            calcScore={calcScore}
            getSteps={getSteps}
          />}
          {step === 2 && <KnowledgePage />}
          {step === 3 && <DonePage />}

          {step < 3 && (
            <div style={{ marginTop: 24, display: "flex", gap: 10 }}>
              {step > 0 && <button onClick={() => setStep(p => p - 1)} style={{ flex: 1, padding: "14px", borderRadius: 12, border: "2px solid #e2e8f0", background: "#fff", color: "#374151", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>← 上一步</button>}
              <button
                onClick={() => step === 2 ? handleSubmit() : setStep(p => p + 1)}
                disabled={!canNext()}
                style={{ flex: 2, padding: "14px", borderRadius: 12, border: "none", background: canNext() ? "#0ea5e9" : "#e2e8f0", color: canNext() ? "#fff" : "#94a3b8", fontWeight: 700, fontSize: 15, cursor: canNext() ? "pointer" : "not-allowed" }}>
                {step === 2 ? "✅ 送出收案" : "下一步 →"}
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

  const handleSubmit = async () => {
    const avg = allQs.reduce((s, q) => s + (scores[q.id] || 0), 0) / allQs.length;
    const record = {
      填寫日期: new Date().toISOString().slice(0, 10),
      評估階段: phase,
      身分別: identity,
      年齡層: ageGroup,
      ...Object.fromEntries(allQs.map((q, i) => [`Q${i + 1}_${q.text.slice(0, 10)}`, scores[q.id]])),
      平均分數: avg.toFixed(2),
      avgScore: avg,
      最有幫助: openGood,
      建議改進: openImprove,
    };

    // 送出到 Google Sheets
    try {
      await fetch(GOOGLE_SHEET_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetType: "satisfaction", values: record }),
      });
    } catch(e) { console.warn("Google Sheets 儲存失敗", e); }

    onDone(record);
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
          <Row label="評估階段">
            <BtnGroup options={["改善前", "改善後"]} value={phase} onChange={setPhase} color="#16a34a" />
          </Row>
          <Row label="您的身分">
            <BtnGroup options={["本人使用", "家屬/看護代學習"]} value={identity} onChange={setIdentity} color="#16a34a" />
          </Row>
          <Row label="年齡層">
            <BtnGroup options={["未滿18歲", "18-64歲", "65歲以上"]} value={ageGroup} onChange={setAgeGroup} color="#16a34a" />
          </Row>
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
          <textarea value={openGood} onChange={e => setOpenGood(e.target.value)} rows={2}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid #d1fae5", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
          <div style={{ marginTop: 10, marginBottom: 8, fontSize: 13, color: "#374151" }}>建議改進事項：</div>
          <textarea value={openImprove} onChange={e => setOpenImprove(e.target.value)} rows={2}
            style={{ width: "100%", padding: "8px 12px", borderRadius: 10, border: "1px solid #d1fae5", fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
        </div>

        <button onClick={handleSubmit} disabled={!canSubmit} style={{
          width: "100%", padding: "16px", borderRadius: 16, border: "none",
          background: canSubmit ? "#16a34a" : "#d1fae5",
          color: canSubmit ? "#fff" : "#86efac", fontWeight: 900, fontSize: 16,
          cursor: canSubmit ? "pointer" : "not-allowed", marginBottom: 24,
        }}>送出問卷 ✓</button>
      </div>
    </div>
  );
}

// ── 共用小元件 ────────────────────────────────────────────
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

const sectionTitle = { fontSize: 16, fontWeight: 900, color: "#1e293b", marginBottom: 18, paddingBottom: 10, borderBottom: "2px solid #e2e8f0" };
const inputStyle = { padding: "8px 12px", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 14, width: "100%", boxSizing: "border-box" };
