import React, { useState, useEffect, useRef } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const sampleQuestions = [
  "Show total revenue trends by month in the last year",
  "Compare revenue by country in the last quarter",
  "What is the monthly order count during last quarter?",
  "List the top 5 products by quantity sold in the last month",
  "Show average unit price over time in the last year",
  "Display repeat customer count in last 6 months",
  "How many unique customers placed orders last month? ",
  "How many orders were placed in the last 7 days?",
];

export default function ConversationalBI() {
 const apiUrl = import.meta.env.VITE_API_URL || "http://api:8000";
  console.log("API URL:", apiUrl);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
 const eventSourceRef = useRef(null);
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const renderMessageContent = (message) => {
    if (message.intent === "graph") {
      if (message.graphType === "bar" && message.data) {
        const cleanData = message.data.map((d) => ({
          name: typeof d.name === "string" ? d.name.slice(0, 7) : String(d.name),
          value: Number(d.value),
        }));
        return (
          <div style={{ width: "100%", height: 250 }}>
            <ResponsiveContainer>
              <BarChart data={cleanData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" fill="#0b69ff" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      }
      return <pre>No supported graph data</pre>;
    }
    return <pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{message.text}</pre>;
  };

 

 const callStreamingAPI = (question) => {
  setLoading(true);
  setMessages((prev) => [...prev, { sender: "user", text: question }]);

  if (eventSourceRef.current) {
    eventSourceRef.current.close();
  }

  // Note: Your backend expects POST with JSON body, but this uses GET.
  // If you keep POST, switch to fetch + streams or adjust backend to GET.
  // For demonstration, assuming GET URL with question param works.
  const url = `${apiUrl}/api/query?` + new URLSearchParams({ question });

  const evtSource = new EventSource(url);
  eventSourceRef.current = evtSource;

  let metadata = null;
  let plainTextMode = false;
  let hasTextMessageStarted = false;
  let showSQL = false; // toggle to show/hide SQL streaming words if you want

  evtSource.onmessage = (event) => {
    const line = event.data.trim();

    // Ignore empty messages
    if (!line) return;

    // Handle special prefixes like [INFO], [SQL], ERROR, or JSON metadata
    if (line.startsWith("ERROR::")) {
      setMessages((prev) => [...prev, { sender: "bot", text: `Error: ${line.slice(7)}` }]);
      evtSource.close();
      setLoading(false);
      return;
    }

    if (line.startsWith("[INFO]")) {
      // Optionally show info messages in UI or console
      console.log("INFO:", line.slice(6).trim());
      return;
    }

    if (line.startsWith("[SQL]")) {
      if (showSQL) {
        // Append SQL word by word
        if (!hasTextMessageStarted) {
          hasTextMessageStarted = true;
          setMessages((prev) => [...prev, { sender: "bot", text: "" }]);
        }
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            text: updated[updated.length - 1].text + (updated[updated.length - 1].text ? " " : "") + line.slice(5).trim(),
          };
          return updated;
        });
      }
      return; // skip if not showing SQL
    }

    // Try parse metadata JSON (first non-[INFO]/[SQL] message)
    if (!metadata && !plainTextMode) {
      try {
        metadata = JSON.parse(line);

        if (metadata.intent === "graph") {
          setMessages((prev) => [
            ...prev,
            {
              sender: "bot",
              intent: "graph",
              data: metadata.data,
              graphType: metadata.graphType,
            },
          ]);
          evtSource.close();
          setLoading(false);
          return;
        } else if (metadata.intent === "text") {
          hasTextMessageStarted = true;
          setMessages((prev) => [...prev, { sender: "bot", text: "" }]);
          return;
        }
      } catch {
        // Not JSON, treat as plain text
        plainTextMode = true;
        hasTextMessageStarted = true;
        setMessages((prev) => [...prev, { sender: "bot", text: line + "\n" }]);
        return;
      }
    }

    // Append streaming text word by word (for text intent)
    if ((metadata?.intent === "text" || plainTextMode) && hasTextMessageStarted) {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          text: updated[updated.length - 1].text + (updated[updated.length - 1].text ? " " : "") + line,
        };
        return updated;
      });
    }
  };

  evtSource.onerror = (err) => {
    console.error("SSE error:", err);
    eventSourceRef.current?.close();
    setLoading(false);
  };
};



  const handleSend = (question) => {
    if (!question.trim() || loading) return;
    setInput("");
    callStreamingAPI(question);
  };

  return (
    <div style={styles.page}>
      <header style={styles.header}>Conversational BI Tool</header>

      <section style={styles.sampleQuestions}>
        {sampleQuestions.map((q, i) => (
          <button
            key={i}
            style={styles.questionBox}
            onClick={() => handleSend(q)}
            disabled={loading}
          >
            {q}
          </button>
        ))}
      </section>

      <main style={styles.chatArea}>
        {messages.map((m, i) => (
          <div
            key={i}
            style={m.sender === "user" ? styles.userMessage : styles.botMessage}
          >
            {renderMessageContent(m)}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </main>

      <footer style={styles.footer}>
        <textarea
          rows={2}
          placeholder="Type your question here..."
          style={styles.textarea}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend(input);
            }
          }}
          disabled={loading}
        />
        <button
          style={styles.sendButton}
          onClick={() => handleSend(input)}
          disabled={loading || !input.trim()}
          aria-label="Send question"
        >
          Send
        </button>
      </footer>
    </div>
  );
}

const styles = {
  page: {
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    boxSizing: "border-box",
  },
  header: {
    padding: "16px 24px",
    fontSize: 24,
    fontWeight: "600",
    borderBottom: "1px solid #eee",
    backgroundColor: "#fafafa",
    userSelect: "none",
  },
  sampleQuestions: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    padding: 16,
    borderBottom: "1px solid #eee",
    backgroundColor: "#fff",
  },
  questionBox: {
    padding: "12px 16px",
    backgroundColor: "#f5f5f7",
    border: "1px solid #ccc",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 14,
    color: "#333",
    transition: "background-color 0.2s ease",
  },
  chatArea: {
    flexGrow: 1,
    overflowY: "auto",
    padding: 24,
    backgroundColor: "#fff",
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  userMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#0b69ff",
    color: "white",
    padding: "10px 16px",
    borderRadius: "18px 18px 0 18px",
    maxWidth: "70%",
    whiteSpace: "pre-wrap",
    fontSize: 15,
    width: "100%",
  },
  botMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#f1f1f1",
    color: "#333",
    padding: "10px 16px",
    borderRadius: "18px 18px 18px 0",
    maxWidth: "90%",
    width: "100%",
    whiteSpace: "pre-wrap",
    fontSize: 15,
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  footer: {
    borderTop: "1px solid #eee",
    padding: 16,
    display: "flex",
    gap: 12,
    backgroundColor: "#fafafa",
  },
  textarea: {
    flexGrow: 1,
    resize: "none",
    border: "1px solid #ccc",
    padding: 12,
    fontSize: 14,
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  sendButton: {
    backgroundColor: "#0b69ff",
    color: "white",
    border: "none",
    padding: "0 20px",
    cursor: "pointer",
    fontSize: 14,
    fontWeight: "600",
    userSelect: "none",
    transition: "background-color 0.3s ease",
    minWidth: 80,
  },
};
