// Project Axiom - Live Assessment State Machine & Active Feedback Engine
// KaTeX Math Rendering • Spatial Canvas Integration • Dual-Mode Support

class AxiomExamEngine {
  constructor() {
    this.questions = window.AXIOM_QUESTIONS || [];
    this.currentIndex = 0;
    this.userAnswers = {}; // { qId: answerValue }
    this.flagged = new Set();
    this.mode = 'practice'; // 'timed' or 'practice'
    this.timeRemaining = 45 * 60; // 45 minutes in seconds
    this.timerInterval = null;
    this.canvasEngines = {}; // { qId: AxiomCanvasEngineInstance }

    this.initUI();
    this.renderQuestion();
    this.startTimer();
  }

  initUI() {
    this.renderQuestionGrid();
    document.getElementById('prevBtn').addEventListener('click', () => this.navigate(-1));
    document.getElementById('nextBtn').addEventListener('click', () => this.navigate(1));
    document.getElementById('flagBtn').addEventListener('click', () => this.toggleFlag());
    document.getElementById('submitExamBtn').addEventListener('click', () => this.submitExam());
    document.getElementById('modeToggleBtn').addEventListener('click', () => this.toggleMode());
  }

  renderQuestionGrid() {
    const grid = document.getElementById('questionGrid');
    grid.innerHTML = '';
    this.questions.forEach((q, idx) => {
      const box = document.createElement('div');
      box.className = 'q-box' + (idx === this.currentIndex ? ' active' : '');
      box.textContent = q.qNum;
      box.id = `qbox_${q.id}`;
      box.addEventListener('click', () => {
        this.currentIndex = idx;
        this.renderQuestion();
      });
      grid.appendChild(box);
    });
  }

