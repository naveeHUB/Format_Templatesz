// services/FormulaResolver.js
// ─────────────────────────────────────────────────────────────────────────────
// Resolves formula-column dependencies against the current field mappings and
// computes per-row values.  Uses a tiny recursive-descent expression evaluator
// instead of eval() for safety.
// ─────────────────────────────────────────────────────────────────────────────

// ── Safe arithmetic expression evaluator ─────────────────────────────────────
class ExpressionEvaluator {
    /**
     * Replace column-letter tokens (e.g. B, C) with their numeric values,
     * then parse and evaluate the resulting arithmetic expression.
     * @param {string} formula  Raw Excel formula string e.g. "=B2*C2"
     * @param {Object} vars     Map of column-letter → numeric value  { B: 10, C: 5 }
     * @returns {number}
     */
    evaluate(formula, vars) {
        // Remove leading '='
        let expr = formula.startsWith('=') ? formula.slice(1) : formula;

        // Replace column-letter+row-number tokens with their resolved values
        expr = expr.replace(/([A-Z]+)\d+/g, (_, colLetter) => {
            const v = vars[colLetter];
            return (v !== undefined && v !== null && !isNaN(v)) ? String(v) : '0';
        });

        this.tokens = this._tokenize(expr);
        this.pos = 0;
        const result = this._parseExpr();
        return isNaN(result) ? 0 : result;
    }

    _tokenize(expr) {
        const tokens = [];
        let i = 0;
        while (i < expr.length) {
            const ch = expr[i];
            if (/\s/.test(ch)) { i++; continue; }
            if (/[0-9.]/.test(ch)) {
                let num = '';
                while (i < expr.length && /[0-9.]/.test(expr[i])) num += expr[i++];
                tokens.push({ t: 'NUM', v: parseFloat(num) });
            } else if (ch === '+') { tokens.push({ t: 'ADD' }); i++; }
            else if (ch === '-') { tokens.push({ t: 'SUB' }); i++; }
            else if (ch === '*') { tokens.push({ t: 'MUL' }); i++; }
            else if (ch === '/') { tokens.push({ t: 'DIV' }); i++; }
            else if (ch === '(') { tokens.push({ t: 'LP'  }); i++; }
            else if (ch === ')') { tokens.push({ t: 'RP'  }); i++; }
            else { i++; } // ignore unknown chars
        }
        return tokens;
    }

    // expr → term ((+ | -) term)*
    _parseExpr() {
        let left = this._parseTerm();
        while (this.pos < this.tokens.length) {
            const t = this.tokens[this.pos];
            if (t.t === 'ADD') { this.pos++; left = left + this._parseTerm(); }
            else if (t.t === 'SUB') { this.pos++; left = left - this._parseTerm(); }
            else break;
        }
        return left;
    }

    // term → factor ((* | /) factor)*
    _parseTerm() {
        let left = this._parseFactor();
        while (this.pos < this.tokens.length) {
            const t = this.tokens[this.pos];
            if (t.t === 'MUL') { this.pos++; left = left * this._parseFactor(); }
            else if (t.t === 'DIV') {
                this.pos++;
                const right = this._parseFactor();
                left = right !== 0 ? left / right : 0;
            } else break;
        }
        return left;
    }

    // factor → NUM | '(' expr ')' | '-' factor
    _parseFactor() {
        if (this.pos >= this.tokens.length) return 0;
        const t = this.tokens[this.pos];
        if (t.t === 'LP') {
            this.pos++;
            const v = this._parseExpr();
            if (this.pos < this.tokens.length && this.tokens[this.pos].t === 'RP') this.pos++;
            return v;
        }
        if (t.t === 'SUB') { this.pos++; return -this._parseFactor(); }
        if (t.t === 'NUM') { this.pos++; return t.v; }
        return 0;
    }
}

