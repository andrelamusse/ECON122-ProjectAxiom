/**
 * Project Axiom — Mathematical Typesetting Engine
 * Centralized KaTeX Rendering Manager
 * 
 * Provides unified delimiter management, asynchronous asset loading queue,
 * dynamic modal lifecycle hooks, and safe error suppression.
 */
(function(global) {
  'use strict';

  // Prevent re-initialization if already loaded
  if (global.AxiomMath && global.AxiomMath._initialized) {
    return;
  }

  var AxiomMath = {
    _initialized: true,
    isReady: false,
    queue: [],
    callbacks: [],
    _pollTimer: null,

    // Standardized KaTeX delimiter configurations
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '\\(', right: '\\)', display: false },
      { left: '\\[', right: '\\]', display: true },
      { left: '$', right: '$', display: false }
    ],

    /**
     * Initializes the AxiomMath engine.
     * Queues callback to execute once KaTeX and auto-render are available.
     * @param {Function} [callback] - Function called with (AxiomMath) once ready
     * @returns {Object} AxiomMath instance for chaining
     */
    init: function(callback) {
      if (typeof callback === 'function') {
        if (this.isReady) {
          try {
            callback(this);
          } catch (err) {
            console.warn('[AxiomMath] init callback warning:', err);
          }
        } else {
          this.callbacks.push(callback);
        }
      }

      this._checkReady();
      return this;
    },

    /**
     * Notification callback triggered when KaTeX CDN finishes loading.
     */
    onKaTeXLoaded: function() {
      this.isReady = true;
      if (this._pollTimer) {
        clearInterval(this._pollTimer);
        this._pollTimer = null;
      }
      this._flush();
    },

    /**
     * Internal check for KaTeX auto-render availability.
     */
    _checkReady: function() {
      if (typeof global.renderMathInElement === 'function') {
        this.isReady = true;
        this._flush();
      } else if (!this._pollTimer && typeof setInterval === 'function') {
        var self = this;
        var attempts = 0;
        self._pollTimer = setInterval(function() {
          attempts++;
          if (typeof global.renderMathInElement === 'function') {
            clearInterval(self._pollTimer);
            self._pollTimer = null;
            self.onKaTeXLoaded();
          } else if (attempts > 50) {
            clearInterval(self._pollTimer);
            self._pollTimer = null;
          }
        }, 100);
      }
    },

    /**
     * Flushes queued elements and invokes registered callbacks.
     */
    _flush: function() {
      while (this.queue.length > 0) {
        var target = this.queue.shift();
        this._renderDirect(target);
      }
      while (this.callbacks.length > 0) {
        var cb = this.callbacks.shift();
        try {
          cb(this);
        } catch (err) {
          console.warn('[AxiomMath] Registered callback warning:', err);
        }
      }
    },

    /**
     * Direct render call to renderMathInElement with error handling.
     * @param {HTMLElement} target
     */
    _renderDirect: function(target) {
      if (!target) return;
      if (typeof global.renderMathInElement === 'function') {
        try {
          global.renderMathInElement(target, {
            delimiters: this.delimiters,
            throwOnError: false,
            errorColor: '#f43f5e'
          });
        } catch (err) {
          console.warn('[AxiomMath] renderElement warning:', err);
        }
      }
    },

    /**
     * Renders mathematical expressions within a DOM element.
     * If KaTeX is not yet ready, queues the element for automatic rendering upon load.
     * @param {HTMLElement|string} [element] - Target DOM element or CSS selector. Defaults to document.body.
     */
    renderElement: function(element) {
      var target = element;
      if (typeof target === 'string' && typeof document !== 'undefined') {
        target = document.querySelector(target);
      }
      if (!target && typeof document !== 'undefined') {
        target = document.body;
      }

      if (!target) {
        // Document body might not be parsed yet
        if (typeof document !== 'undefined' && document.readyState === 'loading') {
          var self = this;
          document.addEventListener('DOMContentLoaded', function() {
            self.renderElement(element);
          });
        }
        return;
      }

      if (this.isReady && typeof global.renderMathInElement === 'function') {
        this._renderDirect(target);
      } else {
        if (this.queue.indexOf(target) === -1) {
          this.queue.push(target);
        }
        this._checkReady();
      }
    },

    /**
     * Alias for renderElement.
     */
    render: function(element) {
      this.renderElement(element);
    },

    /**
     * Formats formula text to ensure appropriate mathematical delimiters.
     * Wraps raw formulas with inline delimiters if none are present.
     * @param {string} text - Raw formula or mathematical expression
     * @returns {string} Formatted string with math delimiters
     */
    formatFormula: function(text) {
      if (!text || typeof text !== 'string') return '';
      var trimmed = text.trim();
      if (!trimmed) return '';

      // Check if already enclosed by delimiters
      var hasDisplay = (trimmed.startsWith('$$') && trimmed.endsWith('$$')) ||
                       (trimmed.startsWith('\\[') && trimmed.endsWith('\\]'));
      var hasInline = (trimmed.startsWith('\\(') && trimmed.endsWith('\\)')) ||
                      (trimmed.startsWith('$') && trimmed.endsWith('$'));

      if (hasDisplay || hasInline) {
        return trimmed;
      }

      // Default to standard inline math delimiter
      return '\\(' + trimmed + '\\)';
    }
  };

  // Auto-listen to DOM and window lifecycle events
  if (typeof document !== 'undefined') {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      AxiomMath._checkReady();
    } else {
      document.addEventListener('DOMContentLoaded', function() {
        AxiomMath._checkReady();
      });
      if (typeof global.addEventListener === 'function') {
        global.addEventListener('load', function() {
          AxiomMath._checkReady();
        });
      }
    }
  }

  // Export to global scope and CommonJS if available
  global.AxiomMath = AxiomMath;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AxiomMath;
  }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
