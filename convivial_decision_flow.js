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

    this.functions = {}; // Dictionary to store custom functions

    this._validation(id);

    const steps = this._loadSteps(id);
    if (Array.isArray(steps)) {
      this.config = { id, first_step: steps[0], steps };
      if (!this._isStorageAvailable()) {
        return;
      }

      this.storageData = this._loadStorage(id);
      this._defineDefaultFunctions();
      this.activate();
      this.initializeForms();

      document.querySelectorAll('#' + id + ' .step .step__answer').forEach((answer) => {
        if (answer.hasAttribute('href')) {
          answer.addEventListener('click', (event) => {
            event.preventDefault();
            // Mark the selected answer
            document.querySelectorAll('#' + id + ' .step .step__answer').forEach(a => a.removeAttribute('data-selected'));
            answer.setAttribute('data-selected', 'true');

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
   * @param {string} type - The type of the function (show, filter, etc.).
   * @param {string} name - The name of the function.
   * @param {Function} fn - The function to define.
   * @throws {Error} - If the provided argument is not a function.
   * @returns {void}
   */
  defineFunction(type, name, fn) {
    if (typeof fn !== 'function') {
      throw new Error('Provided argument is not a function');
    }
    if (!this.functions[type]) {
      this.functions[type] = {};
    }
    this.functions[type][name] = fn;
    console.log(`Defined function "${name}" under type "${type}"`);
  }

  /**
   * Execute a function.
   * 
   * @param {string} type - The type of the function (show, filter, etc.).
   * @param {string} name - The name of the function.
   * @param {HTMLElement} el - The element to manipulate.
   * @param {Array} args - The arguments to pass to the function.
   * @throws {Error} - If the function is not found.
   */
  executeFunction(type, name, el, args = []) {
    if (!this.functions[type] || !this.functions[type][name]) {
      console.warn(`Function "${name}" not found in ${type}. Skipping execution.`);
      return;
    }

    // Validate that the function name is safe to use
    const validName = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(name);
    if (!validName) {
      throw new Error('Invalid function name');
    }

    try {
      return this.functions[type][name](this, el, ...args);
    } catch (e) {
      console.error(`Error executing function "${name}":`, e);
      throw e;
    }
  }

  /**
   * Define default functions.
   */
  _defineDefaultFunctions() {
    if (this.definingDefaultFunctions) return;
    this.definingDefaultFunctions = true;

    this.functions.show = {};
    this.functions.filter = {};

    this.functions.show.history = (context, el) => {
      const historyElement = el;
      if (this.storageData.history.length > 1 && historyElement) {
        const dlElement = document.createElement('dl');

        // Iterate through the history and capture question-answer pairs
        this.storageData.history.forEach(stepId => {
          const stepElement = document.querySelector(`#${this.config.id} #${stepId}`);
          const questionElement = stepElement.querySelector('.step__question');

          const dtElement = document.createElement('dt');
          dtElement.textContent = questionElement ? questionElement.textContent.trim() : '';
          dlElement.appendChild(dtElement);

          if (this.storageData.answers && this.storageData.answers[stepId]) {
            const ddElement = document.createElement('dd');
            ddElement.textContent = this.storageData.answers[stepId];
            dlElement.appendChild(ddElement);
          }
        });

        historyElement.innerHTML = '<h3>History</h3>';
        historyElement.appendChild(dlElement);

        // Ensure the history element is visible
        historyElement.style.display = 'block';
      }
    };

    this.functions.show.submission = (context, el) => {
      const submissionElement = el;
      const submissions = this.storageData.vars;
      if (submissionElement) {
        let hasSubmissions = false;
        const dlElement = document.createElement('dl');

        Object.keys(submissions).forEach(key => {
          if (!key.endsWith('_label')) {
            hasSubmissions = true;
            const label = submissions[key + '_label'] || key;
            const value = submissions[key];

            const dtElement = document.createElement('dt');
            dtElement.textContent = label;

            const ddElement = document.createElement('dd');
            ddElement.textContent = this._capitalizeFirstLetter(value);

            dlElement.appendChild(dtElement);
            dlElement.appendChild(ddElement);
          }
        });

        if (!hasSubmissions) {
          submissionElement.style.display = 'none';
          return;
        }

        submissionElement.innerHTML = '<h3>Submission</h3>';
        submissionElement.appendChild(dlElement);

        // Ensure the submission element is visible
        submissionElement.style.display = 'block';
      }
    };


    this.functions.show.summary = (context, el) => {
      this._cleanHTML();
      let furtherQuestions = document.querySelector('#' + this.config.id + ' #' + this.storageData.active + ' .step__answer');

      if (furtherQuestions != null) {
        furtherQuestions = furtherQuestions.innerHTML.replace(/<\!--.*?-->/g, '').trim().length;
      }

      if (furtherQuestions === 0 || furtherQuestions == null) {
        this.show('#' + this.config.id + ' .convivial-decision-flow__summary');

        let infoHTML = '';
        if (this.storageData.history && this.storageData.history.length > 1) {
          const history = this.storageData.history.slice();

          history.forEach((el) => {
            const stepElement = document.querySelector('#' + this.config.id + ' #' + el);
            if (stepElement) {
              const questionElement = stepElement.querySelector('.step__question');
              const titleElement = stepElement.querySelector('.step__heading');
              if (questionElement) {
                infoHTML += `<dt>${questionElement.textContent.trim()}</dt>`;
              }
              if (titleElement) {
                infoHTML += `<dd>${titleElement.textContent.trim()}</dd>`;
              }
            }
          });

          const historyElement = document.querySelector('#' + this.config.id + ' .convivial-decision-flow__history');
          if (historyElement) {
            historyElement.innerHTML = `<h3>History</h3><dl>${infoHTML}</dl>`;
            historyElement.style.display = 'block';
          }
        } else {
          const historyElement = document.querySelector('#' + this.config.id + ' .convivial-decision-flow__history');
          if (historyElement) {
            historyElement.style.display = 'none';
          }
        }

        const submissionElement = document.querySelector('#' + this.config.id + ' .convivial-decision-flow__submission');
        if (submissionElement) {
          if (Object.keys(this.storageData.vars).length > 0) {
            submissionElement.style.display = 'block';
            const dlElement = document.createElement('dl');
            Object.keys(this.storageData.vars).forEach(key => {
              if (!key.endsWith('_label')) {
                const label = this.storageData.vars[key + '_label'] || key;
                const value = this.storageData.vars[key];

                const dtElement = document.createElement('dt');
                dtElement.textContent = label;

                const ddElement = document.createElement('dd');
                ddElement.textContent = this._capitalizeFirstLetter(value);

                dlElement.appendChild(dtElement);
                dlElement.appendChild(ddElement);
              }
            });
            submissionElement.innerHTML = '<h3>Submission</h3>';
            submissionElement.appendChild(dlElement);
          } else {
            submissionElement.style.display = 'none';
          }
        }
      }
    };

    this.functions.filter.compare = (variableValue, operator, comparator) => {
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
    };

    this.functions.vars = (key, operation, value) => {
      const variableValue = this.storageData.vars[key];
      return this.functions.filter.compare(variableValue, operation, value);
    }

    this.functions.visited = (stepId, operation, value) => {
      const isVisited = this.storageData.history.includes(stepId);
      return this.functions.filter.compare(isVisited, operation, value);
    }

    this.functions.filter.evaluate = (el, criteria) => {
      const parts = criteria.split('_');
      const functionName = parts[0];
      const args = parts.slice(1);

      if (this.functions.filter[functionName]) {
        return this.functions.filter[functionName](el, ...args);
      }

      if (functionName === 'var') {
        return this.functions.vars(...args);
      } else if (functionName === 'visited') {
        return this.functions.visited(...args);
      }

      return false;
    };

    this.functions.filter.process = (el) => {
      const filters = el.getAttribute('data-dt-filter');
      if (!filters) return true;
      return filters.split(',').some(filter => {
        return filter.split('+').every(criteria => {
          if (criteria.startsWith('!')) {
            return !this.functions.filter.evaluate(el, criteria.slice(1));
          }
          return this.functions.filter.evaluate(el, criteria);
        });
      });
    };

    this.functions.form = (form) => {
      const formData = new FormData(form);
      const vars = {};

      formData.forEach((value, key) => {
        vars[key] = value;
        let label;
        form.querySelectorAll('label').forEach(lbl => {
          if (lbl.getAttribute('for') === key) {
            label = lbl.textContent.trim();
          }
        });
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

      storageData.vars = { ...storageData.vars, ...vars };
      this.storage.setItem(namespace, JSON.stringify(storageData));

      this.storageData = storageData;
      const nextStep = form.getAttribute('action').replace('#', '');
      this.trackAnswer(nextStep);
      this.filter();
    };

    this.definingDefaultFunctions = false;
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

  _cleanHTML() {
    // Clean HTML of all answers and remove styles.
    document.querySelectorAll('#' + this.config.id + ' .convivial-decision-flow__summary').forEach((element) => {
      element.removeAttribute('style');
    });
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
      this.functions.show.summary(this);

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
        this.functions.form(form);
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
        this._executeShowFunctions(elem); // Execute show functions if any
        return true;
      }
    } catch (e) {
      console.warn('Please check convivial decision flow ' + this.config.id + '. Incorrect HTML structure.');
    }
    return false;
  }

  /**
   * Execute show functions.
   */
  _executeShowFunctions(elem) {
    const elementsWithShow = elem.querySelectorAll('[data-df-show]');

    elementsWithShow.forEach((element) => {
      const functionName = element.getAttribute('data-df-show');
      if (functionName) {
        // Validate the function name
        const validName = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(functionName);
        if (validName) {
          if (this.functions.show && this.functions.show[functionName]) {
            console.log(`Executing show function: ${functionName}`);
            this.executeFunction('show', functionName, element);
          } else {
            console.warn(`Show function "${functionName}" not defined yet. Skipping execution.`);
          }
        } else {
          console.warn(`Invalid function name: ${functionName}`);
        }
      }
    });
  }

  /**
   * Filter results elements by start and stop parameters.
   */
  filter() {
    // Target elements with the data-dt-filter attribute within the specific config id
    document.querySelectorAll('#' + this.config.id + ' [data-dt-filter]').forEach((element) => {
      if (this.functions.filter.process(element)) {
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

    // Store the selected answer in the storageData
    const activeStepElement = document.querySelector('#' + this.config.id + ' #' + this.storageData.active);
    const selectedAnswerElement = activeStepElement.querySelector('.step__answer[data-selected="true"]');
    if (selectedAnswerElement) {
      this.storageData.answers = this.storageData.answers || {};
      this.storageData.answers[this.storageData.active] = selectedAnswerElement.textContent.trim();
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

    // Track the attribute (setting cookie if needed).
    this.trackAttribute(this.storageData.active);

    // Detect if we are on last step and then display summary.
    this.functions.show.summary(this);

    // Ensure history and submission sections are updated immediately
    const historyElement = document.querySelector('#' + this.config.id + ' [data-df-show="history"]');
    if (historyElement) {
      this.executeFunction('show', 'history', historyElement);
    }

    const submissionElement = document.querySelector('#' + this.config.id + ' [data-df-show="submission"]');
    if (submissionElement) {
      this.executeFunction('show', 'submission', submissionElement);
    }

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

    // Wipe out history and vars.
    this.storageData.history = [this.config.first_step];
    this.storageData.vars = {};

    // Save the storage.
    this._saveStorage();

    // Track the attribute.
    this.trackAttribute(this.storageData.active);

    // Toggle Footer.
    this.toggleFooter();

    // Clean HTML from added elements.
    this._cleanHTML();

    // Hide the history and submission sections on restart
    const historyElement = document.querySelector('#' + this.config.id + ' .convivial-decision-flow__history');
    if (historyElement) {
      historyElement.style.display = 'none';
    }

    const submissionElement = document.querySelector('#' + this.config.id + ' .convivial-decision-flow__submission');
    if (submissionElement) {
      submissionElement.style.display = 'none';
    }
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
        const [name, value] = stepOutcome.split('=');
        this.cookie(name, value, 7); // Set the cookie with a default expiry of 7 days
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
   * Initialize custom function calls based on data-df-show attribute.
   */
  _initializeFunctionCalls() {
    document.querySelectorAll(`#${this.config.id} [data-df-show]`).forEach((element) => {
      const functionName = element.getAttribute('data-df-show');
      if (functionName) {
        // Validate the function name
        const validName = /^[a-zA-Z_$][0-9a-zA-Z_$]*$/.test(functionName);
        if (validName) {
          if (this.functions.show && this.functions.show[functionName]) {
            console.log(`Executing show function: ${functionName}`);
            this.executeFunction('show', functionName, element);
          } else {
            console.warn(`Show function "${functionName}" not defined yet. Skipping execution.`);
          }
        } else {
          console.warn(`Invalid function name: ${functionName}`);
        }
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', function () {
  // Initialize the convivial decision flow object for all convivial decision flows.
  document.querySelectorAll('.convivial-decision-flow').forEach((el) => {
    if (el.hasAttribute('id')) {
      const dt = new ConvivialDecisionFlow(localStorage, el.id, el); // Use localStorage or sessionStorage as needed

      // Hide the history and submission sections on page load if no data
      const historyElement = document.querySelector('.convivial-decision-flow__history');
      if (historyElement) {
        const hasHistory = dt.storageData.history && dt.storageData.history.length > 1;
        historyElement.style.display = hasHistory ? 'block' : 'none';
      }

      const submissionElement = document.querySelector('.convivial-decision-flow__submission');
      if (submissionElement) {
        const hasSubmissions = Object.keys(dt.storageData.vars).length > 0;
        submissionElement.style.display = hasSubmissions ? 'block' : 'none';
      }
    } else {
      console.warn('Convivial decision flow does not have ID.');
    }
  });
}, false);
