// Project Axiom - Live Assessment State Machine & Active Feedback Engine
// Features: Option Shuffling, Forgiving Numerical/String Parsing, Test Size Selector (10, 25, 50, 100, All), Unit Filtering

class AxiomExamEngine {
  constructor() {
    this.masterBank = window.AXIOM_MASTER_BANK || [];
    this.testSize = 25; // Default: 25 questions
    this.selectedUnit = 'all'; // 'all', 14, 15, 20
    this.mode = 'practice'; // 'practice' or 'timed'
    this.timeRemaining = 45 * 60;
    this.timerInterval = null;

    this.activeQuestions = [];
    this.currentIndex = 0;
    this.userAnswers = {}; // { qId: answerValue }
    this.shuffledOptionsMap = {}; // { qId: { options: [], correctKey: 'A' } }
    this.flagged = new Set();
    this.canvasEngines = {};

    this.lastRenderedQId = null;
    this.lastAnswerAttempt = {};
    this.initUI();
    this.startNewAssessment();
  }

  // Fisher-Yates shuffle
  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  startNewAssessment() {
    // 1. Filter by unit if requested
    let pool = [...this.masterBank];
    if (this.selectedUnit !== 'all') {
      pool = pool.filter(q => q.ch === parseInt(this.selectedUnit, 10));
    }

    // 2. Sample questions evenly
    let selected = [];
    if (this.testSize === 'all' || pool.length <= this.testSize) {
      selected = this.shuffle(pool);
    } else {
      if (this.selectedUnit === 'all') {
        const u14 = this.shuffle(pool.filter(q => q.ch === 14));
        const u15 = this.shuffle(pool.filter(q => q.ch === 15));
        const u20 = this.shuffle(pool.filter(q => q.ch === 20));
        const perUnit = Math.floor(this.testSize / 3);
        const remainder = this.testSize % 3;

        selected = [
          ...u14.slice(0, perUnit + (remainder > 0 ? 1 : 0)),
          ...u15.slice(0, perUnit + (remainder > 1 ? 1 : 0)),
          ...u20.slice(0, perUnit)
        ];
        selected = this.shuffle(selected);
      } else {
        selected = this.shuffle(pool).slice(0, this.testSize);
      }
    }

    this.activeQuestions = selected;
    this.currentIndex = 0;
    this.userAnswers = {};
    this.shuffledOptionsMap = {};
    this.flagged.clear();

    // 3. Pre-shuffle options for each MCQ so letter keys are not predictable
    this.activeQuestions.forEach(q => {
      if (q.type === 'mcq' && q.options) {
        const originalCorrectOpt = q.options.find(o => o.key === q.correctKey);
        const shuffledOpts = this.shuffle(q.options);
        const keys = ['A', 'B', 'C', 'D', 'E'];
        let newCorrectKey = 'A';

        const mappedOpts = shuffledOpts.map((opt, idx) => {
          const newKey = keys[idx] || 'A';
          if (opt === originalCorrectOpt || opt.text_en === originalCorrectOpt?.text_en) {
            newCorrectKey = newKey;
          }
          return {
            key: newKey,
            text_en: opt.text_en,
            text_af: opt.text_af
          };
        });

        this.shuffledOptionsMap[q.id] = {
          options: mappedOpts,
          correctKey: newCorrectKey
        };
      }
    });

    this.renderQuestionGrid();
    this.renderQuestion();
    this.resetTimer();
  }

