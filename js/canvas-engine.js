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
  // Helper to compute economic Cartesian slope and angle
  computeEconomicSlope(line) {
    let x1 = line.x1, y1 = line.y1;
    let x2 = line.x2, y2 = line.y2;
    // Normalize left to right
    if (x2 < x1) {
      [x1, x2] = [x2, x1];
      [y1, y2] = [y2, y1];
    }
    const dx = x2 - x1;
    // In canvas, y increases downward. In economics, price increases upward.
    const dp = -(y2 - y1);
    const slope = dx !== 0 ? (dp / dx) : 0;
    const angleDeg = Math.atan2(dp, dx) * (180 / Math.PI);
    return { dx, dp, slope, angleDeg };
  }

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
      // 1. Demand Curve (DD / MPB) Verification
      const ddCandidate = lines.find(l => l.label === 'DD' || l.label === 'MPB') || 
                          lines.find(l => this.computeEconomicSlope(l).slope < 0);

      if (ddCandidate) {
        const { slope, angleDeg } = this.computeEconomicSlope(ddCandidate);
        // Valid Demand curve: negative slope (angle between -85° and -5°, ideally -75° to -15°)
        if (slope < 0 && angleDeg >= -85 && angleDeg <= -5) {
          result.score += 2;
          result.feedback.push(`✅ Demand Curve (DD / MPB): Correct negative slope (angle: ${Math.round(angleDeg)}°, downward-sloping satisfying Law of Demand) (+2 Marks)`);
        } else if (slope > 0) {
          result.feedback.push(`❌ Demand Curve Error: You drew a line with a POSITIVE slope (angle: +${Math.round(angleDeg)}°). In economics, the Law of Demand requires an inverse relationship between price and quantity (downward-sloping, between -15° and -75°). Your line slopes upward like a supply curve (0/2 Marks).`);
        } else {
          result.feedback.push(`⚠️ Demand Curve Warning: Your curve is nearly horizontal or vertical (angle: ${Math.round(angleDeg)}°). Typical macro demand curves have a downward slope between -15° and -75° (0/2 Marks).`);
        }
      } else {
        result.feedback.push('❌ Missing Demand Curve (DD / MPB). Draw a downward-sloping line from top-left to bottom-right (0/2 Marks).');
      }

      // 2. Marginal Private Cost Curve (MPC / SS) Verification
      const mpcCandidate = lines.find(l => l.label === 'MPC' || l.label === 'SS') || 
                           lines.find(l => l !== ddCandidate && this.computeEconomicSlope(l).slope > 0);

      if (mpcCandidate) {
        const { slope, angleDeg } = this.computeEconomicSlope(mpcCandidate);
        // Valid Supply curve: positive slope (angle between +10° and +80°, ideally +15° to +75°)
        if (slope > 0 && angleDeg >= 10 && angleDeg <= 80) {
          result.score += 2;
          result.feedback.push(`✅ Marginal Private Cost Curve (MPC / SS): Correct positive slope (angle: +${Math.round(angleDeg)}°, upward-sloping reflecting rising marginal costs) (+2 Marks)`);
        } else if (slope < 0) {
          result.feedback.push(`❌ Supply Curve Error: You drew MPC with a NEGATIVE slope (angle: ${Math.round(angleDeg)}°). Supply and marginal cost curves must be upward-sloping (positive slope) to reflect increasing opportunity costs (0/2 Marks).`);
        } else {
          result.feedback.push(`⚠️ MPC Slope Warning: Curve has extreme slope (+${Math.round(angleDeg)}°); standard supply curves slope upward between +15° and +75° (0/2 Marks).`);
        }
      } else {
        result.feedback.push('❌ Missing Marginal Private Cost (MPC / SS) curve. Draw an upward-sloping curve from bottom-left to top-right (0/2 Marks).');
      }

      // 3. Marginal Social Cost Curve (MSC = MPC + MEC) Verification
      const mscCandidate = lines.find(l => l.label === 'MSC') || 
                           lines.find(l => l !== ddCandidate && l !== mpcCandidate && this.computeEconomicSlope(l).slope > 0);

      if (mscCandidate && mpcCandidate) {
        const { slope, angleDeg } = this.computeEconomicSlope(mscCandidate);
        // Average canvas Y coordinates (in canvas, lower Y means higher price / higher height)
        const avgMscY = (mscCandidate.y1 + mscCandidate.y2) / 2;
        const avgMpcY = (mpcCandidate.y1 + mpcCandidate.y2) / 2;

        if (slope > 0 && avgMscY < avgMpcY - 10) {
          result.score += 2;
          result.feedback.push(`✅ Marginal Social Cost (MSC): Correctly upward-sloping (angle: +${Math.round(angleDeg)}°) and positioned vertically ABOVE MPC by the Marginal External Cost (MEC) (+2 Marks)`);
        } else if (avgMscY >= avgMpcY) {
          result.feedback.push(`❌ Social Cost Placement Error: You drew MSC BELOW or at the same level as MPC. Because a negative externality imposes additional pollution damage on society (MEC > 0), MSC = MPC + MEC must lie vertically ABOVE MPC at all output levels (0/2 Marks).`);
        } else {
          result.feedback.push(`⚠️ MSC Slope Error: MSC must be upward-sloping (positive slope) situated above MPC (0/2 Marks).`);
        }
      } else if (mscCandidate) {
        result.score += 1;
        result.feedback.push('⚠️ MSC curve detected, but could not verify relative vertical positioning against MPC (+1 Mark).');
      } else {
        result.feedback.push('❌ Missing Marginal Social Cost (MSC) curve. Draw an upward-sloping curve situated above MPC (0/2 Marks).');
      }

      // 4. Equilibria (Market Q1 vs Social Q2) & Deadweight Loss (DWL)
      const hasEquilibria = (dots.length >= 2 || labels.length >= 2);
      const hasDwl = (dwls.length >= 1 || labels.some(l => l.text === 'DWL'));

      if (hasEquilibria && hasDwl) {
        result.score += 2;
        result.feedback.push('✅ Equilibria & Deadweight Loss: Both Market Equilibrium E1, Social Optimum E2, and Deadweight Loss triangle indicated (+2 Marks)');
      } else if (hasEquilibria || hasDwl) {
        result.score += 1;
        result.feedback.push('⚠️ Partial Credit: You identified either the equilibrium points (E1, E2) OR the Deadweight Loss triangle, but not both (+1 Mark).');
      } else {
        result.feedback.push('❌ Missing Market vs Social Optimum equilibrium points (E1, E2) and Deadweight Loss (DWL) triangle (0/2 Marks).');
      }

      result.passed = result.score >= 5;
    }

    return result;
  }
}

window.AxiomCanvasEngine = AxiomCanvasEngine;
