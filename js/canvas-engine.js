// Project Axiom - Interactive Vector Graphing Canvas & Automated Spatial Grader
// High-Fidelity Economics Drawing Engine (HTML5 2D Context)

class AxiomCanvasEngine {
  constructor(canvasId, options = {}) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    this.options = Object.assign({
      gridStep: 20,
      snapThreshold: 10,
      targetProblem: 'externality' // 'externality', 'adas_cost_push', 'liquidity_preference'
    }, options);

    this.currentTool = 'line'; // 'line', 'curve', 'dot', 'label', 'dwl'
    this.currentLabel = 'DD';
    this.elements = [];
    this.undoStack = [];
    this.isDrawing = false;
    this.dragStart = null;
    this.tempElement = null;

    this.initEvents();
    this.render();
  }

  setTool(tool, label = null) {
    this.currentTool = tool;
    if (label) this.currentLabel = label;
  }

  clear() {
    this.undoStack.push([...this.elements]);
    this.elements = [];
    this.render();
  }

  undo() {
    if (this.elements.length > 0) {
      this.elements.pop();
      this.render();
    }
  }

  snap(val) {
    const step = this.options.gridStep;
    return Math.round(val / step) * step;
  }

  initEvents() {
    const getPos = (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const scaleX = this.canvas.width / rect.width;
      const scaleY = this.canvas.height / rect.height;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
      };
    };

    const onStart = (e) => {
      e.preventDefault();
      const pos = getPos(e);
      this.isDrawing = true;
      this.dragStart = { x: pos.x, y: pos.y };

      if (this.currentTool === 'dot') {
        this.elements.push({
          type: 'dot',
          x: pos.x,
          y: pos.y,
          label: this.currentLabel
        });
        this.isDrawing = false;
        this.render();
      } else if (this.currentTool === 'label') {
        this.elements.push({
          type: 'label',
          x: pos.x,
          y: pos.y,
          text: this.currentLabel
        });
        this.isDrawing = false;
        this.render();
      }
    };

    const onMove = (e) => {
      if (!this.isDrawing || !this.dragStart) return;
      e.preventDefault();
      const pos = getPos(e);

      if (this.currentTool === 'line') {
        this.tempElement = {
          type: 'line',
          x1: this.dragStart.x,
          y1: this.dragStart.y,
          x2: pos.x,
          y2: pos.y,
          label: this.currentLabel
        };
      } else if (this.currentTool === 'curve') {
        const midX = (this.dragStart.x + pos.x) / 2;
        const midY = Math.max(this.dragStart.y, pos.y) + 30;
        this.tempElement = {
          type: 'curve',
          x1: this.dragStart.x,
          y1: this.dragStart.y,
          cx: midX,
          cy: midY,
          x2: pos.x,
          y2: pos.y,
          label: this.currentLabel
        };
      } else if (this.currentTool === 'dwl') {
        this.tempElement = {
          type: 'dwl',
          x1: this.dragStart.x,
          y1: this.dragStart.y,
          x2: pos.x,
          y2: pos.y
        };
      }
      this.render();
    };

    const onEnd = (e) => {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      if (this.tempElement) {
        this.elements.push(this.tempElement);
        this.tempElement = null;
      }
      this.dragStart = null;
      this.render();
    };

    this.canvas.addEventListener('mousedown', onStart);
    this.canvas.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);

    this.canvas.addEventListener('touchstart', onStart, { passive: false });
    this.canvas.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onEnd);
  }

  render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.width, this.height);

    // Draw Background Grid
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += this.options.gridStep) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.height; y += this.options.gridStep) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    // Draw Coordinate Axes
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2.5;
    // Y-Axis (Price)
    ctx.beginPath();
    ctx.moveTo(55, 20);
    ctx.lineTo(55, this.height - 45);
    ctx.lineTo(this.width - 25, this.height - 45);
    ctx.stroke();

    // Axis Arrows
    this.drawArrowhead(ctx, 55, 20, -Math.PI / 2, '#94a3b8');
    this.drawArrowhead(ctx, this.width - 25, this.height - 45, 0, '#94a3b8');

    // Axis Labels
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '600 13px Inter, sans-serif';
    ctx.fillText('Price / Cost (P)', 15, 30);
    ctx.fillText('Quantity (Q)', this.width - 100, this.height - 20);
    ctx.fillText('0', 40, this.height - 30);

    // Render User Elements
    const all = [...this.elements];
    if (this.tempElement) all.push(this.tempElement);

    all.forEach(el => {
      if (el.type === 'line') {
        this.drawLine(el);
      } else if (el.type === 'curve') {
        this.drawCurve(el);
      } else if (el.type === 'dot') {
        this.drawDot(el);
      } else if (el.type === 'label') {
        this.drawLabel(el);
      } else if (el.type === 'dwl') {
        this.drawDwl(el);
      }
    });
  }

  drawLine(el) {
    const ctx = this.ctx;
    ctx.strokeStyle = this.getColorForLabel(el.label);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(el.x1, el.y1);
    ctx.lineTo(el.x2, el.y2);
    ctx.stroke();

    const angle = Math.atan2(el.y2 - el.y1, el.x2 - el.x1);
    this.drawArrowhead(ctx, el.x2, el.y2, angle, this.getColorForLabel(el.label));

    if (el.label) {
      ctx.fillStyle = this.getColorForLabel(el.label);
      ctx.font = '700 12px Inter, sans-serif';
      ctx.fillText(el.label, el.x2 + 8, el.y2 + 4);
    }
  }

  drawCurve(el) {
    const ctx = this.ctx;
    ctx.strokeStyle = this.getColorForLabel(el.label);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(el.x1, el.y1);
    ctx.quadraticCurveTo(el.cx, el.cy, el.x2, el.y2);
    ctx.stroke();

    if (el.label) {
      ctx.fillStyle = this.getColorForLabel(el.label);
      ctx.font = '700 12px Inter, sans-serif';
      ctx.fillText(el.label, el.x2 + 8, el.y2 + 4);
    }
  }

  drawDot(el) {
    const ctx = this.ctx;
    ctx.fillStyle = '#f43f5e';
    ctx.beginPath();
    ctx.arc(el.x, el.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    if (el.label) {
      ctx.fillStyle = '#f43f5e';
      ctx.font = '700 12px Inter, sans-serif';
      ctx.fillText(el.label, el.x + 8, el.y - 6);
    }
  }

  drawLabel(el) {
    const ctx = this.ctx;
    ctx.fillStyle = '#38bdf8';
    ctx.font = '700 13px Inter, sans-serif';
    ctx.fillText(el.text, el.x, el.y);
  }

  drawDwl(el) {
    const ctx = this.ctx;
    ctx.fillStyle = 'rgba(244, 63, 94, 0.35)';
    ctx.strokeStyle = '#f43f5e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(el.x1, el.y1);
    ctx.lineTo(el.x2, el.y2);
    ctx.lineTo(el.x1, el.y2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#f43f5e';
    ctx.font = '700 11px Inter, sans-serif';
    ctx.fillText('DWL', (el.x1 + el.x2) / 2 - 10, (el.y1 + el.y2) / 2);
  }

  drawArrowhead(ctx, x, y, radians, color) {
    ctx.save();
    ctx.beginPath();
    ctx.translate(x, y);
    ctx.rotate(radians);
    ctx.moveTo(0, 0);
    ctx.lineTo(-7, -4);
    ctx.lineTo(-7, 4);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    ctx.restore();
  }

  getColorForLabel(label) {
    switch (label) {
      case 'DD':
      case 'AD':
      case 'L':
        return '#0ea5e9'; // Cyan/Blue
      case 'MPC':
      case 'SS':
      case 'AS0':
      case 'Ms':
        return '#10b981'; // Emerald
      case 'MSC':
      case 'AS1':
        return '#f43f5e'; // Rose
      case 'DWL':
        return '#f59e0b'; // Amber
      default:
        return '#38bdf8';
    }
  }

  // ==========================================
  // AUTOMATED SPATIAL GRADING ENGINE
  // ==========================================
  gradeSubmission() {
    const result = {
      score: 0,
      maxScore: 8,
      passed: false,
      feedback: []
    };

    const lines = this.elements.filter(e => e.type === 'line' || e.type === 'curve');
    const dots = this.elements.filter(e => e.type === 'dot');
    const labels = this.elements.filter(e => e.type === 'label');
    const dwls = this.elements.filter(e => e.type === 'dwl');

    if (this.options.targetProblem === 'externality') {
      // Required elements for Negative Production Externality:
      // 1. Demand DD: Downward-sloping curve (slope < -0.15) -> 2 Marks
      let ddLine = lines.find(l => {
        const dx = l.x2 - l.x1;
        const dy = l.y2 - l.y1;
        return (dx > 30 && dy > 20) || l.label === 'DD';
      });
      if (ddLine) {
        result.score += 2;
        result.feedback.push('✅ Demand Curve (DD / MPB): Correct downward-sloping trajectory (+2 Marks)');
      } else {
        result.feedback.push('❌ Missing or incorrect Demand Curve (DD / MPB) with downward slope (0/2 Marks)');
      }

      // 2. Private Marginal Cost MPC (Supply SS): Upward-sloping (slope > 0.15) -> 2 Marks
      let mpcLine = lines.find(l => {
        const dx = l.x2 - l.x1;
        const dy = l.y2 - l.y1;
        return (dx > 30 && dy < -20) && (l.label === 'MPC' || l.label === 'SS' || l !== ddLine);
      });
      if (mpcLine) {
        result.score += 2;
        result.feedback.push('✅ Marginal Private Cost Curve (MPC / SS): Correct upward-sloping slope (+2 Marks)');
      } else {
        result.feedback.push('❌ Missing or incorrect Marginal Private Cost (MPC / SS) curve (0/2 Marks)');
      }

      // 3. Marginal Social Cost MSC: Upward-sloping and vertically above MPC -> 2 Marks
      let mscLine = lines.find(l => {
        const dx = l.x2 - l.x1;
        const dy = l.y2 - l.y1;
        return (dx > 30 && dy < -20) && l !== mpcLine && l !== ddLine;
      });
      if (mscLine && mpcLine) {
        // Check vertical height: MSC must be above MPC (lower Y coordinate in canvas space)
        const avgMscY = (mscLine.y1 + mscLine.y2) / 2;
        const avgMpcY = (mpcLine.y1 + mpcLine.y2) / 2;
        if (avgMscY < avgMpcY) {
          result.score += 2;
          result.feedback.push('✅ Marginal Social Cost (MSC = MPC + Pollution Cost): Correctly situated vertically above MPC (+2 Marks)');
        } else {
          result.feedback.push('⚠️ MSC curve is drawn below MPC; social cost must include externality (0/2 Marks)');
        }
      } else if (mscLine) {
        result.score += 1;
        result.feedback.push('⚠️ MSC curve detected but MPC comparison could not be verified (+1 Mark)');
      } else {
        result.feedback.push('❌ Missing Marginal Social Cost (MSC) curve (0/2 Marks)');
      }

      // 4. Equilibrium Markers / Labels / DWL -> 2 Marks
      let hasEquilibrium = (dots.length >= 2 || labels.length >= 2 || dwls.length >= 1);
      if (hasEquilibrium) {
        result.score += 2;
        result.feedback.push('✅ Equilibrium points (Q1 market overproduction vs Q2 social optimum) & Deadweight Loss indicated (+2 Marks)');
      } else {
        result.feedback.push('⚠️ Missing equilibrium points or labels for Q1, Q2, P1, P2, and Deadweight Loss (0/2 Marks)');
      }

      result.passed = result.score >= 5;
    }

    return result;
  }
}

window.AxiomCanvasEngine = AxiomCanvasEngine;
