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
import SkillNode, { SkillData } from "../components/SkillNode";

interface Connection {
  fromSkillId: string;
  fromPortId: string;
  toSkillId: string;
  toPortId: string;
  type: "execution" | "attribute";
}

interface Graph {
  nodes: SkillData[];
  edges: Connection[];
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
        // fallback default graph
        setGraph({
          nodes: [
            {
              id: "start",
              x: 200,
              y: 300,
              label: "Start",
              skillType: "start",
              inputs: [],
               outputs: [
                { id: "exec_out", label: "Exec", type: "EXEC", io: "output" },
              ],
            },
            {
              id: "end",
              x: 1000,
              y: 300,
              label: "End",
              skillType: "end",
              inputs: [
                { id: "exec_in", label: "Exec", type: "EXEC", io: "input" },
              ],
              outputs: [],
            },
          ],
          edges: [
            {
              fromSkillId: "start",
              fromPortId: "exec_out",
              toSkillId: "end",
              toPortId: "exec_in",
              type: "execution",
            },
          ],
        });
      }
    }
    load();
  }, []);

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

  const handlePortOffsetUpdate = (
    nodeId: string,
    portId: string,
    offset: { x: number; y: number }
  ) => {
    setGraph((prev) => ({
      ...prev,
      nodes: prev.nodes.map((n) =>
        n.id === nodeId
          ? {
              ...n,
              inputs: n.inputs.map((p) =>
                p.id === portId ? { ...p, offset } : p
              ),
              outputs: n.outputs.map((p) =>
                p.id === portId ? { ...p, offset } : p
              ),
            }
          : n
      ),
    }));
  };

  // ---------------- PORT POSITION ----------------
  function getPortWorldPosition(node: SkillData, portId: string) {
    const port =
      node.inputs.find((p) => p.id === portId) ||
      node.outputs.find((p) => p.id === portId);

    if (!port || !port.offset) return { x: node.x, y: node.y };

    return {
      x: node.x + port.offset.x,
      y: node.y + port.offset.y,
    };
  }

  // ---------------- DRAW CONNECTIONS ----------------
  const renderConnections = () =>
    graph.edges.map((edge, i) => {
      const fromNode = graph.nodes.find((n) => n.id === edge.fromSkillId);
      const toNode = graph.nodes.find((n) => n.id === edge.toSkillId);
      if (!fromNode || !toNode) return null;

      const from = getPortWorldPosition(fromNode, edge.fromPortId);
      const to = getPortWorldPosition(toNode, edge.toPortId);

      const color = edge.type === "execution" ? "#22c55e" : "#3b82f6";

      // Bézier curve
      const dx = to.x - from.x;
      const cx1 = from.x + dx / 2;
      const cy1 = from.y;
      const cx2 = to.x - dx / 2;
      const cy2 = to.y;

      return (
        <g key={i}>
          <path
            d={`M ${from.x} ${from.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${to.x} ${to.y}`}
            fill="none"
            stroke={color}
            strokeWidth="3"
          />
        </g>
      );
    });

  // ---------------- RENDER ----------------
  if (!graph) return <div className="text-white p-10">Loading…</div>;

  return (
    <div className="w-full h-screen bg-[#1a1a1a] text-white relative overflow-hidden select-none flex ">
      {/* Sidebar */}
      <div
        className={`absolute left-0 top-1/2 -translate-y-1/2 bg-gray-900 border-r border-gray-700 z-30 transition-all duration-300`}
        style={{
          width: sidebarOpen ? "250px" : "60px",
          height: "97vh",
          borderTopRightRadius: "20px",
          borderBottomRightRadius: "20px",
        }}
      >
        <div className="p-4 space-y-4 flex flex-col">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 bg-gray-800 rounded-lg border border-gray-600 flex items-center justify-center"
            style={{
              width: sidebarOpen ? "40px" : "30px",
              height: sidebarOpen ? "40px" : "30px",
            }}
          >
            {sidebarOpen ? <ChevronLeft /> : <ChevronRight />}
          </button>

          <div className="mt-6 space-y-3 flex-1 flex flex-col">
            <button
              onClick={() => window.history.back()}
              className="w-full flex items-center gap-3 px-2 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg justify-start"
            >
              <Home className="w-6 h-6" />
              {sidebarOpen && (
                <span className="text-sm whitespace-nowrap">Home</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="absolute top-2 right-2 z-20 flex items-center gap-2 bg-gray-800 rounded-lg p-1 border border-gray-600">
        <button
          onClick={() => setScale((s) => Math.max(0.2, s - 0.1))}
          className="p-2 hover:bg-gray-700 rounded"
        >
          <ZoomOut />
        </button>

        <span className="text-sm font-mono px-2">{Math.round(scale * 100)}%</span>

        <button
          onClick={() => setScale((s) => Math.min(2, s + 0.1))}
          className="p-2 hover:bg-gray-700 rounded"
        >
          <ZoomIn />
        </button>

        <button onClick={handleResetView} className="p-2 hover:bg-gray-700 rounded">
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
            <SkillNode
              key={node.id}
              data={node}
              selected={false}
              onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
              onPortOffsetUpdate={handlePortOffsetUpdate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