// ── FormulaResolver ───────────────────────────────────────────────────────────
class FormulaResolver {
    constructor() {
        this._evaluator = new ExpressionEvaluator();
    }

    // ── 1. Analyse which formula columns can be auto-resolved ─────────────────
    /**
     * @param {Array}  formulaColumns  Array of formulaColumn objects from templateStructure
     * @param {Object} mappings        { sourceField: templateField }
     * @returns {{ autoResolved: Array, needsUserInput: Array }}
     */
    analyzeResolution(formulaColumns, mappings) {
        const autoResolved = [];
        const needsUserInput = [];

        // Build a set of all template fields that are already mapped
        const mappedTemplateFields = new Set(Object.values(mappings));

        for (const fc of formulaColumns) {
            if (!fc.isSimpleArithmetic) {
                // Complex formula (VLOOKUP, IF, etc.) — always ask user
                needsUserInput.push({
                    ...fc,
                    unresolvedVars: fc.formulaDependencies.map(d => d.headerName),
                    reason: 'complex_formula'
                });
                continue;
            }

            const unresolvedVars = [];
            for (const dep of fc.formulaDependencies) {
                const name = dep.headerName;
                // Resolved if the template field is already covered by a mapping
                // OR if a source field has exactly that name
                const isMapped = mappedTemplateFields.has(name);
                const isDirectSource = Object.keys(mappings).includes(name);
                if (!isMapped && !isDirectSource) {
                    unresolvedVars.push(name);
                }
            }

            if (unresolvedVars.length === 0) {
                autoResolved.push(fc);
            } else {
                needsUserInput.push({ ...fc, unresolvedVars });
            }
        }

        return { autoResolved, needsUserInput };
    }

    // ── 2. Compute the numeric value for one formula column on one data row ────
    /**
     * @param {Object} formulaColumn   A formulaColumn descriptor
     * @param {Object} sourceRowData   Raw source row  { sourceField: value, … }
     * @param {Object} mappings        { sourceField: templateField }
     * @param {Object} userResolutions { headerName: { type:'column'|'constant', value } }
     * @returns {number}
     */
    computeValue(formulaColumn, sourceRowData, mappings, userResolutions = {}) {
        const vars = {};

        // Build reverse map: templateField → sourceField
        const reverseMap = {};
        for (const [src, tgt] of Object.entries(mappings)) {
            reverseMap[tgt] = src;
        }

        for (const dep of formulaColumn.formulaDependencies) {
            const { columnLetter, headerName } = dep;
            let value = 0;

            if (userResolutions[headerName]) {
                // User-provided binding takes highest priority
                const res = userResolutions[headerName];
                if (res.type === 'constant') {
                    value = parseFloat(res.value) || 0;
                } else if (res.type === 'column') {
                    value = parseFloat(sourceRowData[res.value]) || 0;
                }
            } else if (reverseMap[headerName]) {
                // Auto-resolved: template field is mapped from a source field
                value = parseFloat(sourceRowData[reverseMap[headerName]]) || 0;
            } else if (sourceRowData[headerName] !== undefined) {
                // Source field shares the exact same name as the template dependency
                value = parseFloat(sourceRowData[headerName]) || 0;
            }

            vars[columnLetter] = value;
        }

        try {
            return this._evaluator.evaluate(formulaColumn.formulaTemplate, vars);
        } catch (e) {
            return 0;
        }
    }

    // ── 3. Re-build an Excel formula string adjusted for a specific row ────────
    /**
     * e.g. formulaTemplate "=B2*C2", targetRow 5  →  "=B5*C5"
     * @param {string} formulaTemplate
     * @param {number} targetRowNum
     * @returns {string}
     */
    buildExcelFormula(formulaTemplate, targetRowNum) {
        return formulaTemplate.replace(/([A-Z]+)\d+/g, (_, colLetter) => {
            return `${colLetter}${targetRowNum}`;
        });
    }
}

module.exports = new FormulaResolver();
