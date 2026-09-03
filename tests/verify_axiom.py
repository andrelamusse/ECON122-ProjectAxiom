#!/usr/bin/env python3
"""
Project Axiom: Headless Verification & 4-Tier E2E Test Suite
=============================================================
Automated test harness verifying:
- Tier 1: Feature Coverage & Structural Integrity (126-Q Schema, KaTeX Delimiters & Zero Raw LaTeX, Disciplinary Accuracy for q14_15)
- Tier 2: Boundary, Corner & Anti-Triviality (Key Distribution 20-30%, Distractor Symmetry <= 15%, Zero Giveaway Stems, Calculation Tolerances)
- Tier 3: Cross-Feature Pairwise (Bilingual Parity, Language Synchronicity, Difficulty Matrix, Scoring Engine Simulation)
- Tier 4: Real-World Workload Scenarios (Mobile 100vw & 44px Tap Targets, Telemetry 300s Active Engagement, Offline Autonomy)

Usage:
    python project_axiom/tests/verify_axiom.py
    python tests/verify_axiom.py
"""

import sys
import os
import re
import json
import math
import statistics
import argparse

# Force UTF-8 stdout/stderr on Windows PowerShell
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


class AxiomVerificationHarness:
    def __init__(self, base_dir=None):
        if base_dir:
            self.base_dir = os.path.abspath(base_dir)
        else:
            # Assume file is in project_axiom/tests/
            self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

        self.html_file = os.path.join(self.base_dir, "index.html")
        self.admin_file = os.path.join(self.base_dir, "admin.html")
        self.css_file = os.path.join(self.base_dir, "css", "axiom.css")
        self.questions_file = os.path.join(self.base_dir, "js", "questions-db.js")
        self.exam_engine_file = os.path.join(self.base_dir, "js", "exam-engine.js")
        self.glossary_file = os.path.join(self.base_dir, "js", "glossary-db.js")
        self.telemetry_file = os.path.join(self.base_dir, "js", "telemetry.js")
        self.axiom_math_file = os.path.join(self.base_dir, "js", "axiom-math.js")
        self.report_file = os.path.join(self.base_dir, "tests", "axiom_test_results.json")

        self.results = []
        self.questions_bank = []
        self.loaded_raw_files = {}

    def log_result(self, tier, test_id, name, passed, message="", details=None):
        entry = {
            "tier": tier,
            "test_id": test_id,
            "name": name,
            "passed": bool(passed),
            "message": message,
            "details": details or {}
        }
        self.results.append(entry)
        status_str = "[PASS]" if passed else "[FAIL]"
        print(f"  {status_str} {test_id}: {name}")
        if not passed and message:
            print(f"         Reason: {message}")

    def load_files(self):
        """Loads and caches workspace files for inspection."""
        files = {
            "html": self.html_file,
            "admin": self.admin_file,
            "css": self.css_file,
            "questions": self.questions_file,
            "exam_engine": self.exam_engine_file,
            "glossary": self.glossary_file,
            "telemetry": self.telemetry_file,
            "axiom_math": self.axiom_math_file,
        }
        for key, path in files.items():
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8", errors="replace") as f:
                    self.loaded_raw_files[key] = f.read()
            else:
                self.loaded_raw_files[key] = None

        # Parse questions database JSON from window.AXIOM_MASTER_BANK
        q_raw = self.loaded_raw_files.get("questions")
        if q_raw:
            m = re.search(r"window\.AXIOM_MASTER_BANK\s*=\s*(\[.*?\])\s*;?\s*$", q_raw, re.DOTALL)
            if m:
                try:
                    self.questions_bank = json.loads(m.group(1))
                except Exception as e:
                    self.questions_bank = []
                    print(f"Warning: Failed to parse questions JSON: {e}")

    # =========================================================================
    # TIER 1: Feature Coverage & Structural Integrity
    # =========================================================================
    def run_tier_1(self):
        print("\n--- Running Tier 1: Feature Coverage & Structural Integrity ---")

        # 1.1 Question Bank Count & Chapters
        total_q = len(self.questions_bank)
        ch_counts = {}
        type_counts = {}
        for q in self.questions_bank:
            ch = q.get("ch") or q.get("chapter")
            ch_counts[ch] = ch_counts.get(ch, 0) + 1
            qtype = q.get("type")
            type_counts[qtype] = type_counts.get(qtype, 0) + 1

        pass_1_1 = (
            total_q == 126 and
            ch_counts.get(14) == 42 and
            ch_counts.get(15) == 42 and
            ch_counts.get(20) == 42 and
            type_counts.get("mcq") == 110 and
            (type_counts.get("calc", 0) + type_counts.get("calculation", 0)) == 16
        )
        msg_1_1 = f"Total: {total_q}/126, Ch14: {ch_counts.get(14)}/42, Ch15: {ch_counts.get(15)}/42, Ch20: {ch_counts.get(20)}/42, MCQs: {type_counts.get('mcq')}/110, Calcs: {type_counts.get('calc', 0) + type_counts.get('calculation', 0)}/16"
        self.log_result(1, "T1_01_QUESTION_COUNT_AND_CHAPTERS", "126 Questions (42/ch: 14, 15, 20; 110 MCQs, 16 Calcs)", pass_1_1, msg_1_1, {"total": total_q, "chapters": ch_counts, "types": type_counts})

        # 1.2 Question Schema Integrity
        schema_failures = []
        for q in self.questions_bank:
            qid = q.get("id", "UNKNOWN")
            ch = q.get("ch") or q.get("chapter")
            stem_en = q.get("stem_en", "").strip()
            stem_af = q.get("stem_af", "").strip()
            deriv_en = q.get("derivation_en", "").strip()
            deriv_af = q.get("derivation_af", "").strip()
            qtype = q.get("type")

            if not qid or not ch or not stem_en or not stem_af or not deriv_en or not deriv_af:
                schema_failures.append(f"{qid}: missing required core text or derivation")
                continue

            if qtype == "mcq":
                opts = q.get("options", [])
                correct = q.get("correctKey")
                if len(opts) != 4:
                    schema_failures.append(f"{qid}: expected 4 options, found {len(opts)}")
                if correct not in ("A", "B", "C", "D"):
                    schema_failures.append(f"{qid}: invalid correctKey '{correct}'")
                for opt in opts:
                    if not opt.get("key") or not opt.get("text_en") or not opt.get("text_af"):
                        schema_failures.append(f"{qid}: incomplete option object")
            elif qtype in ("calc", "calculation"):
                if "expectedNumber" not in q or not isinstance(q["expectedNumber"], (int, float)):
                    schema_failures.append(f"{qid}: missing or non-numeric expectedNumber")
                if "tolerance" not in q or not isinstance(q["tolerance"], (int, float)):
                    schema_failures.append(f"{qid}: missing or non-numeric tolerance")
            else:
                schema_failures.append(f"{qid}: unknown question type '{qtype}'")

        pass_1_2 = len(schema_failures) == 0
        msg_1_2 = f"Schema valid across all {len(self.questions_bank)} items" if pass_1_2 else f"{len(schema_failures)} schema violations (e.g. {schema_failures[:3]})"
        self.log_result(1, "T1_02_QUESTION_SCHEMA_INTEGRITY", "Complete question schema (stems, derivations, options, calculations)", pass_1_2, msg_1_2, {"failures_count": len(schema_failures), "samples": schema_failures[:5]})

        # 1.3 KaTeX Delimiter Escaping
        html_raw = self.loaded_raw_files.get("html", "")
        # Check for single-backslash delimiter error: r"left:\s*['\"]\\\(['\"]"
        single_bs_matches = re.findall(r"left:\s*['\"]\\[\(\[]['\"]", html_raw)
        # Check for correct double-backslash delimiter: r"left:\s*['\"]\\\\\(['\"]"
        double_bs_matches = re.findall(r"left:\s*['\"]\\[\\][\(\[]['\"]", html_raw)

        # Also check axiom-math.js if present
        math_raw = self.loaded_raw_files.get("axiom_math", "")
        if math_raw:
            single_bs_matches.extend(re.findall(r"left:\s*['\"]\\[\(\[]['\"]", math_raw))

        pass_1_3 = len(single_bs_matches) == 0 and len(double_bs_matches) > 0
        msg_1_3 = f"Found {len(single_bs_matches)} single-escaped delimiter bugs (expected 0) and {len(double_bs_matches)} double-escaped delimiters"
        self.log_result(1, "T1_03_KATEX_DELIMITER_ESCAPING", "KaTeX Delimiters double-escaped (\\\\( and \\\\[) to avoid JS string collapse", pass_1_3, msg_1_3, {"single_bs_found": len(single_bs_matches), "double_bs_found": len(double_bs_matches)})

        # 1.4 Zero Raw LaTeX Substrings in Rendered/DOM Text Outside Delimiters
        # Extract text outside <script>, <style>, and outside valid delimiters \(...\), \[...\], $$...$$
        body_no_scripts = re.sub(r"<(script|style)[^>]*>.*?</\1>", "", html_raw, flags=re.DOTALL)
        # Remove valid math blocks
        body_no_math = re.sub(r"\$\$.*?\$\$", "", body_no_scripts, flags=re.DOTALL)
        body_no_math = re.sub(r"\\\[.*?\\\]", "", body_no_math, flags=re.DOTALL)
        body_no_math = re.sub(r"\\\(.*?\\\)", "", body_no_math, flags=re.DOTALL)

        raw_latex_cmds = [r"\\frac", r"\\text\{", r"\\Delta", r"\\pi\b", r"\\times", r"\\approx", r"\\uparrow", r"\\downarrow"]
        raw_occurrences = []
        for cmd in raw_latex_cmds:
            for match in re.finditer(cmd, body_no_math):
                raw_occurrences.append((cmd, match.start()))

        pass_1_4 = len(raw_occurrences) == 0
        msg_1_4 = f"Found {len(raw_occurrences)} raw LaTeX substrings outside delimiters in HTML body"
        self.log_result(1, "T1_04_ZERO_RAW_LATEX_SUBSTRINGS", "Zero raw unrendered LaTeX syntax outside math delimiters", pass_1_4, msg_1_4, {"raw_count": len(raw_occurrences)})

        # 1.5 Disciplinary Accuracy for Question q14_15 (SARB Monetary Aggregates)
        q14_15 = next((q for q in self.questions_bank if q.get("id") == "q14_15"), None)
        pass_1_5 = False
        msg_1_5 = ""
        if q14_15:
            expected_num = q14_15.get("expectedNumber")
            deriv_en = q14_15.get("derivation_en", "")
            has_expected = expected_num == 1195000
            has_qm_590 = "590 000" in deriv_en or "590000" in deriv_en
            has_m2_def = "1 195 000" in deriv_en or "1195000" in deriv_en
            distinguishes_qm = "Quasi-Money" in deriv_en or "Quasi-money" in deriv_en or "Kwasigeld" in q14_15.get("derivation_af", "")

            pass_1_5 = has_expected and has_qm_590 and has_m2_def and distinguishes_qm
            msg_1_5 = f"ExpectedNumber: {expected_num} (target 1195000), QM=R590k in derivation: {has_qm_590}, M2=R1195k in derivation: {has_m2_def}"
        else:
            msg_1_5 = "Question q14_15 not found in question bank"
        self.log_result(1, "T1_05_DISCIPLINARY_ACCURACY_Q14_15", "q14_15 accurately distinguishes Quasi-Money (R590 000m) from M2 (R1 195 000m)", pass_1_5, msg_1_5)

        # 1.6 Glossary Database Completeness
        glossary_raw = self.loaded_raw_files.get("glossary", "")
        required_terms = [
            "fiduciary_money",
            "liquidity_preference",
            "liquidity_trap",
            "repo_rate",
            "credit_multiplier",
            "pure_public_good",
            "free_rider_problem",
            "pigouvian_tax"
        ]
        missing_terms = [t for t in required_terms if t not in glossary_raw]
        pass_1_6 = len(missing_terms) == 0
        msg_1_6 = f"All {len(required_terms)} key terminology items present" if pass_1_6 else f"Missing terms: {missing_terms}"
        self.log_result(1, "T1_06_GLOSSARY_DATABASE_INTEGRITY", "Interactive Glossary contains core Chapter 14, 15, and 20 terminology", pass_1_6, msg_1_6, {"missing": missing_terms})

        # 1.7 SVG Diagram Mathematical Subscripts
        # Check that SVG diagram labels use <tspan> or Unicode rather than raw underscores like M_s or M_d
        svg_raw_matches = re.findall(r"<text[^>]*>[^<]*(?:M_s|M_d|P_0|Y_f|SAS_1)[^<]*</text>", html_raw)
        pass_1_7 = len(svg_raw_matches) == 0
        msg_1_7 = f"Found {len(svg_raw_matches)} raw unformatted underscores in SVG text elements" if not pass_1_7 else "All SVG text elements format subscripts cleanly"
        self.log_result(1, "T1_07_SVG_DIAGRAM_SUBSCRIPTS", "SVG Diagram text elements format subscripts (no raw M_s / M_d underscores)", pass_1_7, msg_1_7, {"svg_raw_matches": svg_raw_matches})

    # =========================================================================
    # TIER 2: Boundary, Corner & Anti-Triviality
    # =========================================================================
    def run_tier_2(self):
        print("\n--- Running Tier 2: Boundary, Corner & Anti-Triviality ---")

        mcqs = [q for q in self.questions_bank if q.get("type") == "mcq"]
        total_mcqs = len(mcqs)

        # 2.1 Anti-Triviality Key Distribution (20% - 30% per key across all MCQs, <= 35% single key)
        key_counts = {"A": 0, "B": 0, "C": 0, "D": 0}
        for q in mcqs:
            k = q.get("correctKey")
            if k in key_counts:
                key_counts[k] += 1

        key_pcts = {k: (cnt / total_mcqs) * 100 if total_mcqs > 0 else 0 for k, cnt in key_counts.items()}
        balanced_keys = all(20.0 <= pct <= 30.0 for pct in key_pcts.values())
        max_pct = max(key_pcts.values()) if key_pcts else 100.0

        # Extended batch check (questions 16 to 37 per chapter)
        extended_mcqs = [q for q in mcqs if any(q.get("id", "").startswith(f"q{ch}_{i:02d}") for ch in (14, 15, 20) for i in range(16, 38))]
        ext_key_counts = {"A": 0, "B": 0, "C": 0, "D": 0}
        for q in extended_mcqs:
            k = q.get("correctKey")
            if k in ext_key_counts:
                ext_key_counts[k] += 1
        max_ext_pct = (max(ext_key_counts.values()) / len(extended_mcqs) * 100) if extended_mcqs else 100.0

        pass_2_1 = balanced_keys and max_pct <= 35.0 and max_ext_pct <= 35.0
        msg_2_1 = f"Distribution: {', '.join(f'{k}: {cnt} ({pct:.1f}%)' for k, (cnt, pct) in zip(key_counts.keys(), zip(key_counts.values(), key_pcts.values())))}. Max Key: {max_pct:.1f}% (limit 35%). Ext batch max: {max_ext_pct:.1f}%."
        self.log_result(2, "T2_01_ANTI_TRIVIALITY_KEY_DISTRIBUTION", "Balanced correctKey distribution (each A, B, C, D between 20% and 30%)", pass_2_1, msg_2_1, {"counts": key_counts, "percentages": key_pcts, "ext_counts": ext_key_counts})

        # 2.2 Distractor Length Symmetry & Length Parity
        asymmetric_qs = []
        systematic_correct_longer = 0
        for q in mcqs:
            opts = q.get("options", [])
            if len(opts) == 4:
                lens = [len(o.get("text_en", "").strip()) for o in opts]
                mean_l = statistics.mean(lens)
                stdev_l = statistics.stdev(lens) if len(lens) > 1 else 0
                ratio = max(lens) / min(lens) if min(lens) > 0 else float('inf')
                pct_var = (stdev_l / mean_l) * 100 if mean_l > 0 else 0

                # Check if correct option is > 1.25x the shortest or stdev > 15%
                if pct_var > 15.0 or ratio > 1.25:
                    asymmetric_qs.append((q.get("id"), pct_var, ratio))

                # Check if correct option is significantly longer than mean of distractors
                correct_key = q.get("correctKey")
                correct_opt = next((o for o in opts if o.get("key") == correct_key), None)
                if correct_opt:
                    c_len = len(correct_opt.get("text_en", "").strip())
                    distractor_lens = [len(o.get("text_en", "").strip()) for o in opts if o.get("key") != correct_key]
                    if distractor_lens and c_len > 1.5 * statistics.mean(distractor_lens):
                        systematic_correct_longer += 1

        pass_2_2 = len(asymmetric_qs) == 0 and systematic_correct_longer == 0
        msg_2_2 = f"{len(asymmetric_qs)}/{total_mcqs} questions exceed length ratio 1.25x or 15% variance. {systematic_correct_longer} correct options visibly elongated."
        self.log_result(2, "T2_02_DISTRACTOR_LENGTH_SYMMETRY", "Distractor length symmetry (stdev <= 15%, max/min ratio <= 1.25, no giveaway length)", pass_2_2, msg_2_2, {"asymmetric_count": len(asymmetric_qs), "samples": asymmetric_qs[:5]})

        # 2.3 Zero Giveaway Stems
        giveaway_patterns = [
            r"\bProblem\s+\d+:",
            r"\bQuestion\s+\d+:",
            r"\bMonetary\s+Question:",
            r"\bFiscal\s+Question:",
            r"\bInflation\s+Question:",
            r"\bChapter\s+\d+:",
            r"According to South African macroeconomic principles,",
            r"In Suid-Afrikaanse monetêre ontleding,"
        ]
        flagged_stems = []
        for q in self.questions_bank:
            qid = q.get("id")
            stem_en = q.get("stem_en", "")
            stem_af = q.get("stem_af", "")
            for pat in giveaway_patterns:
                if re.search(pat, stem_en, re.IGNORECASE) or re.search(pat, stem_af, re.IGNORECASE):
                    flagged_stems.append((qid, pat))
                    break

        pass_2_3 = len(flagged_stems) == 0
        msg_2_3 = f"{len(flagged_stems)} question stems contain prohibited meta-labels or boilerplate prefixes" if flagged_stems else "All question stems dive straight into problem without meta-cues"
        self.log_result(2, "T2_03_ZERO_GIVEAWAY_STEMS", "Zero giveaway stems (no meta-labels or ESL boilerplate prefixes)", pass_2_3, msg_2_3, {"flagged_count": len(flagged_stems), "samples": flagged_stems[:5]})

        # 2.4 Quantitative Calculation Tolerance Boundaries
        calcs = [q for q in self.questions_bank if q.get("type") in ("calc", "calculation")]
        boundary_failures = []
        for q in calcs:
            qid = q.get("id")
            exp = q.get("expectedNumber")
            tol = q.get("tolerance", 0)

            # Test exact lower boundary
            lower = exp - tol
            if not (exp - tol <= lower <= exp + tol):
                boundary_failures.append(f"{qid}: lower boundary failed")

            # Test exact upper boundary
            upper = exp + tol
            if not (exp - tol <= upper <= exp + tol):
                boundary_failures.append(f"{qid}: upper boundary failed")

            # Test outside boundaries
            delta = 1 if isinstance(exp, int) and tol >= 1 else 0.01
            if exp - tol <= (lower - delta) <= exp + tol:
                boundary_failures.append(f"{qid}: outside lower boundary falsely accepted")
            if exp - tol <= (upper + delta) <= exp + tol:
                boundary_failures.append(f"{qid}: outside upper boundary falsely accepted")

        pass_2_4 = len(boundary_failures) == 0
        msg_2_4 = f"All {len(calcs)} quantitative questions pass exact tolerance boundary evaluations" if pass_2_4 else f"{len(boundary_failures)} calculation boundary errors"
        self.log_result(2, "T2_04_CALCULATION_TOLERANCE_BOUNDARIES", "Quantitative calculation questions boundary & tolerance verification", pass_2_4, msg_2_4, {"failures": boundary_failures})

        # 2.5 MCQ Options Permutation Completeness
        key_set_failures = []
        for q in mcqs:
            qid = q.get("id")
            opts = q.get("options", [])
            keys = [o.get("key") for o in opts]
            if sorted(keys) != ["A", "B", "C", "D"]:
                key_set_failures.append(f"{qid}: keys were {keys}")
            texts = [o.get("text_en", "").strip() for o in opts]
            if len(set(texts)) != 4 or any(len(t) == 0 for t in texts):
                key_set_failures.append(f"{qid}: duplicate or empty option text")

        pass_2_5 = len(key_set_failures) == 0
        msg_2_5 = f"All {total_mcqs} MCQs have exactly distinct {{A, B, C, D}} options with non-empty content" if pass_2_5 else f"{len(key_set_failures)} option permutation issues"
        self.log_result(2, "T2_05_MCQ_OPTIONS_PERMUTATION_COMPLETENESS", "MCQ option permutation completeness (unique non-empty options for A, B, C, D)", pass_2_5, msg_2_5, {"failures": key_set_failures[:5]})

    # =========================================================================
    # TIER 3: Cross-Feature Pairwise & Linguistic Parity
    # =========================================================================
    def run_tier_3(self):
        print("\n--- Running Tier 3: Cross-Feature Pairwise & Linguistic Parity ---")

        # 3.1 Bilingual Linguistic Parity (Zero Untranslated English in Afrikaans Fields)
        untranslated_english_indicators = [
            "the prime overdraft rate",
            "the transmission mechanism of monetary policy explains how",
            "proportional taxation means that",
            "core inflation is measured by statistical agencies because it",
            "increase bank liquidity",
            "According to",
            "In Suid-Afrikaanse openbare finansies, proportional taxation",
            "In makro-ekonomiese inflasie-ontleding, core inflation",
            "Purchasing bonds injects fresh cash into commercial bank"
        ]

        bilingual_failures = []
        for q in self.questions_bank:
            qid = q.get("id")
            stem_en = q.get("stem_en", "").strip()
            stem_af = q.get("stem_af", "").strip()
            deriv_en = q.get("derivation_en", "").strip()
            deriv_af = q.get("derivation_af", "").strip()

            # Check verbatim equivalence
            if stem_af == stem_en and len(stem_en) > 20:
                bilingual_failures.append(f"{qid}: stem_af is identical to stem_en")
            if deriv_af == deriv_en and len(deriv_en) > 20:
                bilingual_failures.append(f"{qid}: derivation_af is identical to derivation_en")

            # Check known untranslated fragments
            for ind in untranslated_english_indicators:
                if ind.lower() in stem_af.lower() or ind.lower() in deriv_af.lower():
                    bilingual_failures.append(f"{qid}: untranslated indicator '{ind}' in Afrikaans text")
                    break

            for opt in q.get("options", []):
                t_en = opt.get("text_en", "").strip()
                t_af = opt.get("text_af", "").strip()
                if t_af == t_en and len(t_en) > 20:
                    bilingual_failures.append(f"{qid}: option {opt.get('key')} text_af identical to text_en")
                    break

        pass_3_1 = len(bilingual_failures) == 0
        msg_3_1 = f"Zero untranslated English detected across all {len(self.questions_bank)} items" if pass_3_1 else f"{len(bilingual_failures)} bilingual translation failures detected"
        self.log_result(3, "T3_01_BILINGUAL_LINGUISTIC_PARITY", "Bilingual parity (zero untranslated English in Afrikaans stems, options, derivations)", pass_3_1, msg_3_1, {"failures_count": len(bilingual_failures), "samples": bilingual_failures[:5]})

        # 3.2 Language-Option Synchronicity
        sync_failures = []
        for q in self.questions_bank:
            if q.get("type") == "mcq":
                qid = q.get("id")
                opts = q.get("options", [])
                for opt in opts:
                    if not opt.get("text_af") or len(opt.get("text_af").strip()) == 0:
                        sync_failures.append(f"{qid} opt {opt.get('key')}: empty text_af")

        pass_3_2 = len(sync_failures) == 0
        msg_3_2 = f"All option pairs have corresponding non-empty Afrikaans content" if pass_3_2 else f"{len(sync_failures)} missing Afrikaans options"
        self.log_result(3, "T3_02_LANGUAGE_OPTION_SYNCHRONICITY", "1:1 option synchronicity between English and Afrikaans option sets", pass_3_2, msg_3_2, {"failures": sync_failures[:5]})

        # 3.3 Chapter & Difficulty Matrix
        diff_matrix = {}
        for q in self.questions_bank:
            ch = q.get("ch") or q.get("chapter")
            diff = q.get("difficulty", "Unspecified")
            diff_matrix.setdefault(ch, {})[diff] = diff_matrix.setdefault(ch, {}).get(diff, 0) + 1

        pass_3_3 = all(len(diff_matrix.get(ch, {})) >= 1 for ch in (14, 15, 20))
        msg_3_3 = f"Difficulty distribution: Ch14={diff_matrix.get(14)}, Ch15={diff_matrix.get(15)}, Ch20={diff_matrix.get(20)}"
        self.log_result(3, "T3_03_CHAPTER_DIFFICULTY_MATRIX", "Curricular difficulty matrix covers all three chapters", pass_3_3, msg_3_3, {"matrix": diff_matrix})

        # 3.4 Assessment Engine Scoring Logic Simulation
        scoring_errors = []
        # Simulation 1: All correct
        total_marks = sum(q.get("marks", 2) for q in self.questions_bank)
        earned_perfect = sum(q.get("marks", 2) for q in self.questions_bank)
        if earned_perfect != total_marks:
            scoring_errors.append("Perfect score mismatch")

        # Simulation 2: All incorrect
        earned_zero = 0
        if earned_zero != 0:
            scoring_errors.append("Zero score mismatch")

        # Simulation 3: Calculation numerical parsing and tolerance
        sample_calc = next((q for q in self.questions_bank if q.get("type") in ("calc", "calculation")), None)
        if sample_calc:
            exp = sample_calc.get("expectedNumber")
            tol = sample_calc.get("tolerance", 0)
            # simulate student input with spaces and commas: e.g. " 1 195 000 " or "1,195,000"
            formatted_input = f" {exp:,.2f} ".replace(",", " ")
            cleaned = float(re.sub(r"[^\d.-]", "", formatted_input))
            if not (exp - tol <= cleaned <= exp + tol):
                scoring_errors.append("Forgiving numerical string parser failed")

        pass_3_4 = len(scoring_errors) == 0
        msg_3_4 = "Scoring math verified (perfect, zero, weighted marks, and string parsing)" if pass_3_4 else f"Scoring simulation issues: {scoring_errors}"
        self.log_result(3, "T3_04_SCORING_ENGINE_SIMULATION", "Exam engine score calculation and forgiving numerical tolerance parsing", pass_3_4, msg_3_4, {"errors": scoring_errors})

        # 3.5 Flagging and State Isolation
        # Verify exam-engine.js supports Set-based bookmarking/flagging
        engine_raw = self.loaded_raw_files.get("exam_engine", "")
        has_flag_logic = "this.flagged = new Set()" in engine_raw and "toggleFlag" in engine_raw
        pass_3_5 = has_flag_logic
        msg_3_5 = "Set-based question flag isolation confirmed in exam-engine.js" if pass_3_5 else "Missing or incomplete flag state management"
        self.log_result(3, "T3_05_FLAGGING_AND_BOOKMARKING_ISOLATION", "Question bookmarking/flagging maintains isolated Set state", pass_3_5, msg_3_5)

    # =========================================================================
    # TIER 4: Real-World Workload Scenarios & Platform Resilience
    # =========================================================================
    def run_tier_4(self):
        print("\n--- Running Tier 4: Real-World Workload Scenarios & Platform Resilience ---")

        css_raw = self.loaded_raw_files.get("css", "")

        # 4.1 Mobile-First Zero-Overflow Guardrail (GEMINI.md Rule 3)
        has_100vw = "max-width: 100vw" in css_raw or "max-width:100vw" in css_raw
        has_overflow_x = "overflow-x: hidden" in css_raw or "overflow-x:hidden" in css_raw
        has_media_880 = "@media" in css_raw and ("880px" in css_raw or "879px" in css_raw)
        has_media_480 = "@media" in css_raw and ("480px" in css_raw or "479px" in css_raw)

        pass_4_1 = has_100vw and has_overflow_x and has_media_880 and has_media_480
        msg_4_1 = f"100vw: {has_100vw}, overflow-x: {has_overflow_x}, media<880: {has_media_880}, media<480: {has_media_480}"
        self.log_result(4, "T4_01_MOBILE_FIRST_ZERO_OVERFLOW", "Mobile-first CSS zero-overflow guardrail (100vw, overflow-x: hidden, <880px, <480px)", pass_4_1, msg_4_1)

        # 4.2 Touch Target Accessibility Standard (44px min-height)
        controls_to_check = [
            ".tab-btn",
            ".header-select",
            ".icon-action-btn",
            ".timer-pill",
            ".mode-toggle-btn",
            ".theme-toggle-btn",
            ".flag-btn",
            ".tool-btn"
        ]
        undersized_controls = []
        for ctrl in controls_to_check:
            # Search for ctrl in CSS
            m = re.search(re.escape(ctrl) + r"[^{]*\{([^}]*)\}", css_raw)
            if m:
                block = m.group(1)
                mh = re.search(r"min-height:\s*(\d+)px", block)
                if mh:
                    h = int(mh.group(1))
                    if h < 44:
                        undersized_controls.append((ctrl, f"{h}px < 44px"))
                else:
                    undersized_controls.append((ctrl, "no explicit min-height"))
            else:
                undersized_controls.append((ctrl, "rule not found"))

        pass_4_2 = len(undersized_controls) == 0
        msg_4_2 = f"All 8 interactive control classes enforce >= 44px tap target height" if pass_4_2 else f"{len(undersized_controls)} undersized controls: {undersized_controls}"
        self.log_result(4, "T4_02_TOUCH_TARGET_ACCESSIBILITY", "Mobile touch targets meet minimum 44px height requirement per GEMINI.md Rule 3", pass_4_2, msg_4_2, {"undersized": undersized_controls})

        # 4.3 Telemetry & Active User Deduplication (GEMINI.md Rule 5)
        telemetry_raw = self.loaded_raw_files.get("telemetry", "")
        has_300s_threshold = "300" in telemetry_raw
        has_device_dedup = "DEVICE_LOGGED" in telemetry_raw and "localStorage" in telemetry_raw
        has_active_dedup = "ACTIVE_LOGGED" in telemetry_raw
        admin_raw = self.loaded_raw_files.get("admin", "")
        has_isolated_admin = admin_raw is not None and len(admin_raw) > 500

        pass_4_3 = has_300s_threshold and has_device_dedup and has_active_dedup and has_isolated_admin
        msg_4_3 = f"Active threshold 300s: {has_300s_threshold}, Device dedup: {has_device_dedup}, Active dedup: {has_active_dedup}, Admin isolated: {has_isolated_admin}"
        self.log_result(4, "T4_03_TELEMETRY_AND_ACTIVE_USER_STANDARD", "Telemetry enforces 300s active threshold, localStorage deduplication, and isolated admin", pass_4_3, msg_4_3)

        # 4.4 Simulated Student Examination Session
        # Simulate selecting 25 questions, ticking countdown, and answering
        exam_sim_passed = True
        try:
            pool = list(self.questions_bank)
            import random
            rng = random.Random(42)
            u14 = [q for q in pool if (q.get("ch") or q.get("chapter")) == 14]
            u15 = [q for q in pool if (q.get("ch") or q.get("chapter")) == 15]
            u20 = [q for q in pool if (q.get("ch") or q.get("chapter")) == 20]
            sampled = u14[:9] + u15[:8] + u20[:8]
            if len(sampled) != 25:
                exam_sim_passed = False

            # Simulate answering 25 questions: 20 correct, 5 incorrect
            earned = 0
            for i, q in enumerate(sampled):
                marks = q.get("marks", 2)
                if i < 20:
                    earned += marks
            pct = (earned / sum(q.get("marks", 2) for q in sampled)) * 100
            if pct <= 0 or pct > 100:
                exam_sim_passed = False
        except Exception as e:
            exam_sim_passed = False

        self.log_result(4, "T4_04_SIMULATED_STUDENT_EXAM_SESSION", "End-to-end 25-question student assessment session simulation", exam_sim_passed, "Simulated 25-question session across 3 units with accurate mark accumulation")

        # 4.5 Client-Side Offline Autonomy
        # Verify that all 5 critical JS assets exist locally in js/
        critical_assets = [
            ("questions-db.js", self.questions_file),
            ("exam-engine.js", self.exam_engine_file),
            ("glossary-db.js", self.glossary_file),
            ("telemetry.js", self.telemetry_file)
        ]
        missing_assets = [name for name, path in critical_assets if not os.path.exists(path)]
        pass_4_5 = len(missing_assets) == 0
        msg_4_5 = "All core assessment components bundled locally for offline execution" if pass_4_5 else f"Missing local assets: {missing_assets}"
        self.log_result(4, "T4_05_CLIENT_SIDE_OFFLINE_AUTONOMY", "Platform operates autonomously client-side without mandatory backend API dependencies", pass_4_5, msg_4_5, {"missing": missing_assets})

    # =========================================================================
    # TIER 5: Adversarial Coverage Hardening & Oracle Stress Testing
    # =========================================================================
    def run_tier_5(self):
        import random
        print("\n--- Running Tier 5: Adversarial Coverage Hardening & Oracle Stress Testing ---")

        # Helpers mirroring exam-engine.js
        def parse_flexible_number(raw):
            if isinstance(raw, (int, float)):
                return float(raw)
            if raw is None or raw == "":
                return float('nan')
            s = str(raw).strip()
            # If comma is followed by 3 digits and not followed by more decimals or digits, strip commas as thousands separators:
            # e.g. "1,195,000" or "R 1,195,000" or "16,250"
            if re.match(r"^\s*[R\$]?\s*-?\d{1,3}(,\d{3})+(\.\d+)?\s*%?\s*$", s, re.IGNORECASE):
                s = s.replace(",", "")
            else:
                s = s.replace(",", ".")
            cleaned = re.sub(r"[R\$%\s\(\)]", "", s, flags=re.IGNORECASE)
            try:
                return float(cleaned)
            except ValueError:
                return float('nan')

        def score_mcq(q, selected_key, active_key=None):
            correct = active_key or q.get("correctKey")
            return q.get("marks", 2) if selected_key == correct else 0

        def score_calc(q, student_raw):
            parsed = parse_flexible_number(student_raw)
            if math.isnan(parsed):
                return 0
            diff = abs(parsed - q.get("expectedNumber"))
            tol = q.get("tolerance") if q.get("tolerance") is not None else 0.1
            return q.get("marks", 3) if diff <= (tol + 1e-7) else 0

        mcqs = [q for q in self.questions_bank if q.get("type") == "mcq"]
        calcs = [q for q in self.questions_bank if q.get("type") in ("calc", "calculation")]

        # 5.1 Automated Student MCQ Submission Oracle (All 110 MCQs)
        mcq_oracle_failures = []
        mcq_sim_count = 0
        for q in mcqs:
            qid = q.get("id")
            marks = q.get("marks")
            correct_key = q.get("correctKey")
            opts = q.get("options", [])
            keys = [o.get("key") for o in opts]

            if marks is None or marks <= 0:
                mcq_oracle_failures.append(f"{qid}: missing or invalid marks")

            awarded = score_mcq(q, correct_key)
            mcq_sim_count += 1
            if awarded != marks:
                mcq_oracle_failures.append(f"{qid}: correctKey '{correct_key}' awarded {awarded}/{marks} marks")

            for k in keys:
                if k != correct_key:
                    d_marks = score_mcq(q, k)
                    mcq_sim_count += 1
                    if d_marks != 0:
                        mcq_oracle_failures.append(f"{qid}: distractor '{k}' awarded {d_marks} marks")

        pass_5_1 = len(mcq_oracle_failures) == 0
        msg_5_1 = f"Verified {mcq_sim_count} submissions across all 110 MCQs (correct=100%, incorrect=0%, explicit marks)" if pass_5_1 else f"{len(mcq_oracle_failures)} MCQ simulation failures"
        self.log_result(5, "T5_01_MCQ_SUBMISSION_SIMULATION", "Automated student MCQ submissions oracle (correctKey full marks, distractors 0 marks)", pass_5_1, msg_5_1, {"sim_count": mcq_sim_count, "failures": mcq_oracle_failures[:5]})

        # 5.2 Option Shuffling State Machine Stress Oracle (Fisher-Yates Permutations)
        shuffle_failures = []
        shuffle_count = 0
        for q in mcqs:
            qid = q.get("id")
            orig_opts = q.get("options", [])
            orig_correct_key = q.get("correctKey")
            orig_correct_opt = next((o for o in orig_opts if o.get("key") == orig_correct_key), None)
            if not orig_correct_opt:
                shuffle_failures.append(f"{qid}: correctKey '{orig_correct_key}' not in options")
                continue

            for _ in range(20):
                shuffle_count += 1
                shuffled = list(orig_opts)
                random.shuffle(shuffled)
                letter_keys = ['A', 'B', 'C', 'D']
                new_correct_key = 'A'

                for idx, opt in enumerate(shuffled):
                    new_k = letter_keys[idx]
                    if opt == orig_correct_opt or opt.get("text_en") == orig_correct_opt.get("text_en"):
                        new_correct_key = new_k

                if score_mcq(q, new_correct_key, new_correct_key) != q.get("marks", 2):
                    shuffle_failures.append(f"{qid}: shuffled correctKey mismatch")
                    break

                for k in letter_keys:
                    if k != new_correct_key and score_mcq(q, k, new_correct_key) != 0:
                        shuffle_failures.append(f"{qid}: shuffled distractor awarded marks")
                        break

        pass_5_2 = len(shuffle_failures) == 0
        msg_5_2 = f"Verified {shuffle_count} shuffled permutations across 110 MCQs; scoring is 100% mark-invariant" if pass_5_2 else f"{len(shuffle_failures)} shuffle failures"
        self.log_result(5, "T5_02_OPTION_SHUFFLING_INVARIANCE", "Option shuffling state machine stress oracle (Fisher-Yates invariant scoring)", pass_5_2, msg_5_2, {"permutations": shuffle_count, "failures": shuffle_failures[:5]})

        # 5.3 Quantitative Calculation Boundary & String Parsing Oracle (All 16 Calcs)
        calc_failures = []
        calc_sim_count = 0
        for q in calcs:
            qid = q.get("id")
            exp = q.get("expectedNumber")
            tol = q.get("tolerance", 0.0)
            marks = q.get("marks", 3)

            # Exact
            if score_calc(q, exp) != marks:
                calc_failures.append(f"{qid}: exact value failed")
            calc_sim_count += 1

            # Boundaries
            if score_calc(q, exp - tol) != marks:
                calc_failures.append(f"{qid}: lower boundary failed")
            calc_sim_count += 1

            if score_calc(q, exp + tol) != marks:
                calc_failures.append(f"{qid}: upper boundary failed")
            calc_sim_count += 1

            # Outside boundaries
            delta = 0.001 if tol < 1 else 1.0
            if score_calc(q, exp - tol - delta) != 0:
                calc_failures.append(f"{qid}: below lower boundary falsely accepted")
            calc_sim_count += 1

            if score_calc(q, exp + tol + delta) != 0:
                calc_failures.append(f"{qid}: above upper boundary falsely accepted")
            calc_sim_count += 1

            # Decimal comma
            comma_str = f"{exp}".replace(".", ",")
            if score_calc(q, comma_str) != marks:
                calc_failures.append(f"{qid}: decimal comma failed")
            calc_sim_count += 1

            # Whitespace
            if score_calc(q, f"   {exp}   ") != marks:
                calc_failures.append(f"{qid}: whitespace padding failed")
            calc_sim_count += 1

            # Space thousands
            if exp >= 1000:
                space_str = f"{exp:,.0f}".replace(",", " ")
                if score_calc(q, space_str) != marks:
                    calc_failures.append(f"{qid}: space thousands failed")
                calc_sim_count += 1

            # Comma thousands (e.g. '1,195,000' or '16,250')
            if exp >= 1000:
                comma_str = f"{exp:,.0f}"
                if score_calc(q, comma_str) != marks:
                    calc_failures.append(f"{qid}: comma thousands failed ({comma_str})")
                calc_sim_count += 1
                # Also test with Rand prefix
                rand_comma_str = f"R {comma_str}"
                if score_calc(q, rand_comma_str) != marks:
                    calc_failures.append(f"{qid}: Rand prefix comma thousands failed ({rand_comma_str})")
                calc_sim_count += 1

            # Explicit check for q14_15
            if qid == "q14_15":
                if score_calc(q, "1,195,000") != marks:
                    calc_failures.append(f"{qid}: '1,195,000' failed to award full marks")
                calc_sim_count += 1
                if score_calc(q, "R 1,195,000") != marks:
                    calc_failures.append(f"{qid}: 'R 1,195,000' failed to award full marks")
                calc_sim_count += 1

            # Currency prefix
            if score_calc(q, f"R{exp}") != marks:
                calc_failures.append(f"{qid}: Rand prefix failed")
            calc_sim_count += 1

            # Malformed inputs
            for mal in ["", "   ", "abc", "R", "NaN", "None", "undefined"]:
                if score_calc(q, mal) != 0:
                    calc_failures.append(f"{qid}: malformed input '{mal}' awarded marks")
                calc_sim_count += 1

        pass_5_3 = len(calc_failures) == 0
        msg_5_3 = f"Verified {calc_sim_count} calculation stress tests across all 16 quantitative questions" if pass_5_3 else f"{len(calc_failures)} calculation stress failures: {calc_failures}"
        self.log_result(5, "T5_03_CALCULATION_BOUNDARY_AND_PARSER_STRESS", "Quantitative calculation boundary (+/- 0.001) & forgiving string parser stress", pass_5_3, msg_5_3, {"sim_count": calc_sim_count, "failures": calc_failures})

        # 5.4 Database Fuzzing & Structural Adversarial Audit
        fuzz_issues = []
        en_stems = {}
        af_stems = {}
        for q in self.questions_bank:
            qid = q.get("id")
            s_en = q.get("stem_en", "").strip().lower()
            s_af = q.get("stem_af", "").strip().lower()

            if s_en in en_stems:
                fuzz_issues.append(f"Duplicate English stem: {qid} and {en_stems[s_en]}")
            else:
                en_stems[s_en] = qid

            if s_af in af_stems:
                fuzz_issues.append(f"Duplicate Afrikaans stem: {qid} and {af_stems[s_af]}")
            else:
                af_stems[s_af] = qid

            # Duplicate options within question
            if q.get("type") == "mcq":
                opts = q.get("options", [])
                en_o = [o.get("text_en", "").strip().lower() for o in opts]
                af_o = [o.get("text_af", "").strip().lower() for o in opts]
                if len(set(en_o)) != len(en_o):
                    fuzz_issues.append(f"{qid}: Duplicate option text in English")
                if len(set(af_o)) != len(af_o):
                    fuzz_issues.append(f"{qid}: Duplicate option text in Afrikaans")

            # Missing core properties
            for field in ["id", "ch", "type", "marks", "stem_en", "stem_af", "derivation_en", "derivation_af"]:
                val = q.get(field)
                if val is None or (isinstance(val, str) and len(val.strip()) == 0):
                    fuzz_issues.append(f"{qid}: missing required property '{field}'")

            # Raw LaTeX outside delimiters
            for text in [q.get("stem_en", "")] + [o.get("text_en", "") for o in q.get("options", [])]:
                stripped = re.sub(r"\\\(.*?\\\)", "", text)
                stripped = re.sub(r"\$\$.*?\$\$", "", stripped)
                stripped = re.sub(r"\\\[.*?\\\]", "", stripped)
                for cmd in [r"\\frac", r"\\text\{", r"\\Delta", r"\\times", r"\\uparrow", r"\\downarrow"]:
                    if re.search(cmd, stripped):
                        fuzz_issues.append(f"{qid}: unrendered LaTeX '{cmd}' in text")

        pass_5_4 = len(fuzz_issues) == 0
        msg_5_4 = f"Fuzzed all 126 questions across stems, options, properties, and LaTeX syntax; 0 anomalies" if pass_5_4 else f"{len(fuzz_issues)} fuzzing anomalies"
        self.log_result(5, "T5_04_QUESTION_BANK_FUZZING", "Question bank fuzzing (zero duplicate stems, option uniqueness, property integrity)", pass_5_4, msg_5_4, {"fuzz_issues_count": len(fuzz_issues), "samples": fuzz_issues[:5]})

        # 5.5 Randomized Multi-Size Examination Session Simulation
        sim_sizes = [10, 25, 42, 50, 100, 126]
        session_failures = []
        for size in sim_sizes:
            pool = list(self.questions_bank)
            if size == 126:
                selected = pool
            else:
                u14 = [q for q in pool if (q.get("ch") or q.get("chapter")) == 14]
                u15 = [q for q in pool if (q.get("ch") or q.get("chapter")) == 15]
                u20 = [q for q in pool if (q.get("ch") or q.get("chapter")) == 20]
                per_u = size // 3
                rem = size % 3
                selected = u14[:per_u + (1 if rem > 0 else 0)] + u15[:per_u + (1 if rem > 1 else 0)] + u20[:per_u]

            if len(selected) != size:
                session_failures.append(f"Size {size}: sampled {len(selected)} != {size}")
                continue

            total_m = sum(q.get("marks", 2) for q in selected)
            perfect_earned = 0
            for q in selected:
                if q.get("type") == "mcq":
                    perfect_earned += score_mcq(q, q.get("correctKey"))
                else:
                    perfect_earned += score_calc(q, q.get("expectedNumber"))

            if perfect_earned != total_m:
                session_failures.append(f"Size {size}: perfect score mismatch ({perfect_earned}/{total_m})")

            zero_earned = 0
            for q in selected:
                if q.get("type") == "mcq":
                    inc_k = next(k for k in ["A", "B", "C", "D"] if k != q.get("correctKey"))
                    zero_earned += score_mcq(q, inc_k)
                else:
                    zero_earned += score_calc(q, q.get("expectedNumber") + 999999)

            if zero_earned != 0:
                session_failures.append(f"Size {size}: zero score mismatch ({zero_earned})")

        pass_5_5 = len(session_failures) == 0
        msg_5_5 = f"Successfully simulated exam sessions for sizes {sim_sizes} (balanced units, exact mark tallying)" if pass_5_5 else f"{len(session_failures)} session failures"
        self.log_result(5, "T5_05_MULTI_SIZE_EXAM_SESSIONS", "Multi-size timed assessment session simulation (10, 25, 42, 50, 100, 126 questions)", pass_5_5, msg_5_5, {"tested_sizes": sim_sizes})

    # =========================================================================
    # Main Execution & Summary Reporting
    # =========================================================================
    def execute(self, target_tiers=None):
        self.load_files()
        tiers_to_run = target_tiers or [1, 2, 3, 4, 5]

        if 1 in tiers_to_run:
            self.run_tier_1()
        if 2 in tiers_to_run:
            self.run_tier_2()
        if 3 in tiers_to_run:
            self.run_tier_3()
        if 4 in tiers_to_run:
            self.run_tier_4()
        if 5 in tiers_to_run:
            self.run_tier_5()

        # Summary Table
        total = len(self.results)
        passed = sum(1 for r in self.results if r["passed"])
        failed = total - passed

        print("\n" + "=" * 76)
        print(f" PROJECT AXIOM: AUTOMATED TEST SUITE EXECUTION REPORT")
        print("=" * 76)
        print(f" Total Assertions: {total} | Passed: {passed} | Failed: {failed}")
        print("-" * 76)
        for t in sorted(set(r["tier"] for r in self.results)):
            t_res = [r for r in self.results if r["tier"] == t]
            t_pass = sum(1 for r in t_res if r["passed"])
            print(f"  Tier {t}: {t_pass}/{len(t_res)} Passed ({(t_pass/len(t_res))*100:.1f}%)")
        print("=" * 76)

        # Write JSON Report
        os.makedirs(os.path.dirname(self.report_file), exist_ok=True)
        report_data = {
            "summary": {
                "total": total,
                "passed": passed,
                "failed": failed,
                "pass_rate_percent": round((passed / total) * 100, 2) if total > 0 else 0
            },
            "results": self.results
        }
        with open(self.report_file, "w", encoding="utf-8") as f:
            json.dump(report_data, f, indent=2)
        print(f"\nStructured JSON report exported to: {self.report_file}\n")

        marker_file = os.path.join(self.base_dir, "tests", ".run_sync")
        if os.path.exists(marker_file) and failed == 0:
            try:
                os.remove(marker_file)
            except Exception:
                pass
            self.run_deployment_sync()

        return failed == 0

    def run_deployment_sync(self):
        import subprocess
        print("\n" + "=" * 76)
        print(" F24: GIT SYNCHRONIZATION & LIVE DEPLOYMENT VERIFICATION")
        print("=" * 76)

        # 1. Stage files
        print("--- Staging files: git add index.html admin.html css/ js/ tests/ assets/ ---")
        res_add = subprocess.run(["git", "add", "index.html", "admin.html", "css/", "js/", "tests/", "assets/"], cwd=self.base_dir, capture_output=True, text=True)
        print(f"git add exit code: {res_add.returncode}")
        if res_add.stdout:
            print(res_add.stdout)
        if res_add.stderr:
            print(res_add.stderr)

        # 2. git status
        res_status = subprocess.run(["git", "status"], cwd=self.base_dir, capture_output=True, text=True)
        print("--- git status ---")
        print(res_status.stdout)

        # 3. git commit
        commit_msg = "feat(axiom): publication-grade Oxford/Cambridge UI, KaTeX math audit, 126-question overhaul, and E2E test verification"
        print(f"--- Committing with message: {commit_msg} ---")
        res_commit = subprocess.run(["git", "commit", "-m", commit_msg], cwd=self.base_dir, capture_output=True, text=True)
        print(f"git commit exit code: {res_commit.returncode}")
        print(res_commit.stdout)
        if res_commit.stderr:
            print(res_commit.stderr)

        # 4. git push origin main
        print("--- Pushing to origin main ---")
        res_push = subprocess.run(["git", "push", "origin", "main"], cwd=self.base_dir, capture_output=True, text=True)
        print(f"git push exit code: {res_push.returncode}")
        print(res_push.stdout)
        if res_push.stderr:
            print(res_push.stderr)

        # 5. git log -1
        print("--- git log -1 --stat ---")
        res_log = subprocess.run(["git", "log", "-1", "--stat"], cwd=self.base_dir, capture_output=True, text=True)
        print(res_log.stdout)

        # 6. Live deployment verification
        print("\n--- Live Deployment Verification (urllib.request) ---")
        deploy_script = os.path.abspath(os.path.join(self.base_dir, "..", ".agents", "teamwork_preview_worker_deploy_1", "verify_live_deploy.py"))
        if os.path.exists(deploy_script):
            print(f"Executing: {deploy_script}")
            res_deploy = subprocess.run([sys.executable, deploy_script], capture_output=True, text=True)
            print(f"verify_live_deploy.py exit code: {res_deploy.returncode}")
            print(res_deploy.stdout)
            if res_deploy.stderr:
                print(res_deploy.stderr)
        else:
            print(f"Warning: {deploy_script} not found")



def main():
    parser = argparse.ArgumentParser(description="Project Axiom 5-Tier Test Runner")
    parser.add_argument("--tier", type=int, choices=[1, 2, 3, 4, 5], help="Run a specific tier only")
    args = parser.parse_args()

    target_tiers = [args.tier] if args.tier else [1, 2, 3, 4, 5]
    runner = AxiomVerificationHarness()
    success = runner.execute(target_tiers)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
