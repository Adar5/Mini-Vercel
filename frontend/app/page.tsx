"use client";
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { ExternalLink } from "lucide-react";
import { io, Socket } from "socket.io-client";

// ------------------------------------------------------------------
// 🔧 CONFIGURATION: PASTE YOUR NGROK API (PORT 9000) URL HERE
// const API_BASE_URL = "http://18.212.91.242:9000";
const API_BASE_URL = "https://gitlift.in";
// ------------------------------------------------------------------

export default function Home() {
  const [repoUrl, setRepoUrl] = useState<string>("");
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "queued" | "building" | "deployed" | "failed">("idle");
  const [deployUrl, setDeployUrl] = useState<string>("");

  // Ref to keep track of the socket connection
  const socketRef = useRef<Socket | null>(null);

  // Add this ref at the top of your component
  const activeProjectRef = useRef<string | null>(null);

  useEffect(() => {
    socketRef.current = io(API_BASE_URL, {
        transportOptions: {
            polling: {
                extraHeaders: {
                    "ngrok-skip-browser-warning": "true",
                },
            },
        },
    });

    socketRef.current.on("connect", () => {
        console.log("Connected to Socket Server:", socketRef.current?.id);
        // 🔁 AUTO-REJOIN LOGIC
        // If we were listening to a project before we disconnected, 
        // tell the new socket connection to listen again.
        if (activeProjectRef.current) {
            console.log("Rejoining channel:", activeProjectRef.current);
            socketRef.current?.emit("subscribe", `logs:${activeProjectRef.current}`);
        }
    });

    socketRef.current.on("message", (message: string) => {
        if (!message) return;
        setLogs((prev) => [...prev, message]);

        if (message.includes("DEPLOYMENT SUCCESS") || message.includes("uploaded to S3")) {
            setStatus("deployed");
        }
    });

    return () => {
        socketRef.current?.disconnect();
    };
  }, []);

  const handleDeploy = async () => {
    if (!repoUrl) return;
    setStatus("queued");
    setLogs([]); 
    setLogs((prev) => [...prev, "Initiating deployment pipeline..."]);

    try {
      const { data } = await axios.post(`${API_BASE_URL}/project`, 
        { gitURL: repoUrl },
        { headers: { "ngrok-skip-browser-warning": "true" } }
      );

      const { projectSlug, url } = data.data;
      setDeployUrl(url);
      setLogs((prev) => [...prev, `Job Queued! Project ID: ${projectSlug}`]);

      // Save the ID so we can re-subscribe if connection drops
      activeProjectRef.current = projectSlug;

      if (socketRef.current) {
          socketRef.current.emit("subscribe", `logs:${projectSlug}`);
      }

    } catch (error) {
      console.error(error);
      setStatus("failed");
      setLogs((prev) => [...prev, "❌ Connection Failed: Check API URL!"]);
    }
  };

  // Inside handleDeploy function...

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-black text-white font-mono p-4">
      
      <div className="z-10 w-full max-w-xl border border-gray-800 bg-gray-900/50 backdrop-blur-md p-8 rounded-xl shadow-2xl relative overflow-hidden">
        
        <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
          Mini-Vercel
        </h1>
        <p className="text-gray-400 mb-8">Deploy your GitHub repo to the cloud.</p>

        <div className="space-y-4">
          <input
            type="text"
            placeholder="https://github.com/username/repo"
            className="w-full p-4 bg-black/50 border border-gray-700 rounded-lg focus:outline-none focus:border-blue-500 transition-colors text-white placeholder-gray-600"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            disabled={status !== "idle" && status !== "failed"}
          />
          
          <button 
            onClick={handleDeploy}
            disabled={(status !== "idle" && status !== "failed") || !repoUrl}
            className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-800 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-blue-500/20 flex items-center justify-center gap-2"
          >
            {status === "idle" || status === "failed" ? "Deploy Now 🚀" : "Deploying..."}
          </button>
        </div>

        {logs.length > 0 && (
            <div className="mt-8 p-4 bg-black border border-gray-800 rounded-lg font-mono text-sm h-64 overflow-y-auto scrollbar-hide">
                {logs.map((log, i) => {
                    if (!log) return null;
                    return (
                        <div key={i} className={`mb-1 pl-2 border-l-2 ${log.includes("SUCCESS") || log.includes("uploaded") ? "border-green-500 text-green-400" : "border-blue-900 text-gray-300"}`}>
                            <span className="opacity-50 mr-2">[{new Date().toLocaleTimeString()}]</span>
                            {log}
                        </div>
                    );
                })}
                
                {status === "deployed" && (
                    <div className="mt-4 p-4 bg-green-900/20 border border-green-500/30 rounded text-center">
                        <p className="text-green-400 mb-2">✨ Deployment Complete!</p>
                        <a 
                            href={deployUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-white bg-green-600 hover:bg-green-700 px-4 py-2 rounded-full font-bold transition-transform hover:scale-105"
                        >
                            Visit Website <ExternalLink size={16} />
                        </a>
                    </div>
                )}
            </div>
        )}
      </div>
    </main>
  );
}