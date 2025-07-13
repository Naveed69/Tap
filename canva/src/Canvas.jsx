import React, { useRef, useEffect, useState } from "react";

const Canvas = () => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#000000");
  const [brushSize, setBrushSize] = useState(3);
  const [connectionStatus, setConnectionStatus] = useState({
    effectiveType: "Good",
    saveData: false,
    downlink: 5,
    rtt: 50,
  });
  const pendingTasks = useRef([]);
  const taskHandle = useRef(null);

  // Initialize all APIs
  useEffect(() => {
    const canvas = canvasRef.current;

    // 1. Canvas Setup
    const resizeCanvas = () => {
      const { width, height } = canvas.getBoundingClientRect();
      canvas.width = width;
      canvas.height = height;
    };

    // 2. Network Information API Setup
    const updateNetworkStatus = () => {
      if (navigator.connection) {
        const conn = navigator.connection;
        setConnectionStatus({
          effectiveType: conn.effectiveType || "4g",
          saveData: conn.saveData || false,
          downlink: conn.downlink || 10,
          rtt: conn.rtt || 50,
        });
      }
    };

    resizeCanvas();
    updateNetworkStatus();

    window.addEventListener("resize", resizeCanvas);
    if (navigator.connection) {
      navigator.connection.addEventListener("change", updateNetworkStatus);
    }

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      if (navigator.connection) {
        navigator.connection.removeEventListener("change", updateNetworkStatus);
      }
      if (taskHandle.current) {
        cancelIdleCallback(taskHandle.current);
      }
    };
  }, []);

  // 3. Background Tasks API Implementation
  const processPendingTasks = (deadline) => {
    const timeBudget = connectionStatus.effectiveType.includes("2g") ? 10 : 30;

    while (
      (deadline.timeRemaining() > timeBudget || deadline.didTimeout) &&
      pendingTasks.current.length > 0
    ) {
      const task = pendingTasks.current.shift();
      task();
    }

    if (pendingTasks.current.length > 0) {
      taskHandle.current = requestIdleCallback(processPendingTasks, {
        timeout: 1000,
      });
    } else {
      taskHandle.current = null;
    }
  };

  const scheduleTask = (task, isCritical = false) => {
    if (isCritical || connectionStatus.effectiveType.includes("4g")) {
      // Execute immediately on good connections or for critical tasks
      task();
    } else {
      // Queue for idle processing
      pendingTasks.current.push(task);
      if (!taskHandle.current) {
        taskHandle.current = requestIdleCallback(processPendingTasks, {
          timeout: 1000,
        });
      }
    }
  };

  // Drawing operations
  const startDrawing = (e) => {
    scheduleTask(() => {
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      context.beginPath();
      context.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      context.strokeStyle = color;
      context.lineWidth = getOptimizedBrushSize();
      context.lineCap = "round";
      context.lineJoin = "round";
      setIsDrawing(true);
    }, true);
  };

  const draw = (e) => {
    if (!isDrawing) return;

    scheduleTask(() => {
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");

      // Skip some points on slow networks
      if (shouldSkipPoint()) return;

      context.lineTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
      context.stroke();
    });
  };

  const stopDrawing = () => {
    scheduleTask(() => {
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      context.closePath();
      setIsDrawing(false);
    }, true);
  };

  const clearCanvas = () => {
    scheduleTask(() => {
      const canvas = canvasRef.current;
      const context = canvas.getContext("2d");
      context.clearRect(0, 0, canvas.width, canvas.height);
    }, true);
  };

  // Network-aware optimization helpers
  const getOptimizedBrushSize = () => {
    if (connectionStatus.effectiveType.includes("2g")) {
      return Math.max(brushSize, 3);
    }
    return brushSize;
  };

  const shouldSkipPoint = () => {
    if (connectionStatus.effectiveType.includes("2g")) {
      return Math.random() > 0.7;
    }
    if (connectionStatus.effectiveType.includes("3g")) {
      return Math.random() > 0.9;
    }
    return false;
  };

  const getQualityLevel = () => {
    if (connectionStatus.effectiveType.includes("2g")) return "Low (2G)";
    if (connectionStatus.effectiveType.includes("3g")) return "Medium (3G)";
    if (connectionStatus.effectiveType.includes("4g")) return "High (4G+)";
    return "Unknown";
  };

  return (
    <div className="canvas-container">
      <div className="controls">
        <div>
          <label>Color: </label>
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
          />
        </div>
        <div>
          <label>Brush Size: </label>
          <input
            type="range"
            min="1"
            max="50"
            value={brushSize}
            onChange={(e) => setBrushSize(e.target.value)}
          />
          <span>{brushSize}px</span>
        </div>
        <button onClick={clearCanvas}>Clear Canvas</button>
      </div>

      <div className="network-status">
        <strong>Network:</strong> {connectionStatus.effectiveType.toUpperCase()}{" "}
        |<strong>Quality:</strong> {getQualityLevel()} |<strong>Speed:</strong>{" "}
        ~{connectionStatus.downlink.toFixed(1)} Mbps |<strong>Mode:</strong>{" "}
        {taskHandle.current ? "Optimized" : "Real-time"}
      </div>

      <canvas
        ref={canvasRef}
        onMouseDown={startDrawing}
        onMouseMove={draw}
        onMouseUp={stopDrawing}
        onMouseLeave={stopDrawing}
      />
    </div>
  );
};

export default Canvas;