  initUI() {
    // Navigation
    document.getElementById('prevBtn').addEventListener('click', () => this.navigate(-1));
    document.getElementById('nextBtn').addEventListener('click', () => this.navigate(1));
    document.getElementById('flagBtn').addEventListener('click', () => this.toggleFlag());
    document.getElementById('submitExamBtn').addEventListener('click', () => this.submitExam());
    document.getElementById('modeToggleBtn').addEventListener('click', () => this.toggleMode());

    // Test Size Selector
    const sizeSelect = document.getElementById('testSizeSelect');
    if (sizeSelect) {
      sizeSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        this.testSize = val === 'all' ? 'all' : parseInt(val, 10);
        this.startNewAssessment();
      });
    }

    // Unit Focus Selector
    const unitSelect = document.getElementById('unitFocusSelect');
    if (unitSelect) {
      unitSelect.addEventListener('change', (e) => {
        this.selectedUnit = e.target.value;
        this.startNewAssessment();
      });
    }

    // New Test Shuffle Button
    const newTestBtn = document.getElementById('newTestBtn');
    if (newTestBtn) {
      newTestBtn.addEventListener('click', () => this.startNewAssessment());
    }
  }

  renderQuestionGrid() {
    const grid = document.getElementById('questionGrid');
    grid.innerHTML = '';
    const total = this.activeQuestions.length;
    document.getElementById('paletteCount').textContent = `${total} Questions`;

    this.activeQuestions.forEach((q, idx) => {
      const box = document.createElement('div');
      box.className = 'q-box' + (idx === this.currentIndex ? ' active' : '');
      box.textContent = (idx + 1);
      box.id = `qbox_${q.id}`;
      box.addEventListener('click', () => {
        this.currentIndex = idx;
        this.renderQuestion();
      });
      grid.appendChild(box);
    });
  }

  renderQuestion() {
    const q = this.activeQuestions[this.currentIndex];
    if (!q) return;

    // Header & Badge
    document.getElementById('currentQNum').textContent = `Question ${this.currentIndex + 1} of ${this.activeQuestions.length}`;
    document.getElementById('currentMarks').textContent = `[${q.marks} Marks • ${q.difficulty || 'Exam'}]`;

    // Flag State
    const flagBtn = document.getElementById('flagBtn');
    if (this.flagged.has(q.id)) {
      flagBtn.classList.add('active');
      flagBtn.textContent = '🚩 Flagged';
    } else {
      flagBtn.classList.remove('active');
      flagBtn.textContent = '🏳️ Flag for Review';
    }

    // Dual-Language Stems
    document.getElementById('stemEn').textContent = q.stem_en;
    document.getElementById('stemAf').textContent = q.stem_af;

    // Interactive Input Area
    const interactiveArea = document.getElementById('interactiveArea');
    interactiveArea.innerHTML = '';

    if (q.type === 'mcq') {
      this.renderMcqOptions(q, interactiveArea);
    } else if (q.type === 'calculation') {
      this.renderCalcInput(q, interactiveArea);
    } else if (q.type === 'canvas') {
      this.renderCanvasInterface(q, interactiveArea);
    }

    // Feedback Display with Top-Stacking & Question-Switch Handling
    const fbContainer = document.getElementById('feedbackContainer');
    const isQuestionSwitch = (this.lastRenderedQId !== q.id);
    this.lastRenderedQId = q.id;

    if (this.mode === 'practice' && this.userAnswers[q.id] !== undefined) {
      if (isQuestionSwitch) {
        fbContainer.innerHTML = '';
        this.showFeedback(q, fbContainer);
      } else {
        if (this.lastAnswerAttempt[q.id] !== this.userAnswers[q.id]) {
          this.showFeedback(q, fbContainer);
        }
      }
      this.lastAnswerAttempt[q.id] = this.userAnswers[q.id];
    } else {
      fbContainer.innerHTML = '';
    }

    // Palette highlight
    document.querySelectorAll('.q-box').forEach((b, idx) => {
      b.classList.toggle('active', idx === this.currentIndex);
    });

    // KaTeX Math Rendering across question card and feedback
    const qCard = document.getElementById('questionCard');
    if (window.AxiomMath) {
      window.AxiomMath.renderElement(qCard);
    } else if (window.renderMathInElement) {
      renderMathInElement(qCard, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '\\(', right: '\\)', display: false},
          {left: '\\[', right: '\\]', display: true},
          {left: '$', right: '$', display: false}
        ],
        throwOnError: false
      });
    }
  }

  renderMcqOptions(q, container) {
    const stack = document.createElement('div');
    stack.className = 'options-stack';

    // Retrieve the shuffled options for this question
    const shuffledData = this.shuffledOptionsMap[q.id] || { options: q.options };
    const optionsToRender = shuffledData.options;

    optionsToRender.forEach(opt => {
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
        if (this.userAnswers[q.id] === opt.key) return;
        this.recordAnswer(q.id, opt.key);
        this.renderQuestion();
      });
      stack.appendChild(row);
    });

    container.appendChild(stack);
  }

  // Forgiving Numerical Parser
  parseFlexibleNumber(raw) {
    if (typeof raw === 'number') return raw;
    if (!raw) return NaN;
    let s = raw.toString().trim();
    // If comma is followed by 3 digits and not followed by more decimals or digits, strip commas as thousands separators:
    // e.g. "1,195,000" or "R 1,195,000" or "16,250"
    if (/^\s*[R\$]?\s*-?\d{1,3}(,\d{3})+(\.\d+)?\s*%?\s*$/i.test(s)) {
      s = s.replace(/,/g, '');
    } else {
      s = s.replace(/,/g, '.');
    }
    const cleaned = s.replace(/[R\$%\s\(\)]/gi, '');
    return parseFloat(cleaned);
  }

  renderCalcInput(q, container) {
    const currentVal = this.userAnswers[q.id] !== undefined ? this.userAnswers[q.id] : '';
    const block = document.createElement('div');
    block.className = 'calc-input-block';
    block.innerHTML = `
      <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.5rem; text-transform: uppercase;">
        Enter Numerical Solution (Leniency Enabled: Accepts Rands, %, Commas):
      </div>
      <div style="display: flex; gap: 0.75rem; align-items: center;">
        <input type="text" class="calc-field" id="calcInput_${q.id}" value="${currentVal}" placeholder="e.g. 18.18 or 18,18 or R95 000">
        <button class="primary-btn" id="calcSubmitBtn_${q.id}">Submit Answer</button>
      </div>
    `;
    container.appendChild(block);

    const input = block.querySelector(`#calcInput_${q.id}`);
    const btn = block.querySelector(`#calcSubmitBtn_${q.id}`);

    const submitAction = () => {
      const parsed = this.parseFlexibleNumber(input.value);
      if (!isNaN(parsed)) {
        this.recordAnswer(q.id, parsed);
        this.renderQuestion();
      } else {
        alert('Please enter a valid numeric value.');
      }
    };

    btn.addEventListener('click', submitAction);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submitAction(); });
  }

  renderCanvasInterface(q, container) {
    const wrapper = document.createElement('div');
    wrapper.className = 'canvas-wrapper';
    wrapper.innerHTML = `
      <div class="canvas-toolbar">
        <button class="tool-btn active" data-tool="line" data-label="DD">✏️ Line (DD / MPB)</button>
        <button class="tool-btn" data-tool="line" data-label="MPC">✏️ Line (MPC / SS)</button>
        <button class="tool-btn" data-tool="line" data-label="MSC">✏️ Line (MSC)</button>
        <button class="tool-btn" data-tool="curve" data-label="L">〰️ Spline Curve</button>
        <button class="tool-btn" data-tool="dot" data-label="E1">📍 Point E1 (Market)</button>
        <button class="tool-btn" data-tool="dot" data-label="E2">📍 Point E2 (Optimum)</button>
        <button class="tool-btn" data-tool="dwl">🔺 Deadweight Loss</button>
        <button class="tool-btn" id="canvasUndoBtn">↩️ Undo</button>
        <button class="tool-btn" id="canvasClearBtn">🗑️ Clear</button>
      </div>
      <canvas id="graphCanvas" width="680" height="380"></canvas>
      <div style="margin-top: 0.85rem; display: flex; justify-content: flex-end;">
        <button class="primary-btn" id="canvasGradeBtn">Submit Graph for Spatial Slope Grading</button>
      </div>
    `;
    container.appendChild(wrapper);

    setTimeout(() => {
      const ce = new AxiomCanvasEngine('graphCanvas', { targetProblem: q.problemType || 'externality' });
      this.canvasEngines[q.id] = ce;

      wrapper.querySelectorAll('.tool-btn[data-tool]').forEach(b => {
        b.addEventListener('click', () => {
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
    const q = this.activeQuestions[this.currentIndex];
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
    if (next >= 0 && next < this.activeQuestions.length) {
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
      const activeCorrectKey = this.shuffledOptionsMap[q.id]?.correctKey || q.correctKey;
      isCorrect = ans === activeCorrectKey;
      earnedMarks = isCorrect ? q.marks : 0;
    } else if (q.type === 'calculation') {
      const diff = Math.abs(ans - q.expectedNumber);
      const tol = (q.tolerance !== undefined ? q.tolerance : 0.1);
      isCorrect = diff <= (tol + 1e-7);
      earnedMarks = isCorrect ? q.marks : 0;
    } else if (q.type === 'canvas') {
      isCorrect = ans && ans.passed;
      earnedMarks = ans ? ans.score : 0;
      if (ans && ans.feedback) {
        detailsHtml = `<ul style="margin: 0.5rem 0 0.5rem 1.25rem; font-size: 0.85rem;">${ans.feedback.map(f => `<li>${f}</li>`).join('')}</ul>`;
      }
    }

    // Schedule 5-second fadeout on all previous attempt cards
    const previousCards = container.querySelectorAll('.feedback-box:not(.fading-out)');
    previousCards.forEach(card => {
      card.removeAttribute('data-latest');
      if (!card.dataset.fadeTimerSet) {
        card.dataset.fadeTimerSet = 'true';
        setTimeout(() => {
          card.classList.add('fading-out');
          setTimeout(() => {
            if (card.parentNode) card.remove();
          }, 600);
        }, 5000); // 5 seconds
      }
    });

    // Create newest feedback card
    const box = document.createElement('div');
    box.className = `feedback-box ${isCorrect ? 'correct' : 'incorrect'}`;
    box.setAttribute('data-latest', 'true');
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

    // Prepend so the latest attempt is placed at the top and stays!
    container.prepend(box);

    if (window.AxiomMath) {
      window.AxiomMath.renderElement(box);
    } else if (window.renderMathInElement) {
      renderMathInElement(box, {
        delimiters: [
          {left: '$$', right: '$$', display: true},
          {left: '\(', right: '\)', display: false},
          {left: '\[', right: '\]', display: true},
          {left: '$', right: '$', display: false}
        ],
        throwOnError: false
      });
    }
  }

  submitExam() {
    let totalMarks = 0;
    let earnedMarks = 0;

    this.activeQuestions.forEach(q => {
      totalMarks += q.marks;
      const ans = this.userAnswers[q.id];
      if (q.type === 'mcq') {
        const activeCorrectKey = this.shuffledOptionsMap[q.id]?.correctKey || q.correctKey;
        if (ans === activeCorrectKey) earnedMarks += q.marks;
      } else if (q.type === 'calculation') {
        const diff = Math.abs(ans - q.expectedNumber);
        const tol = (q.tolerance !== undefined ? q.tolerance : 0.1);
        if (ans !== undefined && diff <= (tol + 1e-7)) {
          earnedMarks += q.marks;
        }
      } else if (q.type === 'canvas' && ans && ans.score) {
        earnedMarks += ans.score;
      }
    });

    const pct = Math.round((earnedMarks / totalMarks) * 100);
    if (window.AxiomTelemetry) {
      window.AxiomTelemetry.logAssessmentCompleted();
    }

    alert(`ASSESSMENT FINISHED!\n\nScore: ${earnedMarks} / ${totalMarks} Marks (${pct}%)\n\nSwitching to practice mode so you can review full step-by-step solutions.`);
    this.mode = 'practice';
    this.renderQuestion();
  }

  resetTimer() {
    if (this.timerInterval) clearInterval(this.timerInterval);
    const count = this.activeQuestions.length;
    this.timeRemaining = Math.max(count * 90, 600); // 1.5 minutes per question, min 10 mins

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
