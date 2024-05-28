class ConvivialDecisionFlow {
  'use strict';

  /**
   * Class constructor.
   *
   * @param storageType {string} representing the type of storage ('local' or 'session').
   * @param id {string} representing id of HTML element.
   * @param domElement {HTMLElement} representing the DOM element.
   */
  constructor(storageType, id, domElement) {
    this.storageType = storageType === 'session' ? sessionStorage : localStorage;
    this.id = id;
    this.domElement = domElement;

    // Validate steps and answers.
    this._validation(id);

    const steps = this._loadSteps(id);
    if (Array.isArray(steps)) {
      this.config = { id, first_step: steps[0], steps };
      if (!this._isStorageAvailable()) {
        return;
      }

      // Load all the steps available in DOM.
      this.storage = this._loadStorage(id);
      // Activate the convivial decision flow.
      this.activate();
      this.initializeForms(); // Ensure forms are initialized after activation
      // Track answer.
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
   * Check if the storage is available.
   */
  _isStorageAvailable() {
    try {
      if (typeof this.storageType === 'undefined') {
        return false;
      }
      const test = 'test';
      this.storageType.setItem(test, test);
      this.storageType.removeItem(test);
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
  _validateHistory(storage) {
    // Reset history if it has legacy data/data which does not exist in DOM.
    const history = storage.history ?? '';
    const steps = this.config.steps ? this.config.steps : this._loadSteps(this.config.id);

    if (history.length > 0 && steps.length > 0) {
      const valid = history.every((val) => steps.indexOf(val) !== -1);
      if (valid === false) {
        storage.history = [this.config.first_step];
        storage.active = this.config.first_step;
        this.storage = storage;
        this._saveStorage();
      }
    }

    return storage;
  }

  /**
   * Load the active convivial decision flow from storage.
   */
  _loadStorage(id) {
    let namespace = `convivial-decision-flow.${id}`;
    let storage = JSON.parse(this.storageType.getItem(namespace)) || {};
    if (Object.keys(storage).length !== 0) {
      storage = this._validateHistory(storage);
      if (!storage.vars) {
        storage.vars = {};
      }
      if (!storage.functions) {
        storage.functions = {};
      }
      this.storage = storage;  // Initialize the local storage object
      return storage;
    }
    this.storage = {
      first_step: this.config.first_step,
      active: this.config.first_step,
      history: [this.config.first_step],
      vars: {},
      functions: {}
    };
    return this.storage;
  }

  /**
   * Save the active convivial decision flow to storage.
   */
  _saveStorage() {
    let namespace = `convivial-decision-flow.${this.config.id}`;
    this.storageType.setItem(namespace, JSON.stringify(this.storage));
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

    const display_summary_in_step = document.querySelector('#' + this.config.id + ' #' + this.storage.active).hasAttribute('data-show-summary');
    if (this.storage.active) {
      // Show step info if there are no further questions.
      var furtherQuestions = document.querySelector('#' + this.config.id + ' #' + this.storage.active + ' .step__answer');

      if (furtherQuestions != null) {
        furtherQuestions = furtherQuestions.innerHTML.replace(/<\!--.*?-->/g, '').trim().length;
      }
    }

    if (furtherQuestions === 0 || furtherQuestions == null || display_summary_in_step) {
      // We are displaying summary in this step.
      this.show('#' + this.config.id + ' .convivial-decision-flow__summary');

      // Show step info.
      let infoHTML = '';
      if (this.storage.history) {
        // Copy history values to a local variable.
        const history = this.storage.history.slice();

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
      let historyElement = document.querySelector('#' + this.config.id + ' .convivial-decision-flow__history');

      if (historyElement) {
        historyElement.style.display = 'block';
      }

      let submissionElement = document.querySelector('#' + this.config.id + ' .convivial-decision-flow__submission');

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
    let formData = new FormData(form);
    let vars = {};

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

    let namespace = `convivial-decision-flow.${this.config.id}`;
    let storage = JSON.parse(this.storageType.getItem(namespace)) || {
      first_step: this.config.first_step,
      active: this.config.first_step,
      history: [this.config.first_step],
      vars: {},
      functions: {}
    };

    // Update the vars array in the storage object
    storage.vars = { ...storage.vars, ...vars };
    this.storageType.setItem(namespace, JSON.stringify(storage));

    this.storage = storage;  // Refresh the local storage object

    let nextStep = form.getAttribute('action').replace('#', '');
    this.trackAnswer(nextStep);
    this.filter();
  }

  _filterElement(element) {
    let filters = element.getAttribute('data-dt-filter');
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
    if (criteria.startsWith('var_')) {
      let [variable, operation, value] = criteria.slice(4).split('_');
      return this._compare(this.storage.vars[variable], operation, value);
    } else if (criteria.startsWith('visited_')) {
      return this.storage.history.includes(criteria.slice(8));
    }
    return false;
  }

  _compare(variableValue, operator, comparator) {
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

  /** Show the history data. */
  _showHistory() {
    let historyElement = document.querySelector('#' + this.config.id + ' .convivial-decision-flow__history');
    if (historyElement) {
      // Create the <dl> element
      let dlElement = document.createElement('dl');

      // Map through the history and create <dd> elements for each title
      this.storage.history.forEach(stepId => {
        if (stepId != this.config.first_step) {
          let stepElement = document.querySelector('#' + this.config.id + ' #' + stepId);
          let questionElement = stepElement.querySelector('.step__question');
          let dtElement = document.createElement('dt');
          dtElement.textContent = questionElement ? questionElement.textContent.trim() : '';
          dlElement.appendChild(dtElement);

          let titleElement = stepElement.querySelector('.step__heading');
          let ddElement = document.createElement('dd');
          ddElement.textContent = titleElement ? titleElement.textContent.trim() : '';
          dlElement.appendChild(ddElement);
        }
      });

      // Set the innerHTML of the history element to the <dl> element
      historyElement.innerHTML = '<h3>History</h3>';
      historyElement.appendChild(dlElement);
    }
  }

  /** Show the submission data. */
  _showSubmission() {
    let submissionElement = document.querySelector('#' + this.config.id + ' .convivial-decision-flow__submission');
    if (submissionElement) {
      let submissions = this.storage.vars;

      let dlElement = document.createElement('dl');

      Object.keys(submissions).forEach(key => {
        if (!key.endsWith('_label')) {
          let label = submissions[key + '_label'] || key;
          let value = submissions[key];

          let dtElement = document.createElement('dt');
          dtElement.textContent = label;

          let ddElement = document.createElement('dd');
          ddElement.textContent = this._capitalizeFirstLetter(value);

          dlElement.appendChild(dtElement);
          dlElement.appendChild(ddElement);
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
      this.trackGA(this.storage.active + '/');

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
      this.show('#' + this.config.id + ' #' + this.storage.active);

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
      return this.storage.history.includes(object);
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
    if (this.storage.history && this.storage.history.length > 1) {
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
      this.trackGA(this.storage.active + '/' + datakey);
    }

    // Hide current/active step.
    this.hide('#' + this.config.id + ' #' + this.storage.active);

    // Show next step.
    this.show('#' + this.config.id + ' #' + nextStep);

    // Track new step display.
    this.trackGA(nextStep + '/');

    // Make the next step as active.
    this.storage.active = nextStep;

    // Prevent duplicate entries in history
    if (!this.storage.history.includes(this.storage.active)) {
      this.storage.history.push(this.storage.active);
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
    if (this.storage.history.length <= 1) {
      return;
    }

    // Hide current/active step.
    this.hide('#' + this.config.id + ' #' + this.storage.active);

    // Show previous step from history.
    const previousStep = this.storage.history[this.storage.history.length - 2];
    this.show('#' + this.config.id + ' #' + previousStep);

    // Track current step.
    this.trackGA(previousStep + '/back');

    // Hide Step info and empty step info extra and step info heading.
    this.hide('#' + this.config.id + ' #' + this.storage.active + ' .step__info');

    // Clean HTML from added elements.
    this._cleanHTML();

    // Make the next step as active.
    this.storage.active = previousStep;

    // Remove last step from history.
    this.storage.history.pop();

    // Save the storage.
    this._saveStorage();

    // Track the attribute.
    this.trackAttribute(this.storage.active);

    // Toggle Footer.
    this.toggleFooter();
  }

  /**
   * Track the restart button.
   */
  trackRestartButton() {
    // Hide current/active step.
    this.hide('#' + this.config.id + ' #' + this.storage.active);

    // Track the active step into google analytics.
    this.trackGA(this.storage.active + '/restart');

    // Make first step as active step.
    this.storage.active = this.config.first_step;

    // Show the first step.
    this.show('#' + this.config.id + ' #' + this.storage.active);

    // Send first step data to GA.
    this.trackGA(this.storage.active);

    // Wipe out history.
    this.storage.history = [this.config.first_step];

    // Save the storage.
    this._saveStorage();

    // Track the attribute.
    this.trackAttribute(this.storage.active);

    // Toggle Footer.
    this.toggleFooter();

    // Clean HTML from added elements.
    this._cleanHTML();
  }

  /**
   * Track attribute into local storage.
   */
  trackAttribute(id) {
    let step = document.querySelector('#' + this.config.id + ' #' + id);
    // Store the attribute.
    if (step != null) {
      let stepOutcome = step.getAttribute('data-cookie');
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
   * Define and store a custom function in the storage.
   */
  defineFunction(name, fn) {
    if (typeof fn !== 'function') {
      throw new Error('Provided argument is not a function');
    }
    this.storage.functions[name] = fn.toString();
    this._saveStorage();
  }

  /**
   * Execute a custom function from the storage.
   */
  executeFunction(name, context = document) {
    const fnString = this.storage.functions[name];
    if (!fnString) {
      throw new Error(`Function "${name}" not found in storage`);
    }
    const shadowRoot = this._createShadowRoot();
    const script = document.createElement('script');
    script.textContent = `
      (() => {
        const context = document.querySelector("#${this.config.id}");
        (${fnString})(context);
      })();
    `;
    shadowRoot.appendChild(script);
  }

  /**
   * Create a secure shadow root to execute functions.
   */
  _createShadowRoot() {
    const shadowHost = document.createElement('div');
    document.body.appendChild(shadowHost);
    const shadowRoot = shadowHost.attachShadow({ mode: 'closed' });
    return shadowRoot;
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
  document.querySelectorAll('.convivial-decision-flow').forEach((flow) => {
    if (flow.id) {
      new ConvivialDecisionFlow('local', flow.id, flow);
    } else {
      console.warn('Convivial decision flow does not have an ID.');
    }
  });
});