  renderQuestion() {
    const q = this.questions[this.currentIndex];
    if (!q) return;

    // Update Header
    document.getElementById('currentQNum').textContent = `Question ${q.qNum} of ${this.questions.length}`;
    document.getElementById('currentMarks').textContent = `[${q.marks} Marks]`;

    // Flag button state
    const flagBtn = document.getElementById('flagBtn');
    if (this.flagged.has(q.id)) {
      flagBtn.classList.add('active');
      flagBtn.textContent = '🚩 Flagged';
    } else {
      flagBtn.classList.remove('active');
      flagBtn.textContent = '🏳️ Flag for Review';
    }

    // Question Stems
    document.getElementById('stemEn').textContent = q.stem_en;
    document.getElementById('stemAf').textContent = q.stem_af;

    // Render Answer Area based on Type
    const interactiveArea = document.getElementById('interactiveArea');
    interactiveArea.innerHTML = '';

    if (q.type === 'mcq') {
      this.renderMcqOptions(q, interactiveArea);
    } else if (q.type === 'calculation') {
      this.renderCalcInput(q, interactiveArea);
    } else if (q.type === 'canvas') {
      this.renderCanvasInterface(q, interactiveArea);
    }

    // Feedback area
    const fbContainer = document.getElementById('feedbackContainer');
    if (this.mode === 'practice' && this.userAnswers[q.id] !== undefined) {
      this.showFeedback(q, fbContainer);
    } else {
      fbContainer.innerHTML = '';
    }

    // Update Palette active state
    document.querySelectorAll('.q-box').forEach((b, idx) => {
      b.classList.toggle('active', idx === this.currentIndex);
    });

    // Render KaTeX Math
    if (window.renderMathInElement) {
      renderMathInElement(document.getElementById('questionCard'), {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true}
        ]
      });
    }
  }

  renderMcqOptions(q, container) {
    const stack = document.createElement('div');
    stack.className = 'options-stack';

    q.options.forEach(opt => {
      const row = document.createElement('div');
      row.className = 'option-row' + (this.userAnswers[q.id] === opt.key ? ' selected' : '');
      row.innerHTML = `
        <div class="option-key">${opt.key}</div>
        <div class="option-content">
          <div class="option-en">${opt.text_en}</div>
          <div class="option-af">${opt.text_af}</div>
        </div>
      `;
      row.addEventListener('click', () => {
        this.recordAnswer(q.id, opt.key);
        this.renderQuestion();
      });
      stack.appendChild(row);
    });

    container.appendChild(stack);
  }

  renderCalcInput(q, container) {
    const block = document.createElement('div');
    block.className = 'calc-input-block';
    block.innerHTML = `
      <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.5rem; text-transform: uppercase;">
        Enter Numerical Solution:
      </div>
      <div style="display: flex; gap: 0.75rem; align-items: center;">
        <input type="number" step="any" class="calc-field" id="calcInput_${q.id}" value="${this.userAnswers[q.id] || ''}" placeholder="e.g. 18.18">
        <button class="primary-btn" id="calcSubmitBtn_${q.id}">Submit Answer</button>
      </div>
    `;
    container.appendChild(block);

    const input = block.querySelector(`#calcInput_${q.id}`);
    const btn = block.querySelector(`#calcSubmitBtn_${q.id}`);
    btn.addEventListener('click', () => {
      const val = parseFloat(input.value);
      if (!isNaN(val)) {
        this.recordAnswer(q.id, val);
        this.renderQuestion();
      }
    });
  }

  renderCanvasInterface(q, container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'canvas-wrapper';
    wrapper.innerHTML = `
      <div class="canvas-toolbar">
        <button class="tool-btn active" data-tool="line" data-label="DD">✏️ Line (DD)</button>
        <button class="tool-btn" data-tool="line" data-label="MPC">✏️ Line (MPC)</button>
        <button class="tool-btn" data-tool="line" data-label="MSC">✏️ Line (MSC)</button>
        <button class="tool-btn" data-tool="curve" data-label="L">〰️ Curve</button>
        <button class="tool-btn" data-tool="dot" data-label="E1">📍 Dot (E1)</button>
        <button class="tool-btn" data-tool="dot" data-label="E2">📍 Dot (E2)</button>
        <button class="tool-btn" data-tool="dwl">🔺 Deadweight Loss</button>
        <button class="tool-btn" id="canvasUndoBtn">↩️ Undo</button>
        <button class="tool-btn" id="canvasClearBtn">🗑️ Clear</button>
      </div>
      <canvas id="graphCanvas" width="680" height="380"></canvas>
      <div style="margin-top: 0.85rem; display: flex; justify-content: flex-end;">
        <button class="primary-btn" id="canvasGradeBtn">Submit Graph for Instant Spatial Grading</button>
      </div>
    `;
    container.appendChild(wrapper);

    // Initialize Canvas Engine
    setTimeout(() => {
      const ce = new AxiomCanvasEngine('graphCanvas', { targetProblem: q.problemType });
      this.canvasEngines[q.id] = ce;

      wrapper.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
        b.addEventListener('click', (e) => {
          wrapper.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
          b.classList.add('active');
          ce.setTool(b.getAttribute('data-tool'), b.getAttribute('data-label'));
        });
      });

      wrapper.querySelector('#canvasUndoBtn').addEventListener('click', () => ce.undo());
      wrapper.querySelector('#canvasClearBtn').addEventListener('click', () => ce.clear());
      wrapper.querySelector('#canvasGradeBtn').addEventListener('click', () => {
        const grade = ce.gradeSubmission();
        this.recordAnswer(q.id, grade);
        this.renderQuestion();
      });
    }, 50);
  }

  recordAnswer(qId, val) {
    this.userAnswers[qId] = val;
    const box = document.getElementById(`qbox_${qId}`);
    if (box) box.classList.add('answered');
  }

  toggleFlag() {
    const q = this.questions[this.currentIndex];
    if (!q) return;
    if (this.flagged.has(q.id)) {
      this.flagged.delete(q.id);
    } else {
      this.flagged.add(q.id);
    }
    const box = document.getElementById(`qbox_${q.id}`);
    if (box) box.classList.toggle('flagged', this.flagged.has(q.id));
    this.renderQuestion();
  }

  navigate(dir) {
    const next = this.currentIndex + dir;
    if (next >= 0 && next < this.questions.length) {
      this.currentIndex = next;
      this.renderQuestion();
    }
  }

  toggleMode() {
    this.mode = this.mode === 'practice' ? 'timed' : 'practice';
    document.getElementById('modeToggleBtn').textContent = this.mode === 'practice' ? 'Mode: Practice (Instant Feedback)' : 'Mode: Strict Timed Exam';
    this.renderQuestion();
  }

  showFeedback(q, container) {
    const ans = this.userAnswers[q.id];
    let isCorrect = false;
    let earnedMarks = 0;
    let detailsHtml = '';

    if (q.type === 'mcq') {
      isCorrect = ans === q.correctKey;
      earnedMarks = isCorrect ? q.marks : 0;
    } else if (q.type === 'calculation') {
      const diff = Math.abs(ans - q.expectedNumber);
      isCorrect = diff <= (q.tolerance || 0.1);
      earnedMarks = isCorrect ? q.marks : 0;
    } else if (q.type === 'canvas') {
      isCorrect = ans && ans.passed;
      earnedMarks = ans ? ans.score : 0;
      if (ans && ans.feedback) {
        detailsHtml = `<ul style="margin: 0.5rem 0 0.5rem 1.25rem; font-size: 0.85rem;">${ans.feedback.map(f => `<li>${f}</li>`).join('')}</ul>`;
      }
    }

    const box = document.createElement('div');
    box.className = `feedback-box ${isCorrect ? 'correct' : 'incorrect'}`;
    box.innerHTML = `
      <div class="fb-heading" style="color: ${isCorrect ? 'var(--accent-emerald)' : 'var(--accent-rose)'};">
        ${isCorrect ? '✅ Correct Solution' : '❌ Incorrect Assessment'} • Marks: ${earnedMarks} / ${q.marks}
      </div>
      ${detailsHtml}
      <div class="fb-derivation">
        <strong>Formal Theoretical Derivation:</strong><br>
        ${q.derivation_en}
      </div>
    `;
    container.appendChild(box);
  }

  submitExam() {
    let totalMarks = 0;
    let earnedMarks = 0;

    this.questions.forEach(q => {
      totalMarks += q.marks;
      const ans = this.userAnswers[q.id];
      if (q.type === 'mcq' && ans === q.correctKey) earnedMarks += q.marks;
      else if (q.type === 'calculation' && Math.abs(ans - q.expectedNumber) <= (q.tolerance || 0.1)) earnedMarks += q.marks;
      else if (q.type === 'canvas' && ans && ans.score) earnedMarks += ans.score;
    });

    const pct = Math.round((earnedMarks / totalMarks) * 100);
    if (window.AxiomTelemetry) {
      window.AxiomTelemetry.logAssessmentCompleted();
    }

    alert(`ASSESSMENT SUBMITTED SUCCESSFULLY!\n\nScore: ${earnedMarks} / ${totalMarks} Marks (${pct}%)\n\nReview your answers and detailed derivations.`);
    this.mode = 'practice';
    this.renderQuestion();
  }

  startTimer() {
    this.timerInterval = setInterval(() => {
      if (this.timeRemaining > 0) {
        this.timeRemaining--;
        const mins = Math.floor(this.timeRemaining / 60).toString().padStart(2, '0');
        const secs = (this.timeRemaining % 60).toString().padStart(2, '0');
        document.getElementById('timerDisplay').textContent = `${mins}:${secs}`;
      } else {
        clearInterval(this.timerInterval);
        alert('Time has expired! Submitting assessment.');
        this.submitExam();
      }
    }, 1000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.AxiomApp = new AxiomExamEngine();
});
