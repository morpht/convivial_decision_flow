class ConvivialDecisionFlow {
  'use strict';

  /**
   * Convivial Decision Flow constructor.
   * 
    * @param {Storage} storage - The storage object to use for storing data.
    * @param {string} id - The ID of the convivial decision flow.
    * @param {HTMLElement} domElement - The DOM element of the convivial decision flow.
    * @throws {Error} - If the HTML structure is incorrect.
    */
  constructor(storage, id, domElement) {
    this.storage = storage;
    this.id = id;
    this.domElement = domElement;

    this.customFunctions = {}; // Dictionary to store custom functions

    this._validation(id);

    const steps = this._loadSteps(id);
    if (Array.isArray(steps)) {
      this.config = { id, first_step: steps[0], steps };
      if (!this._isStorageAvailable()) {
        return;
      }

      this.storageData = this._loadStorage(id);
      this.activate();
      this.initializeForms();
      this._defineDefaultFunctions();
      document.querySelectorAll('#' + id + ' .step .step__answer')
        .forEach((answer) => {
          if (answer.hasAttribute('href')) {
            answer.addEventListener('click', () => {
              this.filter();
              this.trackAnswer(answer.attributes.href.value.replace('#', ''), answer.hasAttribute('data-answer-path') ? answer.attributes['data-answer-path'].value : false);
            });
          }
        }, this);
    } else {
      throw new Error('Please follow proper HTML structure.');
    }
  }

  /**
   * Define a custom function.
   * 
   * @param {string} name - The name of the function.
   * @param {Function} fn - The function to define.
   * @throws {Error} - If the provided argument is not a function.
   * @returns {void}
   */
  defineFunction(name, fn) {
    if (typeof fn !== 'function') {
      throw new Error('Provided argument is not a function');
    }
    this.customFunctions[name] = fn;
    this.storageData.functions[name] = fn.toString();
    this._saveStorage();
  }

  /**
   * Execute a function.
   * 
   * @param {string} name - The name of the function.
   * @param {Array} args - The arguments to pass to the function.
   * @throws {Error} - If the function is not found in storage.
   */
  executeFunction(name, args = []) {
    if (this.customFunctions[name]) {
      return this.customFunctions[name].apply(this, args);
    }
    const fnString = this.storageData.functions[name];
    if (!fnString) {
      throw new Error(`Function "${name}" not found in storage`);
    }

    const context = this;
    try {
      const fn = new Function('context', 'args', `"use strict"; return (${fnString}).apply(context, args);`);
      return fn(context, args);
    } catch (e) {
      console.error(`Error executing function "${name}":`, e);
      console.error(`Function string: "${fnString}"`);
      throw e;
    }
  }

  /**
   * Define default functions.
   */
  _defineDefaultFunctions() {
    this._showHistory = this._showHistory.bind(this);
    this._showSummary = this._showSummary.bind(this);
    this._showSubmission = this._showSubmission.bind(this);
    this._compare = this._compare.bind(this);
    this._evaluateCriteria = this._evaluateCriteria.bind(this);
    this._filterElement = this._filterElement.bind(this);
    this._handleFormSubmit = this._handleFormSubmit.bind(this);
  }

  /**
   * Show the history of the active convivial decision flow.
   */
  _showHistory() {
    const historyElement = document.querySelector(`#${this.config.id} .convivial-decision-flow__history`);
    if (historyElement) {
      const dlElement = document.createElement('dl');

      this.storageData.history.forEach(stepId => {
        if (stepId != this.config.first_step) {
          const stepElement = document.querySelector(`#${this.config.id} #${stepId}`);
          const questionElement = stepElement.querySelector('.step__question');
          const dtElement = document.createElement('dt');
          dtElement.textContent = questionElement ? questionElement.textContent.trim() : '';
          dlElement.appendChild(dtElement);

          const titleElement = stepElement.querySelector('.step__heading');
          const ddElement = document.createElement('dd');
          ddElement.textContent = titleElement ? titleElement.textContent.trim() : '';
          dlElement.appendChild(ddElement);
        }
      });

      historyElement.innerHTML = '<h3>History</h3>';
      historyElement.appendChild(dlElement);
    }
  }

  /**
   * Check if the storage is available.
   */
  _isStorageAvailable() {
    try {
      if (typeof this.storage === 'undefined') {
        return false;
      }
      const test = 'test';
      this.storage.setItem(test, test);
      this.storage.removeItem(test);
      return true;
    } catch (e) {
      console.log('Convivial decision flow will not work optimally because the browser storage is not enabled or accessible.');
      return false;
    }
  }

  /** 
 * Get the value of a variable from the storage.
 */
  vars(key, operation, value) {
    const variableValue = this.storageData.vars[key];
    return this._compare(variableValue, operation, value);
  }

  /**
   * Check if the step has been visited.
   */
  visited(stepId, operation, value) {
    const isVisited = this.storageData.history.includes(stepId);
    return this._compare(isVisited, operation, value);
  }

  /**
   * Load all the steps of the active convivial decision flow into config.
   */
  _loadSteps(id) {
    const steps = [];
    document
      .querySelector('#' + id)
      .querySelectorAll('.step')
      .forEach(function (el) {
        steps.push(el.id);
      });
    if (steps.length < 1) {
      console.warn('Convivial decision flow should have at least one step.');
    }

    return steps;
  }

  /**
   * Validate the history of the active convivial decision flow.
   */
  _validateHistory(storageData) {
    // Reset history if it has legacy data/data which does not exist in DOM.
    const history = storageData.history ?? '';
    const steps = this.config.steps ? this.config.steps : this._loadSteps(this.config.id);

    if (history.length > 0 && steps.length > 0) {
      const valid = history.every((val) => steps.indexOf(val) !== -1);
      if (valid === false) {
        storageData.history = [this.config.first_step];
        storageData.active = this.config.first_step;
        this.storageData = storageData;
        this._saveStorage();
      }
    }

    return storageData;
  }

  /**
   * Load the active convivial decision flow from storage.
   */
  _loadStorage(id) {
    const namespace = `convivial-decision-flow.${id}`;
    let storageData = JSON.parse(this.storage.getItem(namespace)) || {};
    if (Object.keys(storageData).length !== 0) {
      storageData = this._validateHistory(storageData);
      if (!storageData.vars) {
        storageData.vars = {};
      }
      if (!storageData.functions) {
        storageData.functions = {};
      }
      this.storageData = storageData;  // Initialize the storage object
      return storageData;
    }
    this.storageData = {
      first_step: this.config.first_step,
      active: this.config.first_step,
      history: [this.config.first_step],
      vars: {},
      functions: {}
    };
    return this.storageData;
  }

  /**
   * Save the active convivial decision flow to storage.
   */
  _saveStorage() {
    const namespace = `convivial-decision-flow.${this.config.id}`;
    this.storage.setItem(namespace, JSON.stringify(this.storageData));
  }

  /**
   * Basic HTML structure validation.
   */
  _validation(id) {
    const steps = document.querySelector('#' + id).querySelectorAll('.step');
    steps.forEach((el) => {
      if (!el.hasAttribute('id')) {
        console.warn('One of your steps in convivial decision flow with ID ' + id + ' does not have ID element filled.');
      }
    });

    // Every answer must have href and should have a data-answer-path.
    document.querySelector('#' + id).querySelectorAll('.step__answer').forEach((el) => {
      if (!el.hasAttribute('href')) {
        console.warn('One of your answers in convivial decision flow id ' + id + ' does not have href filled.');
      }
      if (!el.hasAttribute('data-answer-path')) {
        console.warn('One of your answers in convivial decision flow id ' + id + ' does not have data-answer-path filled.');
      }
    });
  }

  _showSummary() {
    // Clean HTML first.
    this._cleanHTML();

    const display_summary_in_step = document.querySelector('#' + this.config.id + ' #' + this.storageData.active).hasAttribute('data-show-summary');
    let furtherQuestions = document.querySelector('#' + this.config.id + ' #' + this.storageData.active + ' .step__answer');

    if (furtherQuestions != null) {
      furtherQuestions = furtherQuestions.innerHTML.replace(/<\!--.*?-->/g, '').trim().length;
    }

    if (furtherQuestions === 0 || furtherQuestions == null || display_summary_in_step) {
      // We are displaying summary in this step.
      this.show('#' + this.config.id + ' .convivial-decision-flow__summary');

      // Show step info.
      let infoHTML = '';
      if (this.storageData.history) {
        // Copy history values to a local variable.
        const history = this.storageData.history.slice();

        history.forEach((el) => {
          if (document.querySelector('#' + this.config.id + ' #' + el + ' .step__info')) {
            infoHTML += document.querySelector('#' + this.config.id + ' #' + el + ' .step__info').innerHTML;
          }
        });

        // Append info html into the step info extra.
        const summary_element = document.querySelector('#' + this.config.id + ' .convivial-decision-flow__summary');
        if (summary_element && summary_element.nodeType) {
          // In case of having infos element defined.
          if (summary_element.querySelector('.convivial-decision-flow__summary_infos') !== null) {
            summary_element.querySelector('.convivial-decision-flow__summary_infos').innerHTML = infoHTML;
          } else {
            const divElement = document.createElement('div');
            // Add the class 'convivial-decision-flow__summary_infos' to the div element.
            divElement.classList.add('convivial-decision-flow__summary_infos');
            // Set the innerHTML of the div element to the HTML string.
            divElement.innerHTML = infoHTML;
            // Insert the div element before the target element.
            summary_element.appendChild(divElement);
            // Filter results by start and stop parameters.
            this.filter();
          }
        } else {
          console.warn('Your convivial decision flow with ID ' + this.config.id + ' does not have element with class convivial-decision-flow__summary.');
        }
      } else {
        this.hide('#' + this.config.id + ' .convivial-decision-flow__summary');
      }
      this._showHistory();
      this._showSubmission();
      // Show the history and submission sections
      const historyElement = document.querySelector('#' + this.config.id + ' .convivial-decision-flow__history');

      if (historyElement) {
        historyElement.style.display = 'block';
      }

      const submissionElement = document.querySelector('#' + this.config.id + ' .convivial-decision-flow__submission');

      if (submissionElement) {
        submissionElement.style.display = 'block';
      }
    }
  }

  _cleanHTML() {
    // Clean HTML of all answers and remove styles.
    document.querySelectorAll('#' + this.config.id + ' .convivial-decision-flow__summary_infos *')
      .forEach((element) => {
        element.remove();
      });

    document.querySelectorAll('#' + this.config.id + ' .convivial-decision-flow__summary').forEach((element) => {
      element.removeAttribute('style');
    });
  }

  _handleFormSubmit(form) {
    const formData = new FormData(form);
    const vars = {};

    formData.forEach((value, key) => {
      vars[key] = value;

      // Find the corresponding label using the name attribute
      let label;
      form.querySelectorAll('label').forEach(lbl => {
        if (lbl.getAttribute('for') === key) {
          label = lbl.textContent.trim();
        }
      });

      // Store the label text in vars if a label is found
      if (label) {
        vars[key + '_label'] = label;
      }
    });

    const namespace = `convivial-decision-flow.${this.config.id}`;
    const storageData = JSON.parse(this.storage.getItem(namespace)) || {
      first_step: this.config.first_step,
      active: this.config.first_step,
      history: [this.config.first_step],
      vars: {},
      functions: {}
    };

    // Update the vars array in the storage object
    storageData.vars = { ...storageData.vars, ...vars };
    this.storage.setItem(namespace, JSON.stringify(storageData));

    this.storageData = storageData;  // Refresh the storage object

    const nextStep = form.getAttribute('action').replace('#', '');
    this.trackAnswer(nextStep);
    this.filter();
  }

  _filterElement(element) {
    const filters = element.getAttribute('data-dt-filter');
    if (!filters) return true;
    return filters.split(',').some(filter => {
      return filter.split('+').every(criteria => {
        if (criteria.startsWith('!')) {
          return !this._evaluateCriteria(criteria.slice(1));
        }
        return this._evaluateCriteria(criteria);
      });
    });
  }

  _evaluateCriteria(criteria) {
    const parts = criteria.split('_');
    const functionName = parts[0];
    const args = parts.slice(1);

    if (this.storageData.functions[functionName]) {
      return this.executeFunction(functionName, args);
    }

    // Fallback for default functions
    if (functionName === 'var') {
      return this.vars(...args);
    } else if (functionName === 'visited') {
      return this.visited(...args);
    }

    return false;
  }

  /**
   * Compare two values based on the operator.
   * 
   * @param {*} variableValue 
   * @param {*} operator 
   * @param {*} comparator 
   * @returns 
   */
  _compare(variableValue, operator, comparator) {
    if (this.storageData.functions['_compare']) {
      return this.executeFunction('_compare', [variableValue, operator, comparator]);
    }
    // Ensure both variableValue and comparator are of the same type before comparison
    if (!isNaN(variableValue)) variableValue = parseFloat(variableValue);
    if (!isNaN(comparator)) comparator = parseFloat(comparator);

    switch (operator) {
      case 'gt': return variableValue > comparator;
      case 'gte': return variableValue >= comparator;
      case 'lt': return variableValue < comparator;
      case 'lte': return variableValue <= comparator;
      case 'eq': return variableValue == comparator; // use == for type coercion
      case 'empty': return variableValue === '';
      default: return false;
    }
  }

  /** Show the submission data. */
  _showSubmission() {
    if (this.storageData.functions['_showSubmission']) {
      return this.executeFunction('_showSubmission', []);
    }
    const submissionElement = document.querySelector('#' + this.config.id + ' .convivial-decision-flow__submission');
    if (submissionElement) {
      const submissions = this.storageData.vars;

      const dlElement = document.createElement('dl');

      Object.keys(submissions).forEach(key => {
        if (!key.endsWith('_label')) {
          const label = submissions[key + '_label'] || key;
          const value = submissions[key];

          const dtElement = document.createElement('dt');
          dtElement.textContent = label;

          const ddElement = document.createElement('dd');
          ddElement.textContent = this._capitalizeFirstLetter(value);

          dlElement.appendChild(dtElement);
          ddElement.appendChild(ddElement);
        }
      });

      submissionElement.innerHTML = '<h3>Submission</h3>';
      submissionElement.appendChild(dlElement);
    }
  }

  /** Capitalize the first letter of a string. */
  _capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  /**
   * Show the active step of the active convivial decision flow and store it to local
   * storage.
   */
  activate() {
    try {
      // Track step into google analytics.
      this.trackGA(this.storageData.active + '/');

      // Hide all steps.
      document.querySelectorAll('#' + this.config.id + ' .step').forEach((step) => {
        this.hide(step);
      });

      // Toggle footer.
      this.toggleFooter();

      // Create a summary element if not present
      if (!document.querySelector('#' + this.config.id + ' .convivial-decision-flow__summary')) {
        // Create a new div element
        const divElement = document.createElement('div');
        // Add the class 'convivial-decision-flow__summary' to the div element
        divElement.classList.add('convivial-decision-flow__summary');
        // Insert the div element before the target element
        document.querySelector('#' + this.config.id + ' .convivial-decision-flow__footer').prepend(divElement);
      }

      // Load current step.
      this.show('#' + this.config.id + ' #' + this.storageData.active);

      // If it is a last step - show Summary.
      this._showSummary();

      // Filter results by start and stop parameters.
      this.filter();

      // Track back button.
      document.querySelector('#' + this.config.id + ' .convivial-decision-flow__footer .step__button--back').onclick = () => {
        this.trackBackButton();
      };

      // Track restart button.
      document.querySelector('#' + this.config.id + ' .convivial-decision-flow__footer .step__button--restart').onclick = () => {
        this.trackRestartButton();
      };

      // Add class to main div for better style targeting.
      document.querySelector('#' + this.config.id).classList.add('dt-initialized');

      // Hide the history and submission sections on page load
      const historyElement = document.querySelector('#' + this.config.id + ' .convivial-decision-flow__history');
      if (historyElement) {
        historyElement.style.display = 'none';
      }

      const submissionElement = document.querySelector('#' + this.config.id + ' .convivial-decision-flow__submission');
      if (submissionElement) {
        submissionElement.style.display = 'none';
      }

      // Initialize custom function calls
      this._initializeFunctionCalls();

      // Save the storage.
      this._saveStorage();
    } catch (e) {
      this.hide('#' + this.config.id);
      console.warn('Cannot activate convivial decision flow with ID ' + this.config.id + '. Incorrect HTML structure.', e);
    }
  }

  /**
   * Initialize forms.
   */
  initializeForms() {
    document.querySelectorAll('#' + this.config.id + ' .dt-form').forEach((form) => {
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        this._handleFormSubmit(form);
      });
    });
  }

  /**
   * Hide element.
   */
  hide(elem) {
    try {
      if (typeof elem === 'string') {
        elem = document.querySelector(elem);
      }
      if (elem && elem.nodeType) {
        elem.style.display = 'none';
        return true;
      }
    } catch (e) {
      console.warn('Please check convivial decision flow with ID ' + this.config.id + '. Incorrect HTML structure.');
    }
    return false;
  }

  /**
   * Show element.
   */
  show(elem) {
    try {
      if (typeof elem === 'string') {
        elem = document.querySelector(elem);
      }
      if (elem && elem.nodeType) {
        elem.style.display = 'revert';
        return true;
      }
    } catch (e) {
      console.warn('Please check convivial decision flow ' + this.config.id + '. Incorrect HTML structure.');
    }
    return false;
  }

  /**
   * Filter results elements by start and stop parameters.
   */
  filter() {
    // Target elements with the data-dt-filter attribute within the specific config id
    document.querySelectorAll('#' + this.config.id + ' [data-dt-filter]').forEach((element) => {
      if (this._filterElement(element)) {
        this.show(element);
      } else {
        this.hide(element);
      }
    });
  }

  is_in_history(filter_array) {
    return filter_array.split(' ').every((object) => {
      return this.storageData.history.includes(object);
    });
  }

  /**
   * Hide the active convivial decision flow back and restart button if its first step.
   */
  toggleFooter() {
    if (!document.querySelector('#' + this.config.id + ' .convivial-decision-flow__footer')) {
      // Create a new div element.
      const divElement = document.createElement('div');
      // Add the class 'convivial-decision-flow__footer' to the div element.
      divElement.classList.add('convivial-decision-flow__footer');
      // Set the innerHTML of the div element to the HTML string.
      divElement.innerHTML = '<button class=\'step__button step__button--back\'>Back</button>\n<button class=\'step__button step__button--restart\'>Restart</button>';
      // Insert the div element before the target element.
      document.querySelector('#' + this.config.id).appendChild(divElement);
    }
    if (this.storageData.history && this.storageData.history.length > 1) {
      this.show('#' + this.config.id + ' .convivial-decision-flow__footer');
    } else {
      this.hide('#' + this.config.id + ' .convivial-decision-flow__footer');
    }
  }

  /**
   * Track the answer.
   */
  trackAnswer(nextStep, datakey) {
    // Track click on answer.
    if (datakey) {
      this.trackGA(this.storageData.active + '/' + datakey);
    }

    // Hide current/active step.
    this.hide('#' + this.config.id + ' #' + this.storageData.active);

    // Show next step.
    this.show('#' + this.config.id + ' #' + nextStep);

    // Track new step display.
    this.trackGA(nextStep + '/');

    // Make the next step as active.
    this.storageData.active = nextStep;

    // Prevent duplicate entries in history
    if (!this.storageData.history.includes(this.storageData.active)) {
      this.storageData.history.push(this.storageData.active);
    }

    // Save the storage.
    this._saveStorage(this.config.id);

    // Track the attribute.
    this.trackAttribute(nextStep);

    // Detect if we are on last step and then display summary.
    this._showSummary();

    // Toggle Footer.
    this.toggleFooter();
  }

  /**
   * Track the back button.
   */
  trackBackButton() {
    if (this.storageData.history.length <= 1) {
      return;
    }

    // Hide current/active step.
    this.hide('#' + this.config.id + ' #' + this.storageData.active);

    // Show previous step from history.
    const previousStep = this.storageData.history[this.storageData.history.length - 2];
    this.show('#' + this.config.id + ' #' + previousStep);

    // Track current step.
    this.trackGA(previousStep + '/back');

    // Hide Step info and empty step info extra and step info heading.
    this.hide('#' + this.config.id + ' #' + this.storageData.active + ' .step__info');

    // Clean HTML from added elements.
    this._cleanHTML();

    // Make the next step as active.
    this.storageData.active = previousStep;

    // Remove last step from history.
    this.storageData.history.pop();

    // Save the storage.
    this._saveStorage();

    // Track the attribute.
    this.trackAttribute(this.storageData.active);

    // Toggle Footer.
    this.toggleFooter();
  }

  /**
   * Track the restart button.
   */
  trackRestartButton() {
    // Hide current/active step.
    this.hide('#' + this.config.id + ' #' + this.storageData.active);

    // Track the active step into google analytics.
    this.trackGA(this.storageData.active + '/restart');

    // Make first step as active step.
    this.storageData.active = this.config.first_step;

    // Show the first step.
    this.show('#' + this.config.id + ' #' + this.storageData.active);

    // Send first step data to GA.
    this.trackGA(this.storageData.active);

    // Wipe out history.
    this.storageData.history = [this.config.first_step];

    // Save the storage.
    this._saveStorage();

    // Track the attribute.
    this.trackAttribute(this.storageData.active);

    // Toggle Footer.
    this.toggleFooter();

    // Clean HTML from added elements.
    this._cleanHTML();
  }

  /**
   * Track attribute into local storage.
   */
  trackAttribute(id) {
    const step = document.querySelector('#' + this.config.id + ' #' + id);
    // Store the attribute.
    if (step != null) {
      const stepOutcome = step.getAttribute('data-cookie');
      if (stepOutcome !== null) {
        this.cookie(stepOutcome.split("=")[0], stepOutcome.split("=")[1]);
      }
    }
  }

  /**
   * Track pages via google analytics.
   */
  trackGA(path) {
    if (typeof gtag === 'function' && drupalSettings.google_analytics !== undefined) {
      gtag('config', drupalSettings.google_analytics.account, { page_path: window.location.href + this.config.id + '/' + path });
    } else if (typeof ga === 'function' && ga.getAll()[0].get('clientId') !== null && ga.getAll()[0].get('trackingId') !== null) {
      ga('create', ga.getAll()[0].get('trackingId'), {
        clientId: ga.getAll()[0].get('clientId')
      });
      ga('send', 'pageview', window.location.href + this.config.id + '/' + path);
    }
  }

  /**
   * Set cookie.
   */
  cookie(name, value, days) {
    let expires;

    if (days) {
      const date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = ' expires=' + date.toGMTString();
    } else {
      expires = '';
    }
    document.cookie = encodeURIComponent(name) + '=' + encodeURIComponent(value) + ';' + expires + ';' + ' path=/; SameSite=None; Secure';
  }

  /**
   * Initialize custom function calls based on data-df-content attribute.
   */
  _initializeFunctionCalls() {
    document.querySelectorAll(`#${this.config.id} [data-df-content]`).forEach((element) => {
      const functionName = element.getAttribute('data-df-content');
      if (functionName) {
        element.addEventListener('click', () => {
          this.executeFunction(functionName);
        });
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', function () {
  // Initialize the convivial decision flow object for all convivial decision flows.
  document.querySelectorAll('.convivial-decision-flow').forEach((el) => {
    if (el.hasAttribute('id')) {
      new ConvivialDecisionFlow(localStorage, el.id, el); // Use localStorage or sessionStorage as needed
    } else {
      console.warn('Convivial decision flow does not have ID.');
    }
  });
}, false);
