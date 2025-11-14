import { useRef, useState, useEffect } from "react";
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Home,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";

interface Node {
  id: string;
  x: number;
  y: number;
  label: string;
  type: string;
}

interface Graph {
  nodes: Node[];
  edges: { from: string; to: string }[];
}

export default function SkillZone() {
  const location = useLocation();
  const bot = location.state;

  const bot_path = bot.path;

  const containerRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [graph, setGraph] = useState<Graph>({
    nodes: [],
    edges: [],
  });

  // -------- LOAD GRAPH ON STARTUP ----------
  useEffect(() => {
    async function load() {
      try {
        const json = await invoke("load_skill_graph", { botPath: bot.path });
        const parsed: Graph = JSON.parse(json as string);
        setGraph(parsed);
      } catch {
        // fallback if graph doesn't exist yet
        setGraph({
          nodes: [
            { id: "start", x: 200, y: 300, label: "Start", type: "start" },
            { id: "end", x: 600, y: 300, label: "End", type: "end" },
          ],
          edges: [{ from: "start", to: "end" }],
        });
      }
    }
    load();
  }, []);

  console.log("bot_path =", bot_path);
  // -------- SAVE GRAPH ON CHANGE ----------
  useEffect(() => {
    if (graph.nodes.length === 0) return;

    invoke("save_skill_graph", {
      botPath: bot.path,
      graphJson: JSON.stringify(graph, null, 2),
    });
  }, [graph]);

  const isPanning = useRef(false);
  const isDraggingNode = useRef(false);
  const draggedNodeId = useRef<string | null>(null);
  const lastPos = useRef({ x: 0, y: 0 });

  // ---------------- CANVAS MOUSE DOWN ----------------
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest(".node-item")) {
      isPanning.current = true;
      lastPos.current = { x: e.clientX, y: e.clientY };
    }
  };

  // ---------------- NODE MOUSE DOWN ----------------
  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    isDraggingNode.current = true;
    draggedNodeId.current = id;
    lastPos.current = { x: e.clientX, y: e.clientY };
  };

  // ---------------- MOVE HANDLER ----------------
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - lastPos.current.x;
      const dy = e.clientY - lastPos.current.y;

      setPos((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      lastPos.current = { x: e.clientX, y: e.clientY };
    }

    if (isDraggingNode.current && draggedNodeId.current) {
      const dx = (e.clientX - lastPos.current.x) / scale;
      const dy = (e.clientY - lastPos.current.y) / scale;

      lastPos.current = { x: e.clientX, y: e.clientY };

      setGraph((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === draggedNodeId.current
            ? { ...n, x: n.x + dx, y: n.y + dy }
            : n
        ),
      }));
    }
  };

  const handleMouseUp = () => {
    isPanning.current = false;
    isDraggingNode.current = false;
    draggedNodeId.current = null;
  };

  // ---------------- ZOOM ----------------
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();

    const zoom = 0.001;
    const newScale = Math.min(2, Math.max(0.2, scale - e.deltaY * zoom));

    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const worldX = (mx - pos.x) / scale;
      const worldY = (my - pos.y) / scale;

      setPos({
        x: mx - worldX * newScale,
        y: my - worldY * newScale,
      });
    }

    setScale(newScale);
  };

  const handleResetView = () => {
    setPos({ x: 0, y: 0 });
    setScale(1);
  };

  const getNodeColor = (type: string) => {
    switch (type) {
      case "start":
        return "bg-green-700 border-green-500";
      case "end":
        return "bg-red-700 border-red-500";
      default:
        return "bg-gray-700 border-gray-500";
    }
  };

  // ---------------- DRAW CONNECTIONS ----------------
  const renderConnections = () =>
    graph.edges.map((edge, i) => {
      const f = graph.nodes.find((n) => n.id === edge.from);
      const t = graph.nodes.find((n) => n.id === edge.to);

      if (!f || !t) return null;

      const path = `M ${f.x} ${f.y} L ${t.x} ${t.y}`;

      return (
        <g key={i}>
          <path
            d={path}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="3"
            strokeDasharray="5,5"
          >
            <animate
              attributeName="stroke-dashoffset"
              from="0"
              to="10"
              dur="0.5s"
              repeatCount="indefinite"
            />
          </path>
          <circle cx={t.x} cy={t.y} r="4" fill="#3b82f6" />
        </g>
      );
    });

  if (!graph) return <div className="text-white p-10">Loading…</div>;

  return (
    <div className="w-full h-screen bg-[#1a1a1a] text-white relative overflow-hidden select-none flex">
      {/* Sidebar */}
      <div
        className={`absolute left-0 top-0 h-full bg-gray-900 border-r border-gray-700 z-30 transition-transform ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ width: "250px" }}
      >
        <div className="p-6 space-y-4">
          <h2 className="text-xl font-bold">Navigation</h2>

          <button
            onClick={() => window.history.back()}
            className="w-full flex items-center gap-3 px-4 py-3 bg-gray-800 hover:bg-gray-700 rounded-lg"
          >
            <Home className="w-5 h-5" />
            <span>Back to Home</span>
          </button>
        </div>
      </div>

      {/* Sidebar toggle */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="absolute left-2 top-2 z-40 p-2 bg-gray-800 rounded-lg border border-gray-600"
      >
        {sidebarOpen ? <ChevronLeft /> : <ChevronRight />}
      </button>

      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-2 bg-gray-800 rounded-lg p-1 border border-gray-600">
        <button
          onClick={() => setScale((s) => Math.max(0.2, s - 0.1))}
          className="p-2 hover:bg-gray-700 rounded"
        >
          <ZoomOut />
        </button>

        <span className="text-sm font-mono px-2">
          {Math.round(scale * 100)}%
        </span>

        <button
          onClick={() => setScale((s) => Math.min(2, s + 0.1))}
          className="p-2 hover:bg-gray-700 rounded"
        >
          <ZoomIn />
        </button>

        <button
          onClick={handleResetView}
          className="p-2 hover:bg-gray-700 rounded"
        >
          <Maximize2 />
        </button>
      </div>

      {/* CANVAS */}
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden cursor-grab active:cursor-grabbing"
        onMouseDown={handleCanvasMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(circle, #444 1px, transparent 1px)",
            backgroundSize: "40px 40px",
            backgroundPosition: `${pos.x % 40}px ${pos.y % 40}px`,
          }}
        />

        {/* WORLD */}
        <div
          className="absolute top-0 left-0"
          style={{
            transform: `translate(${pos.x}px, ${pos.y}px) scale(${scale})`,
            transformOrigin: "0 0",
          }}
        >
          <svg
            width={50000}
            height={50000}
            className="absolute top-0 left-0 pointer-events-none"
          >
            {renderConnections()}
          </svg>

          {/* NODES */}
          {graph.nodes.map((node) => (
            <div
              key={node.id}
              className={`node-item absolute px-6 py-4 rounded-xl border-2 cursor-move shadow-xl ${getNodeColor(
                node.type
              )}`}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`,
                transform: "translate(-50%, -50%)",
              }}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
            >
              <h3 className="font-bold text-sm uppercase">{node.label}</h3>
              <p className="text-xs opacity-80">{node.type}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
